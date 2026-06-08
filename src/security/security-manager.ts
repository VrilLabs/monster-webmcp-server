/**
 * MonsterWebMCP - Security Manager
 * Enforces same-origin policy, cross-origin opt-in, tool name validation,
 * input schema validation, and rate limiting
 */

import type {
  ToolDefinition,
  RegisterOptions,
  SecurityValidationResult,
  RateLimitConfig,
  ToolAnnotations,
} from '../core/types';
import { isValidJsonSchema } from '../utils/schema-validator';
import { RateLimiter } from './rate-limiter';

export interface SecurityManagerOptions {
  allowedOrigins?: string[];
  rateLimits?: Record<string, RateLimitConfig>;
  defaultRateLimit?: RateLimitConfig;
}

const TOOL_NAME_PATTERN = /^[a-zA-Z0-9_\-.]{1,128}$/;

export class SecurityManager {
  private allowedOrigins: Set<string>;
  private rateLimiter: RateLimiter;
  private toolExposedTo: Map<string, string[]> = new Map();
  private toolAnnotations: Map<string, ToolAnnotations> = new Map();
  private debug: boolean;

  constructor(options: SecurityManagerOptions = {}, debug: boolean = false) {
    this.allowedOrigins = new Set(options.allowedOrigins ?? []);
    this.rateLimiter = new RateLimiter(options.defaultRateLimit);
    this.debug = debug;

    // Configure per-tool rate limits
    if (options.rateLimits) {
      for (const [toolName, config] of Object.entries(options.rateLimits)) {
        this.rateLimiter.setLimit(toolName, config);
      }
    }
  }

