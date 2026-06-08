// src/utils/event-emitter.ts
class TypeSafeEventEmitter {
  listeners = new Map;
  onceListeners = new Map;
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    const entry = { callback, once: false };
    this.listeners.get(event).push(entry);
    return () => {
      const list = this.listeners.get(event);
      if (list) {
        const idx = list.indexOf(entry);
        if (idx !== -1) {
          list.splice(idx, 1);
        }
      }
    };
  }
  once(event, callback) {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, []);
    }
    const entry = { callback, once: true };
    this.onceListeners.get(event).push(entry);
    return () => {
      const list = this.onceListeners.get(event);
      if (list) {
        const idx = list.indexOf(entry);
        if (idx !== -1) {
          list.splice(idx, 1);
        }
      }
    };
  }
  emit(event, data) {
    const list = this.listeners.get(event);
    if (list) {
      for (const entry of list) {
        try {
          if (data === undefined) {
            entry.callback();
          } else {
            entry.callback(data);
          }
        } catch {}
      }
    }
    const onceList = this.onceListeners.get(event);
    if (onceList && onceList.length > 0) {
      const entries = onceList.splice(0);
      for (const entry of entries) {
        try {
          if (data === undefined) {
            entry.callback();
          } else {
            entry.callback(data);
          }
        } catch {}
      }
    }
  }
  off(event) {
    if (event) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
    }
  }
  listenerCount(event) {
    const regular = this.listeners.get(event)?.length ?? 0;
    const once = this.onceListeners.get(event)?.length ?? 0;
    return regular + once;
  }
  destroy() {
    this.listeners.clear();
    this.onceListeners.clear();
  }
}

// src/transport/native-transport.ts
class NativeTransport {
  type = "native";
  modelContext;
  registrations = new Map;
  tools = new Map;
  emitter;
  nativeUnsubscribe = null;
  destroyed = false;
  constructor(modelContext) {
    this.modelContext = modelContext;
    this.emitter = new TypeSafeEventEmitter;
    try {
      this.nativeUnsubscribe = this.modelContext.onToolChange((event) => {
        this.emitter.emit("change", {
          type: event.type,
          toolName: event.toolName
        });
      });
    } catch {}
  }
  async registerTool(tool) {
    if (this.destroyed) {
      throw new Error("NativeTransport has been destroyed");
    }
    this.tools.set(tool.name, tool);
    try {
      const registration = await this.modelContext.registerTool({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        annotations: tool.annotations
      }, (args) => tool.execute(args), {});
      this.registrations.set(tool.name, registration);
      this.emitter.emit("change", {
        type: "registered",
        toolName: tool.name,
        tool: this.toToolInfo(tool)
      });
    } catch (error) {
      this.emitter.emit("change", {
        type: "registered",
        toolName: tool.name,
        tool: this.toToolInfo(tool)
      });
      if (typeof console !== "undefined" && console.warn) {
        console.warn(`[MonsterWebMCP] Native registration failed for "${tool.name}":`, error);
      }
    }
  }
  unregisterTool(name) {
    if (this.destroyed)
      return;
    const registration = this.registrations.get(name);
    if (registration) {
      try {
        registration.unregister();
      } catch {}
      this.registrations.delete(name);
    }
    this.tools.delete(name);
    this.emitter.emit("change", {
      type: "unregistered",
      toolName: name
    });
  }
  getTools() {
    return Array.from(this.tools.values()).map((t) => this.toToolInfo(t));
  }
  async executeTool(name, args, signal) {
    if (this.destroyed) {
      throw new Error("NativeTransport has been destroyed");
    }
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        content: [{ type: "text", text: `Tool "${name}" not found` }],
        isError: true
      };
    }
    try {
      return await tool.execute(args, signal);
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : String(error)
          }
        ],
        isError: true
      };
    }
  }
  onToolChange(callback) {
    return this.emitter.on("change", callback);
  }
  destroy() {
    if (this.destroyed)
      return;
    this.destroyed = true;
    for (const [name, registration] of this.registrations.entries()) {
      try {
        registration.unregister();
      } catch {}
    }
    this.registrations.clear();
    this.tools.clear();
    if (this.nativeUnsubscribe) {
      try {
        this.nativeUnsubscribe();
      } catch {}
      this.nativeUnsubscribe = null;
    }
    this.emitter.destroy();
  }
  toToolInfo(tool) {
    return {
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      annotations: tool.annotations
    };
  }
}

// src/transport/polyfill-transport.ts
class PolyfillTransport {
  type = "polyfill";
  tools = new Map;
  emitter;
  destroyed = false;
  static globalRegistry = new Map;
  static globalListeners = new Set;
  constructor() {
    this.emitter = new TypeSafeEventEmitter;
    if (typeof window !== "undefined") {
      this.exposeGlobal();
    }
  }
  registerTool(tool) {
    if (this.destroyed) {
      throw new Error("PolyfillTransport has been destroyed");
    }
    const isUpdate = this.tools.has(tool.name);
    this.tools.set(tool.name, tool);
    const event = {
      type: isUpdate ? "updated" : "registered",
      toolName: tool.name,
      tool: this.toToolInfo(tool)
    };
    this.emitter.emit("change", event);
    PolyfillTransport.globalRegistry.set(tool.name, this.toToolInfo(tool));
    this.notifyGlobalListeners(event);
  }
  unregisterTool(name) {
    if (this.destroyed)
      return;
    if (!this.tools.has(name))
      return;
    this.tools.delete(name);
    const event = {
      type: "unregistered",
      toolName: name
    };
    this.emitter.emit("change", event);
    PolyfillTransport.globalRegistry.delete(name);
    this.notifyGlobalListeners(event);
  }
  getTools() {
    return Array.from(this.tools.values()).map((t) => this.toToolInfo(t));
  }
  async executeTool(name, args, signal) {
    if (this.destroyed) {
      throw new Error("PolyfillTransport has been destroyed");
    }
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        content: [{ type: "text", text: `Tool "${name}" not found` }],
        isError: true
      };
    }
    if (signal?.aborted) {
      return {
        content: [{ type: "text", text: `Tool execution aborted` }],
        isError: true
      };
    }
    try {
      return await tool.execute(args, signal);
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : String(error)
          }
        ],
        isError: true
      };
    }
  }
  onToolChange(callback) {
    return this.emitter.on("change", callback);
  }
  destroy() {
    if (this.destroyed)
      return;
    this.destroyed = true;
    for (const name of this.tools.keys()) {
      PolyfillTransport.globalRegistry.delete(name);
    }
    this.tools.clear();
    this.emitter.destroy();
    this.unexposeGlobal();
  }
  static getGlobalTools() {
    return Array.from(this.globalRegistry.values());
  }
  static onGlobalToolChange(callback) {
    this.globalListeners.add(callback);
    return () => {
      this.globalListeners.delete(callback);
    };
  }
  notifyGlobalListeners(event) {
    for (const listener of PolyfillTransport.globalListeners) {
      try {
        listener(event);
      } catch {}
    }
  }
  exposeGlobal() {
    if (typeof window === "undefined")
      return;
    const self2 = this;
    const existing = window.__monsterWebMCP;
    if (!existing) {
      const namespace = {
        getTools: () => self2.getTools(),
        executeTool: (name, args) => self2.executeTool(name, args),
        onToolChange: (cb) => self2.onToolChange(cb),
        version: "1.0.0"
      };
      window.__monsterWebMCP = namespace;
    }
  }
  unexposeGlobal() {
    if (typeof window === "undefined")
      return;
    delete window.__monsterWebMCP;
  }
  toToolInfo(tool) {
    return {
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      annotations: tool.annotations
    };
  }
}

