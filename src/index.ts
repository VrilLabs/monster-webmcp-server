/**
 * MonsterWebMCP - Main Entry Point
 * Public API exports for the MonsterWebMCP runtime
 */

// Core
export { MonsterMCP } from './core/monster-mcp';
export type {
  MonsterMCPOptions,
  ToolDefinition,
  ToolInfo,
  ToolResult,
  ToolContent,
  ToolChangeEvent,
  ToolChangeType,
  RegisterOptions,
  ToolAnnotations,
  JSONSchema,
  JSONSchemaProperty,
  TextContent,
  ImageContent,
  EmbeddedResource,
  RateLimitConfig,
  MCPTransportConfig,
  TransportType,
  TransportConfig,
  SecurityValidationResult,
  MCPRequest,
  MCPResponse,
  MCPInitializeResult,
  HTTPServerConfig,
  LocalRelayConfig,
} from './core/types';

// Transport
export { TransportFactory } from './transport/transport-factory';
export { NativeTransport } from './transport/native-transport';
export { PolyfillTransport } from './transport/polyfill-transport';
export { MemoryTransport } from './transport/memory-transport';
export { HTTPTransport } from './transport/http-transport';

// Security
export { SecurityManager } from './security/security-manager';
export { RateLimiter } from './security/rate-limiter';

// Declarative
export { DeclarativeProcessor } from './declarative/form-processor';

// Utils
export { TypeSafeEventEmitter } from './utils/event-emitter';
export { validateArguments, isValidJsonSchema, formatValidationErrors } from './utils/schema-validator';

// Server (conditionally available in Node/Bun environments)
export { LocalRelay } from './server/local-relay';
export { HTTPMCPServer } from './server/http-server';

// Tool Registry
export { ToolRegistry } from './core/tool-registry';
