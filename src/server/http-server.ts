/**
 * MonsterWebMCP - HTTP MCP Server
 * Hono-based HTTP MCP server with Bearer auth, SSE support
 * Compatible with any HTTP-based MCP client
 */

import type {
  ToolDefinition,
  ToolInfo,
  ToolResult,
  MCPRequest,
  MCPResponse,
  MCPInitializeResult,
  HTTPServerConfig,
} from '../core/types';

/**
 * Lightweight HTTP server implementation using Bun's native HTTP server
 * (Hono is an optional dependency; we provide a built-in fallback)
 */
export class HTTPMCPServer {
  private port: number;
  private authToken: string | null;
  private cors: boolean;
  private corsOrigins: string[];
  private toolRegistry: Map<string, ToolDefinition> = new Map();
  private toolExecutor: ((name: string, args: Record<string, unknown>) => Promise<ToolResult>) | null = null;
  private server: any = null;
  private running = false;
  private sseClients: Set<any> = new Set();

  constructor(config: HTTPServerConfig = {}) {
    this.port = config.port ?? 3001;
    this.authToken = config.authToken ?? null;
    this.cors = config.cors ?? true;
    this.corsOrigins = config.corsOrigins ?? ['*'];
  }

  /**
   * Start the HTTP MCP server
   */
  async start(): Promise<void> {
    if (this.running) return;

    const Bun = (globalThis as any).Bun;
    if (!Bun) {
      throw new Error('HTTPMCPServer requires Bun runtime');
    }

    this.server = Bun.serve({
      port: this.port,
      fetch: async (req: Request) => this.handleRequest(req),
    });

    this.running = true;
    console.log(`[MonsterWebMCP] HTTP MCP server started on http://localhost:${this.port}/mcp`);
  }

  /**
   * Stop the HTTP MCP server
   */
  stop(): void {
    if (!this.running) return;

    // Close all SSE connections
    for (const client of this.sseClients) {
      try {
        client.close();
      } catch {
        // Swallow errors
      }
    }
    this.sseClients.clear();

    if (this.server) {
      try {
        this.server.stop?.();
      } catch {
        // Swallow errors
      }
      this.server = null;
    }

    this.running = false;
    console.log('[MonsterWebMCP] HTTP MCP server stopped');
  }

  /**
   * Register a tool with the server
   */
  registerTool(tool: ToolDefinition): void {
    this.toolRegistry.set(tool.name, tool);
    this.broadcastSSE('tool_registered', { name: tool.name });
  }

  /**
   * Unregister a tool from the server
   */
  unregisterTool(name: string): void {
    this.toolRegistry.delete(name);
    this.broadcastSSE('tool_unregistered', { name });
  }

  /**
   * Set the tool executor callback
   */
  setToolExecutor(executor: (name: string, args: Record<string, unknown>) => Promise<ToolResult>): void {
    this.toolExecutor = executor;
  }