// src/transport/memory-transport.ts
class MemoryTransport {
  type = "memory";
  tools = new Map;
  emitter;
  destroyed = false;
  constructor() {
    this.emitter = new TypeSafeEventEmitter;
  }
  registerTool(tool) {
    if (this.destroyed) {
      throw new Error("MemoryTransport has been destroyed");
    }
    const isUpdate = this.tools.has(tool.name);
    this.tools.set(tool.name, tool);
    this.emitter.emit("change", {
      type: isUpdate ? "updated" : "registered",
      toolName: tool.name,
      tool: this.toToolInfo(tool)
    });
  }
  unregisterTool(name) {
    if (this.destroyed)
      return;
    if (!this.tools.has(name))
      return;
    this.tools.delete(name);
    this.emitter.emit("change", {
      type: "unregistered",
      toolName: name
    });
  }
  getTools() {
    return Array.from(this.tools.values()).map((t) => this.toToolInfo(t));
  }
  async executeTool(name, args, signal) {
    if (this.destroyed) {
      throw new Error("MemoryTransport has been destroyed");
    }
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        content: [{ type: "text", text: `Tool "${name}" not found` }],
        isError: true
      };
    }
    if (signal?.aborted) {
      return {
        content: [{ type: "text", text: "Tool execution aborted" }],
        isError: true
      };
    }
    try {
      return await tool.execute(args, signal);
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : String(error)
          }
        ],
        isError: true
      };
    }
  }
  onToolChange(callback) {
    return this.emitter.on("change", callback);
  }
  destroy() {
    if (this.destroyed)
      return;
    this.destroyed = true;
    this.tools.clear();
    this.emitter.destroy();
  }
  toToolInfo(tool) {
    return {
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      annotations: tool.annotations
    };
  }
}

// src/transport/http-transport.ts
class HTTPTransport {
  type = "http";
  tools = new Map;
  emitter;
  config;
  destroyed = false;
  eventSource = null;
  constructor(config) {
    this.config = config;
    this.emitter = new TypeSafeEventEmitter;
    if (config.type === "sse" && config.endpoint) {
      this.connectSSE();
    }
  }
  registerTool(tool) {
    if (this.destroyed) {
      throw new Error("HTTPTransport has been destroyed");
    }
    const isUpdate = this.tools.has(tool.name);
    this.tools.set(tool.name, tool);
    const event = {
      type: isUpdate ? "updated" : "registered",
      toolName: tool.name,
      tool: this.toToolInfo(tool)
    };
    this.emitter.emit("change", event);
    this.notifyRemote("tool_registered", {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    });
  }
  unregisterTool(name) {
    if (this.destroyed)
      return;
    if (!this.tools.has(name))
      return;
    this.tools.delete(name);
    const event = {
      type: "unregistered",
      toolName: name
    };
    this.emitter.emit("change", event);
    this.notifyRemote("tool_unregistered", { name });
  }
  getTools() {
    return Array.from(this.tools.values()).map((t) => this.toToolInfo(t));
  }
  async executeTool(name, args, signal) {
    if (this.destroyed) {
      throw new Error("HTTPTransport has been destroyed");
    }
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        content: [{ type: "text", text: `Tool "${name}" not found` }],
        isError: true
      };
    }
    if (signal?.aborted) {
      return {
        content: [{ type: "text", text: "Tool execution aborted" }],
        isError: true
      };
    }
    try {
      const result = await tool.execute(args, signal);
      this.notifyRemote("tool_executed", {
        name,
        args,
        result
      });
      return result;
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : String(error)
          }
        ],
        isError: true
      };
    }
  }
  onToolChange(callback) {
    return this.emitter.on("change", callback);
  }
  async sendRequest(method, params) {
    const endpoint = this.config.endpoint;
    if (!endpoint) {
      throw new Error("HTTP transport endpoint not configured");
    }
    const headers = {
      "Content-Type": "application/json"
    };
    if (this.config.auth === "bearer" && this.config.token) {
      headers["Authorization"] = `Bearer ${this.config.token}`;
    }
    const body = {
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      ...params ? { params } : {}
    };
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
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
  destroy() {
    if (this.destroyed)
      return;
    this.destroyed = true;
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.tools.clear();
    this.emitter.destroy();
  }
  connectSSE() {
    if (typeof EventSource === "undefined")
      return;
    const endpoint = this.config.endpoint;
    if (!endpoint)
      return;
    const sseUrl = endpoint.replace(/\/mcp$/, "/mcp/sse");
    try {
      this.eventSource = new EventSource(sseUrl);
      this.eventSource.addEventListener("tool_change", (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emitter.emit("change", data);
        } catch {}
      });
      this.eventSource.onerror = () => {};
    } catch {}
  }
  notifyRemote(event, data) {
    const endpoint = this.config.endpoint;
    if (!endpoint)
      return;
    const headers = {
      "Content-Type": "application/json"
    };
    if (this.config.auth === "bearer" && this.config.token) {
      headers["Authorization"] = `Bearer ${this.config.token}`;
    }
    const body = {
      jsonrpc: "2.0",
      method: `notifications/${event}`,
      params: data
    };
    fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    }).catch(() => {});
  }
  toToolInfo(tool) {
    return {
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      annotations: tool.annotations
    };
  }
}

// src/transport/transport-factory.ts
class TransportFactory {
  static create(config) {
    if (config.native) {
      const nativeTransport = TransportFactory.tryNative();
      if (nativeTransport) {
        return nativeTransport;
      }
    }
    if (config.polyfill) {
      const polyfillTransport = TransportFactory.tryPolyfill();
      if (polyfillTransport) {
        return polyfillTransport;
      }
    }
    return new MemoryTransport;
  }
  static createHTTPTransport(config) {
    if (!config.traditional || !config.transportConfig) {
      return null;
    }
    return new HTTPTransport(config.transportConfig);
  }
  static isNativeAvailable() {
    if (typeof document === "undefined")
      return false;
    return "modelContext" in document && document.modelContext !== undefined;
  }
  static getNativeModelContext() {
    if (typeof document === "undefined")
      return null;
    if ("modelContext" in document && document.modelContext) {
      return document.modelContext;
    }
    return null;
  }
  static detectEnvironment() {
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      return "browser";
    }
    if (typeof self !== "undefined" && typeof self.importScripts === "function") {
      return "webworker";
    }
    if (typeof process !== "undefined" && process.versions?.node) {
      return "node";
    }
    return "unknown";
  }
  static tryNative() {
    const modelContext = TransportFactory.getNativeModelContext();
    if (!modelContext)
      return null;
    return new NativeTransport(modelContext);
  }
  static tryPolyfill() {
    if (typeof window === "undefined")
      return null;
    return new PolyfillTransport;
  }
}

