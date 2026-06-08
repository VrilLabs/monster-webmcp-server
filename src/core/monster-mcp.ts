/**
 * MonsterWebMCP - Main MonsterMCP Class
 * Spec-aligned API matching W3C WebMCP document.modelContext
 * The central orchestrator for tool registration, execution, and lifecycle
 */

import type {
  MonsterMCPOptions,
  ToolDefinition,
  ToolInfo,
  ToolResult,
  ToolChangeEvent,
  RegisterOptions,
  Transport,
  TransportConfig,
  ToolAnnotations,
} from './types';
import { TransportFactory } from '../transport/transport-factory';
import { HTTPTransport } from '../transport/http-transport';
import { ToolRegistry } from './tool-registry';
import { SecurityManager } from '../security/security-manager';
import { DeclarativeProcessor } from '../declarative/form-processor';
import { validateArguments, formatValidationErrors } from '../utils/schema-validator';

export class MonsterMCP {
  private transport: Transport;
  private httpTransport: HTTPTransport | null = null;
  private registry: ToolRegistry;
  private security: SecurityManager;
  private declarativeProcessor: DeclarativeProcessor | null = null;
  private abortControllers: Map<string, AbortController> = new Map();
  private destroyed = false;
  private debug: boolean;

  constructor(options: MonsterMCPOptions = {}) {
    this.debug = options.debug ?? false;

    // Initialize tool registry
    this.registry = new ToolRegistry();

    // Initialize security manager
    this.security = new SecurityManager(
      {
        allowedOrigins: options.allowedOrigins,
        rateLimits: options.rateLimits,
        defaultRateLimit: options.defaultRateLimit,
      },
      this.debug
    );

    // Transport auto-detection
    const transportConfig: TransportConfig = {
      native: options.webmcp !== false,
      polyfill: options.polyfill !== false,
      traditional: options.traditionalMcp === true,
      transportConfig: options.mcpTransport,
    };

    this.transport = TransportFactory.create(transportConfig);

    // Set up HTTP/SSE transport if traditional MCP is enabled
    if (options.traditionalMcp) {
      this.httpTransport = TransportFactory.createHTTPTransport(transportConfig);
    }

    // Wire up registry change events to transport
    this.registry.onToolChange((event) => {
      this.handleRegistryChange(event);
    });

    // Initialize declarative form processor
    if (options.declarative !== false && typeof document !== 'undefined') {
      this.declarativeProcessor = new DeclarativeProcessor(this);
    }

    this.log('MonsterMCP initialized', {
      transportType: this.transport.type,
      nativeAvailable: TransportFactory.isNativeAvailable(),
      httpTransport: this.httpTransport !== null,
    });
  }

  /**
   * Register a tool with the MCP runtime
   * Spec-aligned with W3C document.modelContext.registerTool()
   */
  registerTool(tool: ToolDefinition, options?: RegisterOptions): void {
    if (this.destroyed) {
      throw new Error('MonsterMCP has been destroyed');
    }

    // Security validation
    const securityResult = this.security.validateRegistration(tool, options);
    if (!securityResult.valid) {
      throw new Error(`Tool registration failed: ${securityResult.reason}`);
    }

    // Check for duplicate registration
    if (this.registry.has(tool.name) && !options?.signal) {
      // Update existing tool
      this.log(`Updating existing tool: ${tool.name}`);
    }

    // Handle AbortSignal
    if (options?.signal) {
      const existingController = this.abortControllers.get(tool.name);
      if (existingController) {
        existingController.abort();
      }

      const controller = new AbortController();
      this.abortControllers.set(tool.name, controller);

      options.signal.addEventListener('abort', () => {
        this.unregisterTool(tool.name);
        this.abortControllers.delete(tool.name);
      });
    }

    // Register security metadata
    this.security.registerToolSecurity(tool.name, options, tool.annotations);

    // Register in local registry
    this.registry.register(tool, options);

    // Register in transport
    this.transport.registerTool(tool);

    // Register in HTTP transport if available
    if (this.httpTransport) {
      this.httpTransport.registerTool(tool);
    }

    this.log(`Tool registered: ${tool.name}`);
  }

  /**
   * Unregister a tool by name
   */
  unregisterTool(name: string): void {
    if (this.destroyed) return;

    if (!this.registry.has(name)) {
      this.log(`Attempted to unregister unknown tool: ${name}`);
      return;
    }

    // Clean up abort controller
    const controller = this.abortControllers.get(name);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(name);
    }

    // Remove security metadata
    this.security.unregisterToolSecurity(name);

