# MonsterWebMCP

**Production-ready, universally-compatible WebMCP runtime**

MonsterWebMCP bridges the W3C WebMCP standard (`document.modelContext`) with the existing MCP ecosystem, enabling **any website** to expose structured, callable tools to AI agents — natively through the browser's WebMCP API when available, with seamless fallback to a polyfill-powered transport layer when not.

## Features

- **Native WebMCP support** — Uses `document.modelContext` (Chrome 146+) as primary transport
- **Universal polyfill** — Works in all browsers via spec-compliant polyfill fallback
- **Declarative HTML forms** — `<form toolname="...">` attributes auto-register tools
- **Security by default** — Same-origin enforcement, cross-origin opt-in via `exposedTo`
- **Per-tool rate limiting** — Token bucket algorithm with configurable limits
- **MCP server bridge** — Local WebSocket relay (port 12306) + HTTP MCP server
- **Zero-config** — Include one script tag, register tools, done
- **Type-safe** — Full TypeScript support with comprehensive type definitions

## Quick Start

### Browser (CDN)

```html
<script src="https://cdn.monsterwebmcp.dev/v1/monster-webmcp.min.js"></script>
<script>
  const mcp = new MonsterMCP();

  mcp.registerTool({
    name: 'greet',
    description: 'Generate a greeting',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name to greet' }
      },
      required: ['name']
    },
    execute: async (args) => ({
      content: [{ type: 'text', text: `Hello, ${args.name}!` }]
    })
  });
</script>
```

### NPM

```bash
npm install monster-webmcp
```

```typescript
import { MonsterMCP } from 'monster-webmcp';

const mcp = new MonsterMCP();

mcp.registerTool({
  name: 'search',
  description: 'Search the product catalog',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search keyword' }
    },
    required: ['query']
  },
  execute: async (args) => {
    const results = await fetch(`/api/search?q=${args.query}`);
    const data = await results.json();
    return { content: [{ type: 'text', text: JSON.stringify(data) }] };
  }
});
```

## API

### `new MonsterMCP(options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `webmcp` | `boolean` | `true` | Use native `document.modelContext` |
| `polyfill` | `boolean` | `true` | Fall back to polyfill |
| `traditionalMcp` | `boolean` | `false` | Enable HTTP/SSE MCP transport |
| `mcpTransport` | `MCPTransportConfig` | — | HTTP/SSE transport config |
| `declarative` | `boolean` | `true` | Process HTML form attributes |
| `allowedOrigins` | `string[]` | `[]` | Globally allowed origins |
| `rateLimits` | `Record<string, RateLimitConfig>` | `{}` | Per-tool rate limits |
| `defaultRateLimit` | `RateLimitConfig` | `{maxRequests:100,windowMs:60000}` | Default rate limit |
| `debug` | `boolean` | `false` | Enable debug logging |

### `registerTool(tool, options?)`

Register a tool with the runtime.

```typescript
mcp.registerTool({
  name: 'my_tool',           // 1-128 chars, alphanumeric/_/-/.
  title: 'My Tool',          // Human-readable title
  description: 'What it does', // Required
  inputSchema: {              // JSON Schema
    type: 'object',
    properties: { /* ... */ },
    required: ['param1']
  },
  outputSchema: { /* ... */ }, // Optional
  annotations: {               // Optional safety hints
    readOnlyHint: true,
    idempotentHint: true,
  },
  execute: async (args, signal) => {
    return {
      content: [{ type: 'text', text: 'Result' }],
      isError: false
    };
  }
}, {
  signal: abortController.signal,  // AbortSignal for lifecycle
  exposedTo: ['https://agent.example.com'],  // Cross-origin opt-in
  rateLimit: { maxRequests: 50, windowMs: 60000 },  // Per-tool limit
});
```

### `unregisterTool(name)`

Remove a tool by name.

### `getTools()`

Returns an array of all registered tool info objects.

### `executeTool(name, args?)`

Execute a tool by name with the given arguments.

```typescript
const result = await mcp.executeTool('greet', { name: 'World' });
// result.content[0].text === "Hello, World!"
```