// src/core/tool-registry.ts
class ToolRegistry {
  tools = new Map;
  emitter;
  destroyed = false;
  constructor() {
    this.emitter = new TypeSafeEventEmitter;
  }
  register(tool, options) {
    if (this.destroyed) {
      throw new Error("ToolRegistry has been destroyed");
    }
    const isUpdate = this.tools.has(tool.name);
    this.tools.set(tool.name, {
      definition: tool,
      options,
      registeredAt: Date.now()
    });
    const event = {
      type: isUpdate ? "updated" : "registered",
      toolName: tool.name,
      tool: this.toToolInfo(tool)
    };
    this.emitter.emit("change", event);
  }
  unregister(name) {
    if (this.destroyed)
      return false;
    if (!this.tools.has(name))
      return false;
    this.tools.delete(name);
    this.emitter.emit("change", {
      type: "unregistered",
      toolName: name
    });
    return true;
  }
  get(name) {
    return this.tools.get(name)?.definition;
  }
  getOptions(name) {
    return this.tools.get(name)?.options;
  }
  getTools() {
    return Array.from(this.tools.values()).map((entry) => this.toToolInfo(entry.definition));
  }
  getDefinitions() {
    return Array.from(this.tools.values()).map((entry) => entry.definition);
  }
  has(name) {
    return this.tools.has(name);
  }
  get size() {
    return this.tools.size;
  }
  get names() {
    return Array.from(this.tools.keys());
  }
  onToolChange(callback) {
    return this.emitter.on("change", callback);
  }
  destroy() {
    if (this.destroyed)
      return;
    this.destroyed = true;
    this.tools.clear();
    this.emitter.destroy();
  }
  toToolInfo(tool) {
    return {
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      annotations: tool.annotations
    };
  }
}

// src/utils/schema-validator.ts
function validateProperty(value, schema, path) {
  const errors = [];
  if (value === undefined || value === null) {
    return errors;
  }
  if (schema.type) {
    const actualType = getTypeOf(value);
    const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    const validTypes = ["string", "number", "integer", "boolean", "array", "object", "null"];
    if (!expectedTypes.some((t) => t === actualType || t === "number" && actualType === "integer")) {
      if (!(schema.type === "number" && actualType === "integer")) {
        errors.push({
          path,
          message: `Expected type ${expectedTypes.join("|")}, got ${actualType}`,
          value
        });
        return errors;
      }
    }
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        path,
        message: `String length ${value.length} is less than minimum ${schema.minLength}`,
        value
      });
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        path,
        message: `String length ${value.length} exceeds maximum ${schema.maxLength}`,
        value
      });
    }
    if (schema.pattern !== undefined) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        errors.push({
          path,
          message: `String does not match pattern ${schema.pattern}`,
          value
        });
      }
    }
    if (schema.enum !== undefined && !schema.enum.includes(value)) {
      errors.push({
        path,
        message: `Value not in enum: [${schema.enum.join(", ")}]`,
        value
      });
    }
    if (schema.format !== undefined) {
      const formatValid = validateFormat(value, schema.format);
      if (!formatValid) {
        errors.push({
          path,
          message: `String does not match format "${schema.format}"`,
          value
        });
      }
    }
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({
        path,
        message: `Value ${value} is less than minimum ${schema.minimum}`,
        value
      });
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({
        path,
        message: `Value ${value} exceeds maximum ${schema.maximum}`,
        value
      });
    }
    if (schema.enum !== undefined && !schema.enum.includes(String(value))) {
      errors.push({
        path,
        message: `Value not in enum: [${schema.enum.join(", ")}]`,
        value
      });
    }
  }
  if (Array.isArray(value) && schema.items) {
    for (let i = 0;i < value.length; i++) {
      errors.push(...validateProperty(value[i], schema.items, `${path}[${i}]`));
    }
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value) && schema.properties) {
    const obj = value;
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (key in obj) {
        errors.push(...validateProperty(obj[key], propSchema, `${path}.${key}`));
      }
    }
    if (schema.additionalProperties === false) {
      const allowedKeys = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(obj)) {
        if (!allowedKeys.has(key)) {
          errors.push({
            path: `${path}.${key}`,
            message: `Additional property "${key}" is not allowed`,
            value: obj[key]
          });
        }
      }
    } else if (typeof schema.additionalProperties === "object") {
      const allowedKeys = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(obj)) {
        if (!allowedKeys.has(key)) {
          errors.push(...validateProperty(obj[key], schema.additionalProperties, `${path}.${key}`));
        }
      }
    }
    if (schema.required) {
      for (const reqKey of schema.required) {
        if (!(reqKey in obj)) {
          errors.push({
            path: `${path}.${reqKey}`,
            message: `Required property "${reqKey}" is missing`
          });
        }
      }
    }
  }
  return errors;
}
function getTypeOf(value) {
  if (value === null)
    return "null";
  if (value === undefined)
    return "undefined";
  if (Array.isArray(value))
    return "array";
  if (Number.isInteger(value))
    return "integer";
  return typeof value;
}
function validateFormat(value, format) {
  switch (format) {
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case "uri":
    case "url":
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
    case "date-time":
      return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value) && !isNaN(Date.parse(value));
    case "uuid":
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    default:
      return true;
  }
}
function validateArguments(args, schema) {
  const errors = [];
  if (schema.required) {
    for (const field of schema.required) {
      if (!(field in args) || args[field] === undefined || args[field] === null) {
        errors.push({
          path: field,
          message: `Required property "${field}" is missing`
        });
      }
    }
  }
  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (key in args && args[key] !== undefined && args[key] !== null) {
        errors.push(...validateProperty(args[key], propSchema, key));
      }
    }
  }
  if (schema.additionalProperties === false && schema.properties) {
    const allowedKeys = new Set(Object.keys(schema.properties));
    for (const key of Object.keys(args)) {
      if (!allowedKeys.has(key)) {
        errors.push({
          path: key,
          message: `Additional property "${key}" is not allowed`,
          value: args[key]
        });
      }
    }
  } else if (typeof schema.additionalProperties === "object" && schema.properties) {
    const allowedKeys = new Set(Object.keys(schema.properties));
    for (const key of Object.keys(args)) {
      if (!allowedKeys.has(key)) {
        errors.push(...validateProperty(args[key], schema.additionalProperties, key));
      }
    }
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
function isValidJsonSchema(schema) {
  if (typeof schema !== "object" || schema === null)
    return false;
  const s = schema;
  if (s.type !== "object")
    return false;
  if (s.properties !== undefined) {
    if (typeof s.properties !== "object" || s.properties === null)
      return false;
    for (const prop of Object.values(s.properties)) {
      if (typeof prop !== "object" || prop === null)
        return false;
    }
  }
  if (s.required !== undefined) {
    if (!Array.isArray(s.required))
      return false;
    for (const item of s.required) {
      if (typeof item !== "string")
        return false;
    }
  }
  return true;
}
function formatValidationErrors(errors) {
  return errors.map((e) => e.path ? `${e.path}: ${e.message}` : e.message).join("; ");
}

// src/security/rate-limiter.ts
class RateLimiter {
  buckets = new Map;
  configs = new Map;
  defaultConfig;
  cleanupInterval = null;
  constructor(defaultConfig) {
    this.defaultConfig = defaultConfig ?? { maxRequests: 100, windowMs: 60000 };
    this.cleanupInterval = setInterval(() => this.cleanup(), 300000);
  }
  setLimit(toolName, config) {
    this.configs.set(toolName, config);
  }
  removeLimit(toolName) {
    this.configs.delete(toolName);
    this.buckets.delete(toolName);
  }
  check(toolName) {
    const config = this.configs.get(toolName) ?? this.defaultConfig;
    const now = Date.now();
    let bucket = this.buckets.get(toolName);
    if (!bucket) {
      bucket = {
        tokens: config.maxRequests - 1,
        lastRefill: now
      };
      this.buckets.set(toolName, bucket);
      return true;
    }
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(elapsed / config.windowMs * config.maxRequests);
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(config.maxRequests, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }
    if (bucket.tokens > 0) {
      bucket.tokens -= 1;
      return true;
    }
    return false;
  }
  getRemaining(toolName) {
    const config = this.configs.get(toolName) ?? this.defaultConfig;
    const bucket = this.buckets.get(toolName);
    if (!bucket)
      return config.maxRequests;
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(elapsed / config.windowMs * config.maxRequests);
    return Math.min(config.maxRequests, bucket.tokens + tokensToAdd);
  }
  getWaitTime(toolName) {
    const config = this.configs.get(toolName) ?? this.defaultConfig;
    const bucket = this.buckets.get(toolName);
    if (!bucket || bucket.tokens > 0)
      return 0;
    const msPerToken = config.windowMs / config.maxRequests;
    const elapsed = Date.now() - bucket.lastRefill;
    const remainder = msPerToken - elapsed % msPerToken;
    return Math.ceil(remainder);
  }
  reset(toolName) {
    if (toolName) {
      this.buckets.delete(toolName);
    } else {
      this.buckets.clear();
    }
  }
  cleanup() {
    const now = Date.now();
    const staleThreshold = 3600000;
    for (const [toolName, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > staleThreshold) {
        this.buckets.delete(toolName);
      }
    }
  }
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.buckets.clear();
    this.configs.clear();
  }
}

