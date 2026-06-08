/**
 * MonsterWebMCP - HTTP/SSE MCP Transport
 * Opt-in transport for connecting to traditional MCP clients via HTTP
 * Implements the MCP JSON-RPC protocol over HTTP POST + SSE
 */

import type {
  Transport,
  TransportType,
  ToolDefinition,
  ToolInfo,
  ToolResult,
  ToolChangeEvent,
  MCPTransportConfig,
} from '../core/types';
import { TypeSafeEventEmitter } from '../utils/event-emitter';

type HTTPTransportEvents = {
  change: ToolChangeEvent;
  [key: string]: unknown;
};

export class HTTPTransport implements Transport {
  readonly type: TransportType = 'http';
  private tools: Map<string, ToolDefinition> = new Map();
  private emitter: TypeSafeEventEmitter<HTTPTransportEvents>;
  private config: MCPTransportConfig;
  private destroyed = false;
  private eventSource: EventSource | null = null;

  constructor(config: MCPTransportConfig) {
    this.config = config;
    this.emitter = new TypeSafeEventEmitter<HTTPTransportEvents>();

    // Connect to SSE endpoint for real-time tool change notifications
    if (config.type === 'sse' && config.endpoint) {
      this.connectSSE();
    }
  }

  registerTool(tool: ToolDefinition): void {
    if (this.destroyed) {
      throw new Error('HTTPTransport has been destroyed');
    }

    const isUpdate = this.tools.has(tool.name);
    this.tools.set(tool.name, tool);

    const event: ToolChangeEvent = {
      type: isUpdate ? 'updated' : 'registered',
      toolName: tool.name,
      tool: this.toToolInfo(tool),
    };

    this.emitter.emit('change', event);

    // Notify remote endpoint about tool registration
    this.notifyRemote('tool_registered', {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    });
  }

  unregisterTool(name: string): void {
    if (this.destroyed) return;
    if (!this.tools.has(name)) return;

    this.tools.delete(name);

    const event: ToolChangeEvent = {
      type: 'unregistered',
      toolName: name,
    };

    this.emitter.emit('change', event);

    // Notify remote endpoint about tool unregistration
    this.notifyRemote('tool_unregistered', { name });
  }

  getTools(): ToolInfo[] {
    return Array.from(this.tools.values()).map((t) => this.toToolInfo(t));
  }

  async executeTool(
    name: string,
    args: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<ToolResult> {
    if (this.destroyed) {
      throw new Error('HTTPTransport has been destroyed');
    }

    const tool = this.tools.get(name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Tool "${name}" not found` }],
        isError: true,
      };
    }

    if (signal?.aborted) {
      return {
        content: [{ type: 'text', text: 'Tool execution aborted' }],
        isError: true,
      };
    }

    // Execute locally first
    try {
      const result = await tool.execute(args, signal);

      // Also forward execution result to remote if configured
      this.notifyRemote('tool_executed', {
        name,
        args,
        result,
      });

      return result;
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: error instanceof Error ? error.message : String(error),
          },
        ],
        isError: true,
      };
    }
  }

  onToolChange(callback: (event: ToolChangeEvent) => void): () => void {
    return this.emitter.on('change', callback);
  }

  /**
   * Send a JSON-RPC request to the remote MCP endpoint
   */
  async sendRequest(
    method: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    const endpoint = this.config.endpoint;
    if (!endpoint) {
      throw new Error('HTTP transport endpoint not configured');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.auth === 'bearer' && this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }

    const body = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      ...(params ? { params } : {}),
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`MCP Error ${data.error.code}: ${data.error.message}`);
    }

    return data.result;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.tools.clear();
    this.emitter.destroy();
  }

  /**
   * Connect to SSE endpoint for real-time notifications
   */
  private connectSSE(): void {
    if (typeof EventSource === 'undefined') return;

    const endpoint = this.config.endpoint;
    if (!endpoint) return;

    const sseUrl = endpoint.replace(/\/mcp$/, '/mcp/sse');

    try {
      this.eventSource = new EventSource(sseUrl);

      this.eventSource.addEventListener('tool_change', (event) => {
        try {
          const data = JSON.parse(event.data) as ToolChangeEvent;
          this.emitter.emit('change', data);
        } catch {
          // Ignore malformed events
        }
      });

      this.eventSource.onerror = () => {
        // Reconnect will be handled automatically by EventSource
      };
    } catch {
      // SSE not available, fall back to polling
    }
  }

  /**
   * Notify the remote endpoint about a tool change
   */
  private notifyRemote(
    event: string,
    data: Record<string, unknown>
  ): void {
    const endpoint = this.config.endpoint;
    if (!endpoint) return;

    // Fire-and-forget notification
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.auth === 'bearer' && this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }

    const body = {
      jsonrpc: '2.0',
      method: `notifications/${event}`,
      params: data,
    };

    fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }).catch(() => {
      // Fire-and-forget: swallow errors
    });
  }

  private toToolInfo(tool: ToolDefinition): ToolInfo {
    return {
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      annotations: tool.annotations,
    };
  }
}