### `onToolChange(callback)`

Subscribe to tool change events. Returns an unsubscribe function.

```typescript
const unsub = mcp.onToolChange((event) => {
  console.log(event.type, event.toolName);
  // event.type: 'registered' | 'unregistered' | 'updated'
});
// Later: unsub();
```

### `destroy()`

Clean up all resources, abort pending operations, and unregister all tools.

## Declarative HTML Forms

MonsterWebMCP automatically processes `<form>` elements with the `toolname` attribute:

```html
<form toolname="checkout" tooldescription="Start checkout" toolautosubmit>
  <input name="shipping_method" toolparamdescription="Shipping method" required>
  <input name="discount_code" toolparamdescription="Optional promo code">
</form>
```

### Supported Attributes

| Attribute | Element | Description |
|-----------|---------|-------------|
| `toolname` | `<form>` | Registers the form as a tool with this name |
| `tooldescription` | `<form>` | Tool description |
| `toolautosubmit` | `<form>` | Auto-submit form when tool is called |
| `toolparamdescription` | `<input>`, `<select>`, `<textarea>` | Parameter description in JSON Schema |

### Handling Form Submissions

```javascript
document.querySelector('form[toolname="checkout"]')
  .addEventListener('submit', (e) => {
    e.preventDefault();
    // Process checkout...
    e.respondWith({
      content: [{ type: 'text', text: 'Order placed!' }]
    });
  });
```

## Transport Layer

MonsterWebMCP auto-detects the best available transport:

1. **Native** (`document.modelContext`) — Chrome 146+ with WebMCP flag
2. **Polyfill** — Spec-compliant in-browser implementation
3. **In-memory** — Fallback for SSR/test environments
4. **HTTP/SSE** — Opt-in transport for traditional MCP clients

```typescript
// Check transport status
mcp.getTransportType();  // 'native' | 'polyfill' | 'memory' | 'http'
mcp.isNativeAvailable(); // true if document.modelContext exists
```

## Security

- **Same-origin by default** — Only the page's origin can execute tools
- **Cross-origin opt-in** — Use `exposedTo` to allow specific origins
- **Tool name validation** — 1-128 characters, alphanumeric/underscore/hyphen/period only
- **Input schema validation** — All arguments validated against JSON Schema
- **Per-tool rate limiting** — Token bucket with configurable limits
- **Tool annotations** — Safety hints for AI agents (readOnly, destructive, etc.)

## Server Components

### Local Relay (WebSocket)

Bridges browser tools to desktop MCP clients (Claude Desktop, Cursor, etc.):

```typescript
import { LocalRelay } from 'monster-webmcp/server';

const relay = new LocalRelay({ port: 12306 });
await relay.start();
relay.registerTool(myToolDefinition);
relay.setToolExecutor(async (name, args) => {
  return await browserSideExecute(name, args);
});
```

### HTTP MCP Server

HTTP endpoint for cloud-based MCP clients:

```typescript
import { HTTPMCPServer } from 'monster-webmcp/server';

const server = new HTTPMCPServer({
  port: 3001,
  authToken: 'my-secret-token',
  cors: true,
});
await server.start();
server.registerTool(myToolDefinition);
```

## Build

```bash
# Browser bundle
bun run build

# ESM bundle
bun run build:esm

# Node.js server components
bun run build:node

# All
bun run build:all
```

## Browser Compatibility

| Browser | Transport | Notes |
|---------|-----------|-------|
| Chrome 146+ | Native | Enable WebMCP flag |
| Chrome 90+ | Polyfill | Full support |
| Firefox 90+ | Polyfill | Full support |
| Safari 15+ | Polyfill | Full support |
| Edge 90+ | Polyfill | Full support |
| Node.js/Bun | In-memory | Server components |


## License

*Copyright (c) 2026 VLABS, LLC. All rights reserved.* <br>
*[VRIL LABS Open Source License v1.0](https://github.com/VRIL-LABS/vril-zip/blob/main/LICENSE) — https://vril.li/license*.