// src/security/security-manager.ts
var TOOL_NAME_PATTERN = /^[a-zA-Z0-9_\-.]{1,128}$/;

class SecurityManager {
  allowedOrigins;
  rateLimiter;
  toolExposedTo = new Map;
  toolAnnotations = new Map;
  debug;
  constructor(options = {}, debug = false) {
    this.allowedOrigins = new Set(options.allowedOrigins ?? []);
    this.rateLimiter = new RateLimiter(options.defaultRateLimit);
    this.debug = debug;
    if (options.rateLimits) {
      for (const [toolName, config] of Object.entries(options.rateLimits)) {
        this.rateLimiter.setLimit(toolName, config);
      }
    }
  }
  validateRegistration(tool, options) {
    if (!tool.name || typeof tool.name !== "string") {
      return { valid: false, reason: "Tool name is required and must be a string" };
    }
    if (!TOOL_NAME_PATTERN.test(tool.name)) {
      return {
        valid: false,
        reason: `Tool name "${tool.name}" must be 1-128 characters and contain only alphanumeric characters, underscores, hyphens, and periods`
      };
    }
    if (!tool.description || typeof tool.description !== "string" || tool.description.trim().length === 0) {
      return { valid: false, reason: `Tool "${tool.name}" must have a non-empty description` };
    }
    if (!tool.inputSchema) {
      return { valid: false, reason: `Tool "${tool.name}" must have an inputSchema` };
    }
    if (!isValidJsonSchema(tool.inputSchema)) {
      return { valid: false, reason: `Tool "${tool.name}" has an invalid inputSchema` };
    }
    if (tool.outputSchema && !isValidJsonSchema(tool.outputSchema)) {
      return { valid: false, reason: `Tool "${tool.name}" has an invalid outputSchema` };
    }
    if (typeof tool.execute !== "function") {
      return { valid: false, reason: `Tool "${tool.name}" must have an execute function` };
    }
    if (options?.exposedTo) {
      for (const origin of options.exposedTo) {
        const originValidation = this.validateOrigin(origin);
        if (!originValidation.valid) {
          return {
            valid: false,
            reason: `Tool "${tool.name}" exposedTo contains invalid origin: ${originValidation.reason}`
          };
        }
      }
    }
    return { valid: true };
  }
  validateExecution(toolName, callerOrigin, args) {
    if (!this.rateLimiter.check(toolName)) {
      const waitTime = this.rateLimiter.getWaitTime(toolName);
      return {
        valid: false,
        reason: `Rate limit exceeded for tool "${toolName}". Try again in ${waitTime}ms`
      };
    }
    const originCheck = this.checkOriginPermission(toolName, callerOrigin);
    if (!originCheck.valid) {
      return originCheck;
    }
    return { valid: true };
  }
  registerToolSecurity(toolName, options, annotations) {
    if (options?.exposedTo) {
      this.toolExposedTo.set(toolName, options.exposedTo);
    }
    if (annotations || options?.annotations) {
      this.toolAnnotations.set(toolName, {
        ...annotations,
        ...options?.annotations
      });
    }
    if (options?.rateLimit) {
      this.rateLimiter.setLimit(toolName, options.rateLimit);
    }
  }
  unregisterToolSecurity(toolName) {
    this.toolExposedTo.delete(toolName);
    this.toolAnnotations.delete(toolName);
    this.rateLimiter.removeLimit(toolName);
  }
  getAnnotations(toolName) {
    return this.toolAnnotations.get(toolName);
  }
  getExposedTo(toolName) {
    return this.toolExposedTo.get(toolName) ?? [];
  }
  checkOriginPermission(toolName, callerOrigin) {
    let pageOrigin = "";
    if (typeof window !== "undefined" && window.location) {
      pageOrigin = window.location.origin;
    }
    if (callerOrigin === pageOrigin || callerOrigin === "") {
      return { valid: true };
    }
    const exposedTo = this.toolExposedTo.get(toolName);
    if (!exposedTo || exposedTo.length === 0) {
      return {
        valid: false,
        reason: `Tool "${toolName}" is not exposed to origin "${callerOrigin}"`
      };
    }
    if (!exposedTo.includes(callerOrigin)) {
      return {
        valid: false,
        reason: `Tool "${toolName}" is not exposed to origin "${callerOrigin}". Allowed origins: ${exposedTo.join(", ")}`
      };
    }
    if (this.allowedOrigins.size > 0 && !this.allowedOrigins.has(callerOrigin)) {
      return {
        valid: false,
        reason: `Origin "${callerOrigin}" is not in the global allowed origins list`
      };
    }
    return { valid: true };
  }
  validateOrigin(origin) {
    if (typeof origin !== "string" || origin.trim().length === 0) {
      return { valid: false, reason: "Origin must be a non-empty string" };
    }
    try {
      const url = new URL(origin);
      if (!url.protocol || !url.host) {
        return { valid: false, reason: `Origin "${origin}" must include protocol and host` };
      }
      if (url.pathname !== "/" || url.search || url.hash) {
        return {
          valid: false,
          reason: `Origin "${origin}" should not include path, query, or hash`
        };
      }
      return { valid: true };
    } catch {
      return { valid: false, reason: `Origin "${origin}" is not a valid URL` };
    }
  }
  addAllowedOrigin(origin) {
    const validation = this.validateOrigin(origin);
    if (!validation.valid)
      return validation;
    this.allowedOrigins.add(origin);
    return { valid: true };
  }
  removeAllowedOrigin(origin) {
    this.allowedOrigins.delete(origin);
  }
  getRateLimiter() {
    return this.rateLimiter;
  }
  destroy() {
    this.rateLimiter.destroy();
    this.toolExposedTo.clear();
    this.toolAnnotations.clear();
    this.allowedOrigins.clear();
  }
}