  /**
   * Validate a tool registration request
   */
  validateRegistration(
    tool: ToolDefinition,
    options?: RegisterOptions
  ): SecurityValidationResult {
    // Validate tool name
    if (!tool.name || typeof tool.name !== 'string') {
      return { valid: false, reason: 'Tool name is required and must be a string' };
    }

    if (!TOOL_NAME_PATTERN.test(tool.name)) {
      return {
        valid: false,
        reason: `Tool name "${tool.name}" must be 1-128 characters and contain only alphanumeric characters, underscores, hyphens, and periods`,
      };
    }

    // Validate description
    if (!tool.description || typeof tool.description !== 'string' || tool.description.trim().length === 0) {
      return { valid: false, reason: `Tool "${tool.name}" must have a non-empty description` };
    }

    // Validate inputSchema
    if (!tool.inputSchema) {
      return { valid: false, reason: `Tool "${tool.name}" must have an inputSchema` };
    }

    if (!isValidJsonSchema(tool.inputSchema)) {
      return { valid: false, reason: `Tool "${tool.name}" has an invalid inputSchema` };
    }

    // Validate outputSchema if provided
    if (tool.outputSchema && !isValidJsonSchema(tool.outputSchema)) {
      return { valid: false, reason: `Tool "${tool.name}" has an invalid outputSchema` };
    }

    // Validate execute function
    if (typeof tool.execute !== 'function') {
      return { valid: false, reason: `Tool "${tool.name}" must have an execute function` };
    }

    // Validate cross-origin exposure
    if (options?.exposedTo) {
      for (const origin of options.exposedTo) {
        const originValidation = this.validateOrigin(origin);
        if (!originValidation.valid) {
          return {
            valid: false,
            reason: `Tool "${tool.name}" exposedTo contains invalid origin: ${originValidation.reason}`,
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Validate a tool execution request
   */
  validateExecution(
    toolName: string,
    callerOrigin: string,
    args: Record<string, unknown>
  ): SecurityValidationResult {
    // Check rate limit
    if (!this.rateLimiter.check(toolName)) {
      const waitTime = this.rateLimiter.getWaitTime(toolName);
      return {
        valid: false,
        reason: `Rate limit exceeded for tool "${toolName}". Try again in ${waitTime}ms`,
      };
    }

    // Check origin permissions
    const originCheck = this.checkOriginPermission(toolName, callerOrigin);
    if (!originCheck.valid) {
      return originCheck;
    }

    return { valid: true };
  }

  /**
   * Register security metadata for a tool
   */
  registerToolSecurity(
    toolName: string,
    options?: RegisterOptions,
    annotations?: ToolAnnotations
  ): void {
    if (options?.exposedTo) {
      this.toolExposedTo.set(toolName, options.exposedTo);
    }

    if (annotations || options?.annotations) {
      this.toolAnnotations.set(toolName, {
        ...annotations,
        ...options?.annotations,
      });
    }

    // Set per-tool rate limit if provided
    if (options?.rateLimit) {
      this.rateLimiter.setLimit(toolName, options.rateLimit);
    }
  }

  /**
   * Remove security metadata for a tool
   */
  unregisterToolSecurity(toolName: string): void {
    this.toolExposedTo.delete(toolName);
    this.toolAnnotations.delete(toolName);
    this.rateLimiter.removeLimit(toolName);
  }

  /**
   * Get annotations for a tool
   */
  getAnnotations(toolName: string): ToolAnnotations | undefined {
    return this.toolAnnotations.get(toolName);
  }

  /**
   * Get origins a tool is exposed to
   */
  getExposedTo(toolName: string): string[] {
    return this.toolExposedTo.get(toolName) ?? [];
  }

  /**
   * Check if a caller origin has permission to execute a tool
   */
  private checkOriginPermission(
    toolName: string,
    callerOrigin: string
  ): SecurityValidationResult {
    // Get current page origin
    let pageOrigin = '';
    if (typeof window !== 'undefined' && window.location) {
      pageOrigin = window.location.origin;
    }

    // Same-origin: always allowed
    if (callerOrigin === pageOrigin || callerOrigin === '') {
      return { valid: true };
    }

    // Cross-origin: check exposedTo list
    const exposedTo = this.toolExposedTo.get(toolName);
    if (!exposedTo || exposedTo.length === 0) {
      return {
        valid: false,
        reason: `Tool "${toolName}" is not exposed to origin "${callerOrigin}"`,
      };
    }

    if (!exposedTo.includes(callerOrigin)) {
      return {
        valid: false,
        reason: `Tool "${toolName}" is not exposed to origin "${callerOrigin}". Allowed origins: ${exposedTo.join(', ')}`,
      };
    }

    // Also check global allowed origins
    if (this.allowedOrigins.size > 0 && !this.allowedOrigins.has(callerOrigin)) {
      return {
        valid: false,
        reason: `Origin "${callerOrigin}" is not in the global allowed origins list`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate that an origin string is properly formatted
   */
  private validateOrigin(origin: string): SecurityValidationResult {
    if (typeof origin !== 'string' || origin.trim().length === 0) {
      return { valid: false, reason: 'Origin must be a non-empty string' };
    }

    // Must be a valid URL origin (scheme + host + optional port)
    try {
      const url = new URL(origin);
      if (!url.protocol || !url.host) {
        return { valid: false, reason: `Origin "${origin}" must include protocol and host` };
      }
      // Origin should not have a pathname
      if (url.pathname !== '/' || url.search || url.hash) {
        return {
          valid: false,
          reason: `Origin "${origin}" should not include path, query, or hash`,
        };
      }
      return { valid: true };
    } catch {
      return { valid: false, reason: `Origin "${origin}" is not a valid URL` };
    }
  }

  /**
   * Add an allowed origin globally
   */
  addAllowedOrigin(origin: string): SecurityValidationResult {
    const validation = this.validateOrigin(origin);
    if (!validation.valid) return validation;
    this.allowedOrigins.add(origin);
    return { valid: true };
  }

  /**
   * Remove an allowed origin
   */
  removeAllowedOrigin(origin: string): void {
    this.allowedOrigins.delete(origin);
  }

  /**
   * Get the rate limiter instance
   */
  getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    this.rateLimiter.destroy();
    this.toolExposedTo.clear();
    this.toolAnnotations.clear();
    this.allowedOrigins.clear();
  }
}
