/**
 * MonsterWebMCP - In-Memory Transport
 * Final fallback when neither native WebMCP nor polyfill is available
 * (e.g., SSR, test environments, restricted contexts)
 */

import type {
  Transport,
  TransportType,
  ToolDefinition,
  ToolInfo,
  ToolResult,
  ToolChangeEvent,
} from '../core/types';
import { TypeSafeEventEmitter } from '../utils/event-emitter';

type MemoryTransportEvents = {
  change: ToolChangeEvent;
  [key: string]: unknown;
};

export class MemoryTransport implements Transport {
  readonly type: TransportType = 'memory';
  private tools: Map<string, ToolDefinition> = new Map();
  private emitter: TypeSafeEventEmitter<MemoryTransportEvents>;
  private destroyed = false;

  constructor() {
    this.emitter = new TypeSafeEventEmitter<MemoryTransportEvents>();
  }

  registerTool(tool: ToolDefinition): void {
    if (this.destroyed) {
      throw new Error('MemoryTransport has been destroyed');
    }

    const isUpdate = this.tools.has(tool.name);
    this.tools.set(tool.name, tool);

    this.emitter.emit('change', {
      type: isUpdate ? 'updated' : 'registered',
      toolName: tool.name,
      tool: this.toToolInfo(tool),
    });
  }

  unregisterTool(name: string): void {
    if (this.destroyed) return;
    if (!this.tools.has(name)) return;

    this.tools.delete(name);

    this.emitter.emit('change', {
      type: 'unregistered',
      toolName: name,
    });
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
      throw new Error('MemoryTransport has been destroyed');
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

    try {
      return await tool.execute(args, signal);
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

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.tools.clear();
    this.emitter.destroy();
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
