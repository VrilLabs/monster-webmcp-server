/**
 * MonsterWebMCP - Tool Registry
 * Manages tool definitions, lifecycle, and change notifications
 */

import type {
  ToolDefinition,
  ToolInfo,
  ToolChangeEvent,
  RegisterOptions,
} from '../core/types';
import { TypeSafeEventEmitter } from '../utils/event-emitter';

type ToolRegistryEvents = {
  change: ToolChangeEvent;
  [key: string]: unknown;
};

interface RegisteredTool {
  definition: ToolDefinition;
  options?: RegisterOptions;
  registeredAt: number;
}

export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  private emitter: TypeSafeEventEmitter<ToolRegistryEvents>;
  private destroyed = false;

  constructor() {
    this.emitter = new TypeSafeEventEmitter<ToolRegistryEvents>();
  }

  /**
   * Register a tool
   */
  register(tool: ToolDefinition, options?: RegisterOptions): void {
    if (this.destroyed) {
      throw new Error('ToolRegistry has been destroyed');
    }

    const isUpdate = this.tools.has(tool.name);
    this.tools.set(tool.name, {
      definition: tool,
      options,
      registeredAt: Date.now(),
    });

    const event: ToolChangeEvent = {
      type: isUpdate ? 'updated' : 'registered',
      toolName: tool.name,
      tool: this.toToolInfo(tool),
    };

    this.emitter.emit('change', event);
  }

  /**
   * Unregister a tool by name
   */
  unregister(name: string): boolean {
    if (this.destroyed) return false;
    if (!this.tools.has(name)) return false;

    this.tools.delete(name);

    this.emitter.emit('change', {
      type: 'unregistered',
      toolName: name,
    });

    return true;
  }

  /**
   * Get a tool definition by name
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name)?.definition;
  }

  /**
   * Get registration options for a tool
   */
  getOptions(name: string): RegisterOptions | undefined {
    return this.tools.get(name)?.options;
  }

  /**
   * Get all registered tools as ToolInfo
   */
  getTools(): ToolInfo[] {
    return Array.from(this.tools.values()).map((entry) =>
      this.toToolInfo(entry.definition)
    );
  }

  /**
   * Get all tool definitions
   */
  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((entry) => entry.definition);
  }

  /**
   * Check if a tool is registered
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get the number of registered tools
   */
  get size(): number {
    return this.tools.size;
  }

  /**
   * Get tool names
   */
  get names(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Subscribe to tool change events
   */
  onToolChange(callback: (event: ToolChangeEvent) => void): () => void {
    return this.emitter.on('change', callback);
  }

  /**
   * Destroy the registry and clean up
   */
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