  /**
   * Get all registered tools
   */
  getTools(): ToolInfo[] {
    return Array.from(this.toolRegistry.values()).map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      annotations: tool.annotations,
    }));
  }

  /**
   * Check if the server is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get the port the server is running on
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Handle incoming HTTP requests
   */
  private async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // CORS preflight
    if (req.method === 'OPTIONS') {
      return this.corsResponse(req);
    }

    // CORS headers for all responses
    const corsHeaders = this.cors ? this.getCorsHeaders(req) : {};

    // Health check
    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({ status: 'ok', tools: this.toolRegistry.size, version: '1.0.0' }),
        {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // SSE endpoint
    if (url.pathname === '/mcp/sse' && req.method === 'GET') {
      return this.handleSSE(req, corsHeaders);
    }

    // MCP endpoint
    if (url.pathname === '/mcp' && req.method === 'POST') {
      // Auth check
      if (this.authToken) {
        const auth = req.headers.get('Authorization');
        if (!auth || auth !== `Bearer ${this.authToken}`) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized', message: 'Valid Bearer token required' }),
            {
              status: 401,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        }
      }

      return this.handleMCPRequest(req, corsHeaders);
    }

    // 404 for all other paths
    return new Response('Not Found', {
      status: 404,
      headers: corsHeaders,
    });
  }

  /**
   * Handle MCP JSON-RPC requests
   */
  private async handleMCPRequest(req: Request, corsHeaders: Record<string, string>): Promise<Response> {
    let request: MCPRequest;
    try {
      request = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' } }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const response = await this.routeRequest(request);

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  /**
   * Handle SSE connection for real-time notifications
   */
  private handleSSE(req: Request, corsHeaders: Record<string, string>): Response {
    const stream = new ReadableStream({
      start: (controller) => {
        const encoder = new TextEncoder();

        // Send initial connection event
        controller.enqueue(
          encoder.encode(`event: connected\ndata: ${JSON.stringify({ message: 'MonsterWebMCP SSE endpoint', version: '1.0.0' })}\n\n`)
        );

        // Store the controller for later broadcasts
        const clientId = `sse_${Date.now()}`;
        const client = {
          id: clientId,
          send: (event: string, data: unknown) => {
            try {
              controller.enqueue(
                encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
              );
            } catch {
              // Client disconnected
              this.sseClients.delete(client);
            }
          },
          close: () => {
            try {
              controller.close();
            } catch {
              // Already closed
            }
          },
        };

        this.sseClients.add(client);

        // Send periodic keepalive
        const keepalive = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: keepalive\n\n`));
          } catch {
            clearInterval(keepalive);
            this.sseClients.delete(client);
          }
        }, 30000);

        // Clean up on abort
        req.signal.addEventListener('abort', () => {
          clearInterval(keepalive);
          this.sseClients.delete(client);
          try {
            controller.close();
          } catch {
            // Already closed
          }
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        ...corsHeaders,
      },
    });
  }

  /**
   * Route an MCP JSON-RPC request
   */
  private async routeRequest(request: MCPRequest): Promise<MCPResponse> {
    switch (request.method) {
      case 'initialize':
        return this.handleInitialize(request);

      case 'initialized':
        return { jsonrpc: '2.0', id: request.id ?? null, result: {} };

      case 'tools/list':
        return this.handleToolsList(request);

      case 'tools/call':
        return await this.handleToolsCall(request);

      case 'ping':
        return { jsonrpc: '2.0', id: request.id ?? null, result: {} };

      case 'completion/complete':
        return {
          jsonrpc: '2.0',
          id: request.id ?? null,
          result: { completion: { values: [], total: 0, hasMore: false } },
        };

      case 'logging/setLevel':
        return { jsonrpc: '2.0', id: request.id ?? null, result: {} };

      default:
        return {
          jsonrpc: '2.0',
          id: request.id ?? null,
          error: {
            code: -32601,
            message: `Method not found: ${request.method}`,
          },
        };
    }
  }

  /**
   * Handle MCP initialize
   */
  private handleInitialize(request: MCPRequest): MCPResponse {
    const result: MCPInitializeResult = {
      capabilities: {
        tools: {
          listChanged: true,
        },
      },
      serverInfo: {
        name: 'MonsterWebMCP HTTP Server',
        version: '1.0.0',
      },
      protocolVersion: '2025-03-26',
    };

    return {
      jsonrpc: '2.0',
      id: request.id ?? null,
      result,
    };
  }

  /**
   * Handle tools/list
   */
  private handleToolsList(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: request.id ?? null,
      result: {
        tools: this.getTools(),
      },
    };
  }

  /**
   * Handle tools/call
   */
  private async handleToolsCall(request: MCPRequest): Promise<MCPResponse> {
    const params = request.params ?? {};
    const toolName = params.name as string;
    const args = (params.arguments ?? {}) as Record<string, unknown>;

    const tool = this.toolRegistry.get(toolName);
    if (!tool) {
      return {
        jsonrpc: '2.0',
        id: request.id ?? null,
        error: {
          code: -32602,
          message: `Tool not found: ${toolName}`,
        },
      };
    }

    try {
      let result: ToolResult;

      if (this.toolExecutor) {
        result = await this.toolExecutor(toolName, args);
      } else {
        result = await tool.execute(args);
      }

      return {
        jsonrpc: '2.0',
        id: request.id ?? null,
        result,
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: request.id ?? null,
        result: {
          content: [
            {
              type: 'text',
              text: error instanceof Error ? error.message : String(error),
            },
          ],
          isError: true,
        },
      };
    }
  }

  /**
   * Broadcast an SSE event to all connected clients
   */
  private broadcastSSE(event: string, data: unknown): void {
    for (const client of this.sseClients) {
      try {
        client.send(event, data);
      } catch {
        this.sseClients.delete(client);
      }
    }
  }

  /**
   * Get CORS headers
   */
  private getCorsHeaders(req: Request): Record<string, string> {
    if (!this.cors) return {};

    const origin = req.headers.get('Origin') ?? '*';
    const allowedOrigin = this.corsOrigins.includes('*') ? '*' : 
      (this.corsOrigins.includes(origin) ? origin : '');

    return {
      'Access-Control-Allow-Origin': allowedOrigin || 'null',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };
  }

  /**
   * Handle CORS preflight request
   */
  private corsResponse(req: Request): Response {
    return new Response(null, {
      status: 204,
      headers: this.getCorsHeaders(req),
    });
  }
}