    // Remove from transport
    this.transport.unregisterTool(name);

    // Remove from HTTP transport
    if (this.httpTransport) {
      this.httpTransport.unregisterTool(name);
    }

    // Remove from registry
    this.registry.unregister(name);

    this.log(`Tool unregistered: ${name}`);
  }

  /**
   * Get all registered tools
   */
  getTools(): ToolInfo[] {
    return this.registry.getTools();
  }

  /**
   * Execute a tool by name with the given arguments
   */
  async executeTool(
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<ToolResult> {
    if (this.destroyed) {
      throw new Error('MonsterMCP has been destroyed');
    }

    // Check if tool exists
    const tool = this.registry.get(name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Tool "${name}" not found` }],
        isError: true,
      };
    }

    // Security validation
    let callerOrigin = '';
    if (typeof window !== 'undefined' && window.location) {
      callerOrigin = window.location.origin;
    }

    const securityResult = this.security.validateExecution(name, callerOrigin, args);
    if (!securityResult.valid) {
      return {
        content: [{ type: 'text', text: securityResult.reason ?? 'Security validation failed' }],
        isError: true,
      };
    }

    // Input schema validation
    const validationResult = validateArguments(args, tool.inputSchema);
    if (!validationResult.valid) {
      return {
        content: [
          {
            type: 'text',
            text: `Input validation failed: ${formatValidationErrors(validationResult.errors)}`,
          },
        ],
        isError: true,
      };
    }

    // Get abort signal if available
    const controller = this.abortControllers.get(name);
    const signal = controller?.signal;

    // Execute via transport
    this.log(`Executing tool: ${name}`, args);

    try {
      const result = await this.transport.executeTool(name, args, signal);
      this.log(`Tool executed: ${name}`, { isError: result.isError });
      return result;
    } catch (error) {
      const errorResult: ToolResult = {
        content: [
          {
            type: 'text',
            text: error instanceof Error ? error.message : String(error),
          },
        ],
        isError: true,
      };
      this.log(`Tool execution failed: ${name}`, errorResult);
      return errorResult;
    }
  }

  /**
   * Subscribe to tool change events
   * Returns an unsubscribe function
   */
  onToolChange(callback: (event: ToolChangeEvent) => void): () => void {
    if (this.destroyed) {
      return () => {};
    }

    // Subscribe to both registry and transport changes
    const unsubRegistry = this.registry.onToolChange(callback);
    const unsubTransport = this.transport.onToolChange(callback);

    return () => {
      unsubRegistry();
      unsubTransport();
    };
  }

  /**
   * Get the transport type being used
   */
  getTransportType(): string {
    return this.transport.type;
  }

  /**
   * Check if native WebMCP is available
   */
  isNativeAvailable(): boolean {
    return TransportFactory.isNativeAvailable();
  }

  /**
   * Get tool annotations
   */
  getToolAnnotations(name: string): ToolAnnotations | undefined {
    return this.security.getAnnotations(name);
  }

  /**
   * Get origins a tool is exposed to
   */
  getToolExposedTo(name: string): string[] {
    return this.security.getExposedTo(name);
  }

  /**
   * Add a globally allowed origin
   */
  addAllowedOrigin(origin: string): void {
    const result = this.security.addAllowedOrigin(origin);
    if (!result.valid) {
      throw new Error(result.reason);
    }
  }

  /**
   * Remove a globally allowed origin
   */
  removeAllowedOrigin(origin: string): void {
    this.security.removeAllowedOrigin(origin);
  }

  /**
   * Destroy the MonsterMCP instance and clean up all resources
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.log('Destroying MonsterMCP');

    // Abort all pending operations
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.abortControllers.clear();

    // Destroy declarative processor
    if (this.declarativeProcessor) {
      this.declarativeProcessor.destroy();
      this.declarativeProcessor = null;
    }

    // Destroy HTTP transport
    if (this.httpTransport) {
      this.httpTransport.destroy();
      this.httpTransport = null;
    }

    // Destroy main transport
    this.transport.destroy();

    // Destroy registry
    this.registry.destroy();

    // Destroy security manager
    this.security.destroy();
  }

  /**
   * Handle registry change events
   */
  private handleRegistryChange(_event: ToolChangeEvent): void {
    // Additional processing when tools change
    // Could be extended to notify connected clients, etc.
  }

  /**
   * Debug logging
   */
  private log(message: string, data?: unknown): void {
    if (!this.debug) return;
    if (typeof console !== 'undefined' && console.log) {
      console.log(`[MonsterWebMCP] ${message}`, data ?? '');
    }
  }
}
