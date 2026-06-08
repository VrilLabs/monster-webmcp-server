/**
 * MonsterWebMCP - Polyfill Transport
 * Spec-compliant fallback when native document.modelContext is unavailable
 * Implements the WebMCP API surface in pure JavaScript
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

type PolyfillTransportEvents = {
  change: ToolChangeEvent;
  [key: string]: unknown;
};

/**
 * Observer-based tool discovery that mimics the native browser observation
 * mechanism. Desktop MCP clients and extensions can poll getTools() or
 * subscribe to change events to discover available tools.
 */
export class PolyfillTransport implements Transport {
  readonly type: TransportType = 'polyfill';
  private tools: Map<string, ToolDefinition> = new Map();
  private emitter: TypeSafeEventEmitter<PolyfillTransportEvents>;
  private destroyed = false;

  // Global registry for cross-instance access (e.g., from extensions)
  private static globalRegistry: Map<string, ToolInfo> = new Map();
  private static globalListeners: Set<(event: ToolChangeEvent) => void> = new Set();

  constructor() {
    this.emitter = new TypeSafeEventEmitter<PolyfillTransportEvents>();

    // Expose on window for extension/devtools access
    if (typeof window !== 'undefined') {
      this.exposeGlobal();
    }
  }

  registerTool(tool: ToolDefinition): void {
    if (this.destroyed) {
      throw new Error('PolyfillTransport has been destroyed');
    }

    const isUpdate = this.tools.has(tool.name);
    this.tools.set(tool.name, tool);

    const event: ToolChangeEvent = {
      type: isUpdate ? 'updated' : 'registered',
      toolName: tool.name,
      tool: this.toToolInfo(tool),
    };

    this.emitter.emit('change', event);

    // Update global registry
    PolyfillTransport.globalRegistry.set(tool.name, this.toToolInfo(tool));
    this.notifyGlobalListeners(event);
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

    // Update global registry
    PolyfillTransport.globalRegistry.delete(name);
    this.notifyGlobalListeners(event);
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
      throw new Error('PolyfillTransport has been destroyed');
    }

    const tool = this.tools.get(name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Tool "${name}" not found` }],
        isError: true,
      };
    }

    // Check abort signal
    if (signal?.aborted) {
      return {
        content: [{ type: 'text', text: `Tool execution aborted` }],
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

    // Remove tools from global registry
    for (const name of this.tools.keys()) {
      PolyfillTransport.globalRegistry.delete(name);
    }

    this.tools.clear();
    this.emitter.destroy();
    this.unexposeGlobal();
  }

  /**
   * Get the global tool registry (for extension/relay access)
   */
  static getGlobalTools(): ToolInfo[] {
    return Array.from(this.globalRegistry.values());
  }

  /**
   * Subscribe to global tool change events (for extension/relay access)
   */
  static onGlobalToolChange(callback: (event: ToolChangeEvent) => void): () => void {
    this.globalListeners.add(callback);
    return () => {
      this.globalListeners.delete(callback);
    };
  }

  private notifyGlobalListeners(event: ToolChangeEvent): void {
    for (const listener of PolyfillTransport.globalListeners) {
      try {
        listener(event);
      } catch {
        // Swallow errors
      }
    }
  }

  private exposeGlobal(): void {
    if (typeof window === 'undefined') return;

    const self = this;

    // Create __monsterWebMCP global namespace
    const existing = (window as unknown as Record<string, unknown>).__monsterWebMCP as
      | Record<string, unknown>
      | undefined;

    if (!existing) {
      const namespace: Record<string, unknown> = {
        getTools: () => self.getTools(),
        executeTool: (name: string, args: Record<string, unknown>) =>
          self.executeTool(name, args),
        onToolChange: (cb: (event: ToolChangeEvent) => void) => self.onToolChange(cb),
        version: '1.0.0',
      };
      (window as unknown as Record<string, unknown>).__monsterWebMCP = namespace;
    }
  }

  private unexposeGlobal(): void {
    if (typeof window === 'undefined') return;
    delete (window as unknown as Record<string, unknown>).__monsterWebMCP;
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
