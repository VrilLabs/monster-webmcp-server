/**
 * MonsterWebMCP - Core Type Definitions
 * Spec-aligned types matching W3C WebMCP document.modelContext
 */

// ─── JSON Schema Types ────────────────────────────────────────────────

export interface JSONSchemaProperty {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';
  description?: string;
  enum?: string[];
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  additionalProperties?: boolean | JSONSchemaProperty;
}

export interface JSONSchema {
  type: 'object';
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean | JSONSchemaProperty;
  $schema?: string;
  definitions?: Record<string, JSONSchemaProperty>;
}

// ─── Tool Annotations (W3C WebMCP Spec) ──────────────────────────────

export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  untrustedContentHint?: boolean;
}

// ─── Tool Content Types ───────────────────────────────────────────────

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  data: string;
  mimeType: string;
}

export interface EmbeddedResource {
  type: 'resource';
  resource: {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  };
}

export type ToolContent = TextContent | ImageContent | EmbeddedResource;

// ─── Tool Result ──────────────────────────────────────────────────────

export interface ToolResult {
  content: ToolContent[];
  isError?: boolean;
}

// ─── Tool Definition ──────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  title?: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema?: JSONSchema;
  annotations?: ToolAnnotations;
  execute: (args: Record<string, unknown>, signal?: AbortSignal) => Promise<ToolResult>;
}

// ─── Tool Info (read-only view exposed via getTools) ──────────────────

export interface ToolInfo {
  name: string;
  title?: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema?: JSONSchema;
  annotations?: ToolAnnotations;
}

// ─── Tool Change Event ────────────────────────────────────────────────

export type ToolChangeType = 'registered' | 'unregistered' | 'updated';

export interface ToolChangeEvent {
  type: ToolChangeType;
  toolName: string;
  tool?: ToolInfo;
}

// ─── Registration Options ─────────────────────────────────────────────

export interface RegisterOptions {
  signal?: AbortSignal;
  exposedTo?: string[];
  rateLimit?: RateLimitConfig;
  annotations?: ToolAnnotations;
}

// ─── Rate Limiting ────────────────────────────────────────────────────

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

// ─── Transport Configuration ──────────────────────────────────────────

export type TransportType = 'native' | 'polyfill' | 'memory' | 'http';

export interface TransportConfig {
  native: boolean;
  polyfill: boolean;
  traditional: boolean;
  transportConfig?: MCPTransportConfig;
}

export interface MCPTransportConfig {
  type: 'http' | 'sse';
  port?: number;
  cors?: boolean;
  auth?: 'bearer' | 'none';
  tokenEnvVar?: string;
  token?: string;
  endpoint?: string;
}

// ─── MonsterMCP Options ───────────────────────────────────────────────

export interface MonsterMCPOptions {
  webmcp?: boolean;
  polyfill?: boolean;
  traditionalMcp?: boolean;
  mcpTransport?: MCPTransportConfig;
  declarative?: boolean;
  allowedOrigins?: string[];
  rateLimits?: Record<string, RateLimitConfig>;
  defaultRateLimit?: RateLimitConfig;
  debug?: boolean;
}

// ─── Transport Interface ──────────────────────────────────────────────

export interface Transport {
  readonly type: TransportType;
  registerTool(tool: ToolDefinition): void;
  unregisterTool(name: string): void;
  getTools(): ToolInfo[];
  executeTool(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<ToolResult>;
  onToolChange(callback: (event: ToolChangeEvent) => void): () => void;
  destroy(): void;
}

// ─── Native ModelContext Interface (W3C WebMCP) ──────────────────────

export interface NativeModelContextTool {
  name: string;
  title?: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema?: JSONSchema;
  annotations?: ToolAnnotations;
}

export interface NativeToolRegistration {
  unregister(): void;
}

export interface NativeModelContext {
  registerTool(
    tool: NativeModelContextTool,
    execute: (args: Record<string, unknown>) => Promise<ToolResult>,
    options?: { signal?: AbortSignal; exposedTo?: string[] }
  ): Promise<NativeToolRegistration>;
  getTools(): NativeModelContextTool[];
  onToolChange(callback: (event: { type: string; toolName: string }) => void): () => void;
}

// Augment Document to include modelContext
declare global {
  interface Document {
    modelContext?: NativeModelContext;
  }
}

// ─── Security Validation Result ───────────────────────────────────────

export interface SecurityValidationResult {
  valid: boolean;
  reason?: string;
}

// ─── MCP JSON-RPC Types ───────────────────────────────────────────────

export interface MCPRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id?: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface MCPCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  logging?: Record<string, unknown>;
}

export interface MCPServerInfo {
  name: string;
  version: string;
}

export interface MCPInitializeResult {
  capabilities: MCPCapabilities;
  serverInfo: MCPServerInfo;
  protocolVersion: string;
}

// ─── HTTP Server Config ───────────────────────────────────────────────

export interface HTTPServerConfig {
  port?: number;
  authToken?: string;
  cors?: boolean;
  corsOrigins?: string[];
}

// ─── Local Relay Config ───────────────────────────────────────────────

export interface LocalRelayConfig {
  port?: number;
  authToken?: string;
}