// src/declarative/form-processor.ts
var TOOL_NAME_ATTR = "toolname";
var TOOL_DESC_ATTR = "tooldescription";
var AUTO_SUBMIT_ATTR = "toolautosubmit";
var PARAM_DESC_ATTR = "toolparamdescription";

class DeclarativeProcessor {
  monsterMCP;
  observer = null;
  processedForms = new WeakSet;
  destroyed = false;
  constructor(monsterMCP) {
    this.monsterMCP = monsterMCP;
    if (typeof document === "undefined")
      return;
    this.processExistingForms();
    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [TOOL_NAME_ATTR, TOOL_DESC_ATTR, AUTO_SUBMIT_ATTR]
    });
  }
  processExistingForms() {
    if (typeof document === "undefined")
      return;
    const forms = document.querySelectorAll(`form[${TOOL_NAME_ATTR}]`);
    for (const form of forms) {
      if (form instanceof HTMLFormElement) {
        this.processForm(form);
      }
    }
  }
  handleMutations(mutations) {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLFormElement) {
          if (node.hasAttribute(TOOL_NAME_ATTR)) {
            this.processForm(node);
          }
        }
        if (node instanceof HTMLElement) {
          const forms = node.querySelectorAll(`form[${TOOL_NAME_ATTR}]`);
          for (const form of forms) {
            if (form instanceof HTMLFormElement) {
              this.processForm(form);
            }
          }
        }
      }
      if (mutation.type === "attributes" && mutation.target instanceof HTMLFormElement) {
        if (mutation.target.hasAttribute(TOOL_NAME_ATTR)) {
          this.processForm(mutation.target);
        }
      }
    }
  }
  processForm(form) {
    const name = form.getAttribute(TOOL_NAME_ATTR);
    if (!name)
      return;
    if (this.processedForms.has(form))
      return;
    this.processedForms.add(form);
    const description = form.getAttribute(TOOL_DESC_ATTR) || `Tool: ${name}`;
    const autoSubmit = form.hasAttribute(AUTO_SUBMIT_ATTR);
    const inputSchema = this.buildSchema(form);
    const respondWithCallbacks = new Map;
    this.monsterMCP.registerTool({
      name,
      description,
      inputSchema,
      execute: async (args, signal) => {
        this.fillForm(form, args);
        if (autoSubmit) {
          return new Promise((resolve) => {
            const requestId = `${name}_${Date.now()}`;
            respondWithCallbacks.set(requestId, resolve);
            const handleSubmit = (e) => {
              e.preventDefault();
              const respondWith = (result) => {
                respondWithCallbacks.delete(requestId);
                form.removeEventListener("submit", handleSubmit);
                resolve(result);
              };
              e.respondWith = respondWith;
              const customEvent = new CustomEvent("toolsubmit", {
                detail: { args, respondWith, form },
                bubbles: true
              });
              form.dispatchEvent(customEvent);
              setTimeout(() => {
                if (respondWithCallbacks.has(requestId)) {
                  respondWithCallbacks.delete(requestId);
                  form.removeEventListener("submit", handleSubmit);
                  const formData = new FormData(form);
                  const data = {};
                  formData.forEach((value, key) => {
                    data[key] = value;
                  });
                  resolve({
                    content: [
                      {
                        type: "text",
                        text: JSON.stringify(data)
                      }
                    ]
                  });
                }
              }, 5000);
            };
            form.addEventListener("submit", handleSubmit);
            if (signal?.aborted) {
              form.removeEventListener("submit", handleSubmit);
              respondWithCallbacks.delete(requestId);
              return resolve({
                content: [{ type: "text", text: "Tool execution aborted" }],
                isError: true
              });
            }
            form.requestSubmit();
          });
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(args, null, 2)
            }
          ]
        };
      }
    });
  }
  buildSchema(form) {
    const properties = {};
    const required = [];
    const inputs = form.querySelectorAll("input, select, textarea");
    for (const element of inputs) {
      if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) {
        continue;
      }
      const inputName = element.getAttribute("name");
      if (!inputName)
        continue;
      const paramDescription = element.getAttribute(PARAM_DESC_ATTR) || "";
      const isRequired = element.hasAttribute("required");
      const inputType = element instanceof HTMLInputElement ? element.type : "text";
      let schema;
      if (element instanceof HTMLSelectElement) {
        const options = Array.from(element.options);
        const enumValues = options.filter((opt) => opt.value !== "").map((opt) => opt.value);
        schema = {
          type: "string",
          description: paramDescription || `Select ${inputName}`,
          enum: enumValues.length > 0 ? enumValues : undefined
        };
      } else if (element instanceof HTMLTextAreaElement) {
        schema = {
          type: "string",
          description: paramDescription || `Text input ${inputName}`
        };
      } else {
        switch (inputType) {
          case "number":
          case "range":
            schema = {
              type: "number",
              description: paramDescription || `Number input ${inputName}`
            };
            if (element instanceof HTMLInputElement) {
              if (element.min)
                schema.minimum = parseFloat(element.min);
              if (element.max)
                schema.maximum = parseFloat(element.max);
            }
            break;
          case "checkbox":
            schema = {
              type: "boolean",
              description: paramDescription || `Checkbox ${inputName}`
            };
            break;
          case "date":
          case "datetime-local":
            schema = {
              type: "string",
              description: paramDescription || `Date input ${inputName}`,
              format: inputType === "datetime-local" ? "date-time" : "date"
            };
            break;
          case "email":
            schema = {
              type: "string",
              description: paramDescription || `Email input ${inputName}`,
              format: "email"
            };
            break;
          case "url":
            schema = {
              type: "string",
              description: paramDescription || `URL input ${inputName}`,
              format: "uri"
            };
            break;
          case "radio": {
            const radioGroup = form.querySelectorAll(`input[type="radio"][name="${inputName}"]`);
            const enumValues = Array.from(radioGroup).map((radio) => radio.value).filter((v) => v !== "");
            if (properties[inputName])
              continue;
            schema = {
              type: "string",
              description: paramDescription || `Radio group ${inputName}`,
              enum: enumValues.length > 0 ? enumValues : undefined
            };
            break;
          }
          default:
            schema = {
              type: "string",
              description: paramDescription || `Text input ${inputName}`
            };
            if (element instanceof HTMLInputElement && element.list) {
              const datalist = element.list;
              const options = datalist.querySelectorAll("option");
              const enumValues = Array.from(options).map((opt) => opt.value).filter((v) => v !== "");
              if (enumValues.length > 0) {
                schema.enum = enumValues;
              }
            }
            if (element instanceof HTMLInputElement && element.pattern) {
              schema.pattern = element.pattern;
            }
            if (element instanceof HTMLInputElement) {
              if (element.maxLength > 0)
                schema.maxLength = element.maxLength;
              if (element.minLength > 0)
                schema.minLength = element.minLength;
            }
            break;
        }
      }
      if (element instanceof HTMLSelectElement) {
        if (element.value) {
          schema.default = element.value;
        }
      } else if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        if (element.defaultValue) {
          if (schema.type === "number") {
            schema.default = parseFloat(element.defaultValue);
          } else if (schema.type === "boolean") {
            schema.default = element.defaultValue === "true" || element.defaultValue === "on";
          } else {
            schema.default = element.defaultValue;
          }
        }
      }
      properties[inputName] = schema;
      if (isRequired) {
        required.push(inputName);
      }
    }
    return {
      type: "object",
      properties,
      required: required.length > 0 ? required : undefined,
      additionalProperties: false
    };
  }
  fillForm(form, args) {
    for (const [key, value] of Object.entries(args)) {
      const input = form.querySelector(`[name="${key}"]`);
      if (!input)
        continue;
      if (input instanceof HTMLInputElement) {
        if (input.type === "checkbox") {
          input.checked = Boolean(value);
        } else if (input.type === "radio") {
          const radio = form.querySelector(`input[type="radio"][name="${key}"][value="${value}"]`);
          if (radio)
            radio.checked = true;
        } else {
          input.value = String(value);
        }
      } else if (input instanceof HTMLSelectElement) {
        input.value = String(value);
      } else if (input instanceof HTMLTextAreaElement) {
        input.value = String(value);
      }
    }
  }
  destroy() {
    if (this.destroyed)
      return;
    this.destroyed = true;
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

// src/core/monster-mcp.ts
class MonsterMCP {
  transport;
  httpTransport = null;
  registry;
  security;
  declarativeProcessor = null;
  abortControllers = new Map;
  destroyed = false;
  debug;
  constructor(options = {}) {
    this.debug = options.debug ?? false;
    this.registry = new ToolRegistry;
    this.security = new SecurityManager({
      allowedOrigins: options.allowedOrigins,
      rateLimits: options.rateLimits,
      defaultRateLimit: options.defaultRateLimit
    }, this.debug);
    const transportConfig = {
      native: options.webmcp !== false,
      polyfill: options.polyfill !== false,
      traditional: options.traditionalMcp === true,
      transportConfig: options.mcpTransport
    };
    this.transport = TransportFactory.create(transportConfig);
    if (options.traditionalMcp) {
      this.httpTransport = TransportFactory.createHTTPTransport(transportConfig);
    }
    this.registry.onToolChange((event) => {
      this.handleRegistryChange(event);
    });
    if (options.declarative !== false && typeof document !== "undefined") {
      this.declarativeProcessor = new DeclarativeProcessor(this);
    }
    this.log("MonsterMCP initialized", {
      transportType: this.transport.type,
      nativeAvailable: TransportFactory.isNativeAvailable(),
      httpTransport: this.httpTransport !== null
    });
  }
  registerTool(tool, options) {
    if (this.destroyed) {
      throw new Error("MonsterMCP has been destroyed");
    }
    const securityResult = this.security.validateRegistration(tool, options);
    if (!securityResult.valid) {
      throw new Error(`Tool registration failed: ${securityResult.reason}`);
    }
    if (this.registry.has(tool.name) && !options?.signal) {
      this.log(`Updating existing tool: ${tool.name}`);
    }
    if (options?.signal) {
      const existingController = this.abortControllers.get(tool.name);
      if (existingController) {
        existingController.abort();
      }
      const controller = new AbortController;
      this.abortControllers.set(tool.name, controller);
      options.signal.addEventListener("abort", () => {
        this.unregisterTool(tool.name);
        this.abortControllers.delete(tool.name);
      });
    }
    this.security.registerToolSecurity(tool.name, options, tool.annotations);
    this.registry.register(tool, options);
    this.transport.registerTool(tool);
    if (this.httpTransport) {
      this.httpTransport.registerTool(tool);
    }
    this.log(`Tool registered: ${tool.name}`);
  }
  unregisterTool(name) {
    if (this.destroyed)
      return;
    if (!this.registry.has(name)) {
      this.log(`Attempted to unregister unknown tool: ${name}`);
      return;
    }
    const controller = this.abortControllers.get(name);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(name);
    }
    this.security.unregisterToolSecurity(name);
    this.transport.unregisterTool(name);
    if (this.httpTransport) {
      this.httpTransport.unregisterTool(name);
    }
    this.registry.unregister(name);
    this.log(`Tool unregistered: ${name}`);
  }
  getTools() {
    return this.registry.getTools();
  }
  async executeTool(name, args = {}) {
    if (this.destroyed) {
      throw new Error("MonsterMCP has been destroyed");
    }
    const tool = this.registry.get(name);
    if (!tool) {
      return {
        content: [{ type: "text", text: `Tool "${name}" not found` }],
        isError: true
      };
    }
    let callerOrigin = "";
    if (typeof window !== "undefined" && window.location) {
      callerOrigin = window.location.origin;
    }
    const securityResult = this.security.validateExecution(name, callerOrigin, args);
    if (!securityResult.valid) {
      return {
        content: [{ type: "text", text: securityResult.reason ?? "Security validation failed" }],
        isError: true
      };
    }
    const validationResult = validateArguments(args, tool.inputSchema);
    if (!validationResult.valid) {
      return {
        content: [
          {
            type: "text",
            text: `Input validation failed: ${formatValidationErrors(validationResult.errors)}`
          }
        ],
        isError: true
      };
    }
    const controller = this.abortControllers.get(name);
    const signal = controller?.signal;
    this.log(`Executing tool: ${name}`, args);
    try {
      const result = await this.transport.executeTool(name, args, signal);
      this.log(`Tool executed: ${name}`, { isError: result.isError });
      return result;
    } catch (error) {
      const errorResult = {
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : String(error)
          }
        ],
        isError: true
      };
      this.log(`Tool execution failed: ${name}`, errorResult);
      return errorResult;
    }
  }
  onToolChange(callback) {
    if (this.destroyed) {
      return () => {};
    }
    const unsubRegistry = this.registry.onToolChange(callback);
    const unsubTransport = this.transport.onToolChange(callback);
    return () => {
      unsubRegistry();
      unsubTransport();
    };
  }
  getTransportType() {
    return this.transport.type;
  }
  isNativeAvailable() {
    return TransportFactory.isNativeAvailable();
  }
  getToolAnnotations(name) {
    return this.security.getAnnotations(name);
  }
  getToolExposedTo(name) {
    return this.security.getExposedTo(name);
  }
  addAllowedOrigin(origin) {
    const result = this.security.addAllowedOrigin(origin);
    if (!result.valid) {
      throw new Error(result.reason);
    }
  }
  removeAllowedOrigin(origin) {
    this.security.removeAllowedOrigin(origin);
  }
  destroy() {
    if (this.destroyed)
      return;
    this.destroyed = true;
    this.log("Destroying MonsterMCP");
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.abortControllers.clear();
    if (this.declarativeProcessor) {
      this.declarativeProcessor.destroy();
      this.declarativeProcessor = null;
    }
    if (this.httpTransport) {
      this.httpTransport.destroy();
      this.httpTransport = null;
    }
    this.transport.destroy();
    this.registry.destroy();
    this.security.destroy();
  }
  handleRegistryChange(_event) {}
  log(message, data) {
    if (!this.debug)
      return;
    if (typeof console !== "undefined" && console.log) {
      console.log(`[MonsterWebMCP] ${message}`, data ?? "");
    }
  }
}
// src/server/local-relay.ts
class LocalRelay {
  port;
  authToken;
  toolRegistry = new Map;
  clients = new Map;
  wss = null;
  server = null;
  running = false;
  clientCounter = 0;
  toolExecutor = null;
  toolChangeCallback = null;
  constructor(config = {}) {
    this.port = config.port ?? 12306;
    this.authToken = config.authToken ?? null;
  }
  async start() {
    if (this.running)
      return;
    try {
      const Bun = globalThis.Bun;
      if (!Bun) {
        throw new Error("LocalRelay requires Bun runtime. Use the HTTP server for Node.js environments.");
      }
      this.server = Bun.serve({
        port: this.port,
        fetch: (req, server) => {
          const url = new URL(req.url);
          if (url.pathname === "/health") {
            return new Response(JSON.stringify({ status: "ok", tools: this.toolRegistry.size }), {
              headers: { "Content-Type": "application/json" }
            });
          }
          if (url.pathname === "/mcp" && req.method === "POST") {
            return this.handleHTTPRequest(req);
          }
          if (server.upgrade(req)) {
            return;
          }
          return new Response("Not Found", { status: 404 });
        },
        websocket: {
          open: (ws) => this.handleConnection(ws),
          message: (ws, message) => this.handleMessage(ws, message),
          close: (ws) => this.handleDisconnection(ws)
        }
      });
      this.running = true;
      console.log(`[MonsterWebMCP] Local relay started on ws://localhost:${this.port}`);
    } catch (error) {
      console.error(`[MonsterWebMCP] Failed to start local relay:`, error);
      throw error;
    }
  }
  stop() {
    if (!this.running)
      return;
    for (const [id, client] of this.clients.entries()) {
      try {
        client.ws.close(1001, "Server shutting down");
      } catch {}
    }
    this.clients.clear();
    if (this.server) {
      try {
        this.server.stop?.();
      } catch {}
      this.server = null;
    }
    this.running = false;
    console.log("[MonsterWebMCP] Local relay stopped");
  }
  registerTool(tool) {
    this.toolRegistry.set(tool.name, tool);
    this.broadcastToolChange("registered", tool.name);
  }
  unregisterTool(name) {
    this.toolRegistry.delete(name);
    this.broadcastToolChange("unregistered", name);
  }
  setToolExecutor(executor) {
    this.toolExecutor = executor;
  }
  setToolChangeCallback(callback) {
    this.toolChangeCallback = callback;
  }
  getTools() {
    return Array.from(this.toolRegistry.values()).map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      annotations: tool.annotations
    }));
  }
  isRunning() {
    return this.running;
  }
  getPort() {
    return this.port;
  }
  handleConnection(ws) {
    const clientId = `client_${++this.clientCounter}`;
    const client = { ws, id: clientId, initialized: false };
    this.clients.set(clientId, client);
    ws.__monsterClientId = clientId;
    console.log(`[MonsterWebMCP] Client connected: ${clientId}`);
  }
  async handleMessage(ws, message) {
    const clientId = ws.__monsterClientId;
    const client = this.clients.get(clientId);
    if (!client)
      return;
    let request;
    try {
      const msg = typeof message === "string" ? message : new TextDecoder().decode(message);
      request = JSON.parse(msg);
    } catch {
      this.sendError(ws, null, -32700, "Parse error");
      return;
    }
    if (this.authToken && request.method !== "initialize") {}
    try {
      const response = await this.routeRequest(client, request);
      if (response) {
        ws.send(JSON.stringify(response));
      }
    } catch (error) {
      this.sendError(ws, request.id ?? null, -32603, error instanceof Error ? error.message : "Internal error");
    }
  }
  handleDisconnection(ws) {
    const clientId = ws.__monsterClientId;
    if (clientId) {
      this.clients.delete(clientId);
      console.log(`[MonsterWebMCP] Client disconnected: ${clientId}`);
    }
  }
  async handleHTTPRequest(req) {
    if (this.authToken) {
      const auth = req.headers.get("Authorization");
      if (!auth || auth !== `Bearer ${this.authToken}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    let request;
    try {
      request = await req.json();
    } catch {
      return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" } }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const fakeClient = {
      ws: null,
      id: `http_${Date.now()}`,
      initialized: false
    };
    const response = await this.routeRequest(fakeClient, request);
    return new Response(JSON.stringify(response), {
      headers: { "Content-Type": "application/json" }
    });
  }
  async routeRequest(client, request) {
    switch (request.method) {
      case "initialize":
        return this.handleInitialize(client, request);
      case "initialized":
        client.initialized = true;
        return null;
      case "tools/list":
        return this.handleToolsList(request);
      case "tools/call":
        return await this.handleToolsCall(request);
      case "ping":
        return {
          jsonrpc: "2.0",
          id: request.id ?? null,
          result: {}
        };
      default:
        return {
          jsonrpc: "2.0",
          id: request.id ?? null,
          error: {
            code: -32601,
            message: `Method not found: ${request.method}`
          }
        };
    }
  }
  handleInitialize(client, request) {
    const result = {
      capabilities: {
        tools: {
          listChanged: true
        }
      },
      serverInfo: {
        name: "MonsterWebMCP Local Relay",
        version: "1.0.0"
      },
      protocolVersion: "2025-03-26"
    };
    client.initialized = true;
    return {
      jsonrpc: "2.0",
      id: request.id ?? null,
      result
    };
  }
  handleToolsList(request) {
    const tools = this.getTools();
    return {
      jsonrpc: "2.0",
      id: request.id ?? null,
      result: { tools }
    };
  }
  async handleToolsCall(request) {
    const params = request.params ?? {};
    const toolName = params.name;
    const args = params.arguments ?? {};
    const tool = this.toolRegistry.get(toolName);
    if (!tool) {
      return {
        jsonrpc: "2.0",
        id: request.id ?? null,
        error: {
          code: -32602,
          message: `Tool not found: ${toolName}`
        }
      };
    }
    try {
      let result;
      if (this.toolExecutor) {
        result = await this.toolExecutor(toolName, args);
      } else {
        result = await tool.execute(args);
      }
      return {
        jsonrpc: "2.0",
        id: request.id ?? null,
        result
      };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id ?? null,
        result: {
          content: [
            {
              type: "text",
              text: error instanceof Error ? error.message : String(error)
            }
          ],
          isError: true
        }
      };
    }
  }
  broadcastToolChange(type, toolName) {
    const notification = {
      jsonrpc: "2.0",
      method: "notifications/tools/list_changed",
      params: { type, toolName }
    };
    const message = JSON.stringify(notification);
    for (const client of this.clients.values()) {
      try {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(message);
        }
      } catch {}
    }
  }
  sendError(ws, id, code, message) {
    const response = {
      jsonrpc: "2.0",
      id,
      error: { code, message }
    };
    try {
      ws.send(JSON.stringify(response));
    } catch {}
  }
}
// src/server/http-server.ts
class HTTPMCPServer {
  port;
  authToken;
  cors;
  corsOrigins;
  toolRegistry = new Map;
  toolExecutor = null;
  server = null;
  running = false;
  sseClients = new Set;
  constructor(config = {}) {
    this.port = config.port ?? 3001;
    this.authToken = config.authToken ?? null;
    this.cors = config.cors ?? true;
    this.corsOrigins = config.corsOrigins ?? ["*"];
  }
  async start() {
    if (this.running)
      return;
    const Bun = globalThis.Bun;
    if (!Bun) {
      throw new Error("HTTPMCPServer requires Bun runtime");
    }
    this.server = Bun.serve({
      port: this.port,
      fetch: async (req) => this.handleRequest(req)
    });
    this.running = true;
    console.log(`[MonsterWebMCP] HTTP MCP server started on http://localhost:${this.port}/mcp`);
  }
  stop() {
    if (!this.running)
      return;
    for (const client of this.sseClients) {
      try {
        client.close();
      } catch {}
    }
    this.sseClients.clear();
    if (this.server) {
      try {
        this.server.stop?.();
      } catch {}
      this.server = null;
    }
    this.running = false;
    console.log("[MonsterWebMCP] HTTP MCP server stopped");
  }
  registerTool(tool) {
    this.toolRegistry.set(tool.name, tool);
    this.broadcastSSE("tool_registered", { name: tool.name });
  }
  unregisterTool(name) {
    this.toolRegistry.delete(name);
    this.broadcastSSE("tool_unregistered", { name });
  }
  setToolExecutor(executor) {
    this.toolExecutor = executor;
  }
  getTools() {
    return Array.from(this.toolRegistry.values()).map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      annotations: tool.annotations
    }));
  }
  isRunning() {
    return this.running;
  }
  getPort() {
    return this.port;
  }
  async handleRequest(req) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") {
      return this.corsResponse(req);
    }
    const corsHeaders = this.cors ? this.getCorsHeaders(req) : {};
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", tools: this.toolRegistry.size, version: "1.0.0" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    if (url.pathname === "/mcp/sse" && req.method === "GET") {
      return this.handleSSE(req, corsHeaders);
    }
    if (url.pathname === "/mcp" && req.method === "POST") {
      if (this.authToken) {
        const auth = req.headers.get("Authorization");
        if (!auth || auth !== `Bearer ${this.authToken}`) {
          return new Response(JSON.stringify({ error: "Unauthorized", message: "Valid Bearer token required" }), {
            status: 401,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
      }
      return this.handleMCPRequest(req, corsHeaders);
    }
    return new Response("Not Found", {
      status: 404,
      headers: corsHeaders
    });
  }
  async handleMCPRequest(req, corsHeaders) {
    let request;
    try {
      request = await req.json();
    } catch {
      return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" } }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    const response = await this.routeRequest(request);
    return new Response(JSON.stringify(response), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  handleSSE(req, corsHeaders) {
    const stream = new ReadableStream({
      start: (controller) => {
        const encoder = new TextEncoder;
        controller.enqueue(encoder.encode(`event: connected
data: ${JSON.stringify({ message: "MonsterWebMCP SSE endpoint", version: "1.0.0" })}

`));
        const clientId = `sse_${Date.now()}`;
        const client = {
          id: clientId,
          send: (event, data) => {
            try {
              controller.enqueue(encoder.encode(`event: ${event}
data: ${JSON.stringify(data)}

`));
            } catch {
              this.sseClients.delete(client);
            }
          },
          close: () => {
            try {
              controller.close();
            } catch {}
          }
        };
        this.sseClients.add(client);
        const keepalive = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: keepalive

`));
          } catch {
            clearInterval(keepalive);
            this.sseClients.delete(client);
          }
        }, 30000);
        req.signal.addEventListener("abort", () => {
          clearInterval(keepalive);
          this.sseClients.delete(client);
          try {
            controller.close();
          } catch {}
        });
      }
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        ...corsHeaders
      }
    });
  }
  async routeRequest(request) {
    switch (request.method) {
      case "initialize":
        return this.handleInitialize(request);
      case "initialized":
        return { jsonrpc: "2.0", id: request.id ?? null, result: {} };
      case "tools/list":
        return this.handleToolsList(request);
      case "tools/call":
        return await this.handleToolsCall(request);
      case "ping":
        return { jsonrpc: "2.0", id: request.id ?? null, result: {} };
      case "completion/complete":
        return {
          jsonrpc: "2.0",
          id: request.id ?? null,
          result: { completion: { values: [], total: 0, hasMore: false } }
        };
      case "logging/setLevel":
        return { jsonrpc: "2.0", id: request.id ?? null, result: {} };
      default:
        return {
          jsonrpc: "2.0",
          id: request.id ?? null,
          error: {
            code: -32601,
            message: `Method not found: ${request.method}`
          }
        };
    }
  }
  handleInitialize(request) {
    const result = {
      capabilities: {
        tools: {
          listChanged: true
        }
      },
      serverInfo: {
        name: "MonsterWebMCP HTTP Server",
        version: "1.0.0"
      },
      protocolVersion: "2025-03-26"
    };
    return {
      jsonrpc: "2.0",
      id: request.id ?? null,
      result
    };
  }
  handleToolsList(request) {
    return {
      jsonrpc: "2.0",
      id: request.id ?? null,
      result: {
        tools: this.getTools()
      }
    };
  }
  async handleToolsCall(request) {
    const params = request.params ?? {};
    const toolName = params.name;
    const args = params.arguments ?? {};
    const tool = this.toolRegistry.get(toolName);
    if (!tool) {
      return {
        jsonrpc: "2.0",
        id: request.id ?? null,
        error: {
          code: -32602,
          message: `Tool not found: ${toolName}`
        }
      };
    }
    try {
      let result;
      if (this.toolExecutor) {
        result = await this.toolExecutor(toolName, args);
      } else {
        result = await tool.execute(args);
      }
      return {
        jsonrpc: "2.0",
        id: request.id ?? null,
        result
      };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id ?? null,
        result: {
          content: [
            {
              type: "text",
              text: error instanceof Error ? error.message : String(error)
            }
          ],
          isError: true
        }
      };
    }
  }
  broadcastSSE(event, data) {
    for (const client of this.sseClients) {
      try {
        client.send(event, data);
      } catch {
        this.sseClients.delete(client);
      }
    }
  }
  getCorsHeaders(req) {
    if (!this.cors)
      return {};
    const origin = req.headers.get("Origin") ?? "*";
    const allowedOrigin = this.corsOrigins.includes("*") ? "*" : this.corsOrigins.includes(origin) ? origin : "";
    return {
      "Access-Control-Allow-Origin": allowedOrigin || "null",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    };
  }
  corsResponse(req) {
    return new Response(null, {
      status: 204,
      headers: this.getCorsHeaders(req)
    });
  }
}
export {
  validateArguments,
  isValidJsonSchema,
  formatValidationErrors,
  TypeSafeEventEmitter,
  TransportFactory,
  ToolRegistry,
  SecurityManager,
  RateLimiter,
  PolyfillTransport,
  NativeTransport,
  MonsterMCP,
  MemoryTransport,
  LocalRelay,
  HTTPTransport,
  HTTPMCPServer,
  DeclarativeProcessor
};

//# debugId=23679ADE1ECF872164756E2164756E21
//# sourceMappingURL=monster-webmcp.esm.js.map
