/**
 * MonsterWebMCP - Native Transport
 * Bridges to the native document.modelContext API (Chrome 146+)
 * This is the PRIMARY transport when WebMCP is available natively
 */

import type {
  Transport,
  TransportType,
  ToolDefinition,
  ToolInfo,
  ToolResult,
  ToolChangeEvent,
  NativeModelContext,
  NativeToolRegistration,
} from '../core/types';
import { TypeSafeEventEmitter } from '../utils/event-emitter';

type NativeTransportEvents = {
  change: ToolChangeEvent;
  [key: string]: unknown;
};

export class NativeTransport implements Transport {
  readonly type: TransportType = 'native';
  private modelContext: NativeModelContext;
  private registrations: Map<string, NativeToolRegistration> = new Map();
  private tools: Map<string, ToolDefinition> = new Map();
  private emitter: TypeSafeEventEmitter<NativeTransportEvents>;
  private nativeUnsubscribe: (() => void) | null = null;
  private destroyed = false;

  constructor(modelContext: NativeModelContext) {
    this.modelContext = modelContext;
    this.emitter = new TypeSafeEventEmitter<NativeTransportEvents>();

    // Listen for native tool change events
    try {
      this.nativeUnsubscribe = this.modelContext.onToolChange((event) => {
        this.emitter.emit('change', {
          type: event.type as ToolChangeEvent['type'],
          toolName: event.toolName,
        });
      });
    } catch {
      // onToolChange may not be available in all native implementations
    }
  }

  async registerTool(tool: ToolDefinition): Promise<void> {
    if (this.destroyed) {
      throw new Error('NativeTransport has been destroyed');
    }

    // Store the tool definition locally
    this.tools.set(tool.name, tool);

    // Register with native document.modelContext
    try {
      const registration = await this.modelContext.registerTool(
        {
          name: tool.name,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema,
          annotations: tool.annotations,
        },
        (args: Record<string, unknown>) => tool.execute(args),
        {}
      );

      this.registrations.set(tool.name, registration);

      this.emitter.emit('change', {
        type: 'registered',
        toolName: tool.name,
        tool: this.toToolInfo(tool),
      });
    } catch (error) {
      // If native registration fails, keep tool locally but log
      this.emitter.emit('change', {
        type: 'registered',
        toolName: tool.name,
        tool: this.toToolInfo(tool),
      });
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(`[MonsterWebMCP] Native registration failed for "${tool.name}":`, error);
      }
    }
  }

  unregisterTool(name: string): void {
    if (this.destroyed) return;

    const registration = this.registrations.get(name);
    if (registration) {
      try {
        registration.unregister();
      } catch {
        // Swallow errors during unregistration
      }
      this.registrations.delete(name);
    }

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
      throw new Error('NativeTransport has been destroyed');
    }

    const tool = this.tools.get(name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Tool "${name}" not found` }],
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

    // Unregister all tools from native API
    for (const [name, registration] of this.registrations.entries()) {
      try {
        registration.unregister();
      } catch {
        // Swallow errors
      }
    }
    this.registrations.clear();
    this.tools.clear();

    // Unsubscribe from native events
    if (this.nativeUnsubscribe) {
      try {
        this.nativeUnsubscribe();
      } catch {
        // Swallow errors
      }
      this.nativeUnsubscribe = null;
    }

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
