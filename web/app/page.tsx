'use client';

import { motion } from 'framer-motion';
import {
  Zap,
  Globe,
  Shield,
  Box,
  Terminal,
  BookOpen,
  Download,
  Layers,
  Monitor,
  Code2,
  Lock,
  Server,
  Palette,
  FileCode,
  LayoutGrid,
  Settings,
  ArrowRight,
  Github,
  Heart,
  Cpu,
  Wifi,
  CheckCircle2,
  FileJson,
  GitBranch,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CodeBlock } from '@/components/code-block';
import { DocSection } from '@/components/doc-section';

/* ────────────────────────────────────────────────────────────────── */
/*  Animation variants                                               */
/* ────────────────────────────────────────────────────────────────── */

const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

/* ────────────────────────────────────────────────────────────────── */
/*  Data                                                             */
/* ────────────────────────────────────────────────────────────────── */

const monsterFeatures = [
  { icon: <Globe className="h-4 w-4" />, text: '4-transport auto-detection cascade' },
  { icon: <Shield className="h-4 w-4" />, text: 'Same-origin + exposedTo security model' },
  { icon: <Box className="h-4 w-4" />, text: 'Declarative <form toolname> processor' },
  { icon: <Zap className="h-4 w-4" />, text: '9.6 KB gzipped browser bundle' },
  { icon: <Terminal className="h-4 w-4" />, text: 'W3C document.modelContext spec-aligned' },
  { icon: <Layers className="h-4 w-4" />, text: 'HTTP/SSE + WebSocket relay servers' },
];

const figmaFeatures = [
  { icon: <Palette className="h-4 w-4" />, text: '7 Figma REST API tools' },
  { icon: <Shield className="h-4 w-4" />, text: 'Bearer token authentication' },
  { icon: <Cloud className="h-4 w-4" />, text: 'Cloudflare Worker deployment' },
  { icon: <Server className="h-4 w-4" />, text: 'Standalone Bun server' },
  { icon: <FileJson className="h-4 w-4" />, text: 'JSON-RPC 2.0 MCP protocol' },
  { icon: <Monitor className="h-4 w-4" />, text: 'Rate limit awareness' },
];

const comparisonRows = [
  { feature: 'Transport', monster: 'Native → Polyfill → Memory → HTTP/SSE', figma: 'HTTPS POST (JSON-RPC 2.0)' },
  { feature: 'Authentication', monster: 'Same-origin + exposedTo', figma: 'Bearer token + Figma PAT' },
  { feature: 'Browser Support', monster: 'All modern browsers', figma: 'Server-side (Worker / Bun)' },
  { feature: 'MCP Compatibility', monster: 'W3C WebMCP + Traditional MCP', figma: 'Traditional MCP (JSON-RPC)' },
  { feature: 'WebMCP Native', monster: '✓ document.modelContext', figma: '—' },
  { feature: 'Deployment', monster: 'CDN / NPM / Bun', figma: 'Cloudflare Worker / Bun' },
  { feature: 'Bundle Size', monster: '9.6 KB gzipped', figma: 'Server-side only' },
  { feature: 'Tools', monster: 'User-defined (registerTool)', figma: '7 built-in Figma tools' },
  { feature: 'Declarative API', monster: '<form toolname="…">', figma: '—' },
  { feature: 'Rate Limiting', monster: 'Token bucket per-tool', figma: 'Figma API rate limit parsing' },
  { feature: 'Protocol Version', monster: 'W3C WebMCP Draft', figma: 'MCP 2024-11-05' },
];

const figmaTools = [
  {
    name: 'get_figma_file',
    description: 'Retrieve the document tree of a Figma file including all pages, frames, and layers. Supports depth control for limiting traversal.',
    params: [{ name: 'file_key', type: 'string', required: true, desc: 'Figma file key from URL' }, { name: 'depth', type: 'number', required: false, desc: 'Tree traversal depth (default: 2)' }],
    api: 'GET /v1/files/:file_key',
  },
  {
    name: 'get_figma_node',
    description: 'Retrieve a specific node (frame, component, layer) from a Figma file by its node ID. Handles URL-encoding automatically.',
    params: [{ name: 'file_key', type: 'string', required: true, desc: 'Figma file key' }, { name: 'node_id', type: 'string', required: true, desc: 'Node ID to retrieve' }],
    api: 'GET /v1/files/:file_key/nodes',
  },
  {
    name: 'get_figma_components',
    description: 'List all published components in a Figma file. Returns component metadata including name, description, and properties.',
    params: [{ name: 'file_key', type: 'string', required: true, desc: 'Figma file key' }],
    api: 'GET /v1/files/:file_key/components',
  },
  {
    name: 'get_figma_variables',
    description: 'Retrieve all local variables (design tokens) from a Figma file. Includes colors, spacing, typography, and other design tokens.',
    params: [{ name: 'file_key', type: 'string', required: true, desc: 'Figma file key' }],
    api: 'GET /v1/files/:file_key/variables/local',
  },
  {
    name: 'get_figma_comments',
    description: 'Retrieve all comments on a Figma file. Returns author, timestamp, message text, and location of each comment.',
    params: [{ name: 'file_key', type: 'string', required: true, desc: 'Figma file key' }],
    api: 'GET /v1/files/:file_key/comments',
  },
  {
    name: 'get_team_components',
    description: 'List all published components across the entire Figma team or organization. Supports pagination for large libraries.',
    params: [{ name: 'team_id', type: 'string', required: true, desc: 'Figma team ID' }, { name: 'page', type: 'number', required: false, desc: 'Page number (default: 1)' }],
    api: 'GET /v1/teams/:team_id/components',
  },
  {
    name: 'get_figma_styles',
    description: 'Retrieve all shared styles (fills, text, effects, grids) from a Figma file. These are the design system primitives.',
    params: [{ name: 'file_key', type: 'string', required: true, desc: 'Figma file key' }],
    api: 'GET /v1/files/:file_key/styles',
  },
];

/* ────────────────────────────────────────────────────────────────── */
/*  Section Components                                               */
/* ────────────────────────────────────────────────────────────────── */

function Cloud(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </svg>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-20 pb-24 md:pt-32 md:pb-36">
      {/* Background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-accent-1/10 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-accent-2/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-1/5 rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
        <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
          <motion.div variants={fadeInUp} custom={0}>
            <Badge variant="outline" className="mb-6 border-accent-1/30 text-accent-1 bg-accent-1/5 px-4 py-1.5 text-sm">
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              WebMCP-Powered Tools
            </Badge>
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            custom={1}
            className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-6 animate-gradient bg-clip-text text-transparent bg-gradient-to-r from-accent-1 via-accent-2 to-accent-1"
          >
            MonsterWebMCP
            <br />
            <span className="text-text">&amp;</span>{' '}
            Figma MCP Access
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            custom={2}
            className="text-lg md:text-xl text-text-dim max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Universally Compatible WebMCP Tools for the Agentic Web.
            <br className="hidden md:block" />
            Bridge browsers, AI agents, and design systems with spec-aligned protocols.
          </motion.p>

          <motion.div variants={fadeInUp} custom={3} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="bg-accent-1 hover:bg-accent-1/90 text-white px-8 h-12 text-base glow-violet"
              onClick={() => document.getElementById('monster-docs')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <Globe className="h-4 w-4 mr-2" />
              Explore MonsterWebMCP
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-accent-2/40 text-accent-2 hover:bg-accent-2/10 hover:border-accent-2/60 px-8 h-12 text-base"
              onClick={() => document.getElementById('figma-docs')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <Palette className="h-4 w-4 mr-2" />
              Explore Figma MCP Access
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function ToolsGridSection() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={staggerContainer}
          className="grid md:grid-cols-2 gap-6"
        >
          {/* MonsterWebMCP Card */}
          <motion.div variants={fadeInUp} custom={0}>
            <Card className="border-accent-1/20 bg-surface/50 hover:border-accent-1/40 transition-all duration-300 glow-violet h-full">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 rounded-lg bg-accent-1/10 border border-accent-1/20">
                    <Globe className="h-6 w-6 text-accent-1" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-text">MonsterWebMCP</h3>
                    <Badge variant="secondary" className="text-xs bg-accent-1/10 text-accent-1 border-accent-1/20 mt-1">Browser Runtime</Badge>
                  </div>
                </div>
                <p className="text-text-dim text-sm leading-relaxed">
                  A production-ready, universally-compatible WebMCP runtime that bridges W3C
                  WebMCP (<code className="text-accent-1/80 text-xs">document.modelContext</code>) with
                  the MCP ecosystem. Auto-detects native browser support, falls back to polyfill,
                  and provides traditional MCP server transports.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2.5">
                  {monsterFeatures.map((f, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-sm text-text-dim">
                      <span className="text-accent-1">{f.icon}</span>
                      {f.text}
                    </div>
                  ))}
                </div>
                <Separator className="bg-border-custom/50" />
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button className="flex-1 bg-accent-1 hover:bg-accent-1/90 text-white" size="sm">
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Download 9.6 KB
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-accent-1/30 text-accent-1 hover:bg-accent-1/10"
                    onClick={() => document.getElementById('monster-docs')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                    Documentation
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Figma MCP Access Card */}
          <motion.div variants={fadeInUp} custom={1}>
            <Card className="border-accent-2/20 bg-surface/50 hover:border-accent-2/40 transition-all duration-300 glow-pink h-full">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 rounded-lg bg-accent-2/10 border border-accent-2/20">
                    <Palette className="h-6 w-6 text-accent-2" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-text">Figma MCP Access</h3>
                    <Badge variant="secondary" className="text-xs bg-accent-2/10 text-accent-2 border-accent-2/20 mt-1">Server Proxy</Badge>
                  </div>
                </div>
                <p className="text-text-dim text-sm leading-relaxed">
                  A Cloudflare Worker-based MCP server that wraps the Figma REST API,
                  enabling GitHub Copilot Cloud Agent and other MCP clients to access
                  Figma design data without browser-based OAuth. Full JSON-RPC 2.0 protocol.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2.5">
                  {figmaFeatures.map((f, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-sm text-text-dim">
                      <span className="text-accent-2">{f.icon}</span>
                      {f.text}
                    </div>
                  ))}
                </div>
                <Separator className="bg-border-custom/50" />
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button className="flex-1 bg-accent-2 hover:bg-accent-2/90 text-white" size="sm">
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Get Source
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-accent-2/30 text-accent-2 hover:bg-accent-2/10"
                    onClick={() => document.getElementById('figma-docs')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                    Documentation
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function ComparisonSection() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-text mb-4">Feature Comparison</h2>
            <p className="text-text-dim text-lg">Side-by-side comparison of both tools</p>
          </div>

          <div className="rounded-xl border border-border-custom overflow-hidden bg-surface/30">
            <Table>
              <TableHeader>
                <TableRow className="border-border-custom hover:bg-transparent">
                  <TableHead className="text-text-dim font-semibold w-1/4">Feature</TableHead>
                  <TableHead className="text-accent-1 font-semibold">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" /> MonsterWebMCP
                    </div>
                  </TableHead>
                  <TableHead className="text-accent-2 font-semibold">
                    <div className="flex items-center gap-2">
                      <Palette className="h-4 w-4" /> Figma MCP Access
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisonRows.map((row) => (
                  <TableRow key={row.feature} className="border-border-custom/50 hover:bg-surface-hover/30">
                    <TableCell className="font-medium text-text">{row.feature}</TableCell>
                    <TableCell className="text-text-dim text-sm">{row.monster}</TableCell>
                    <TableCell className="text-text-dim text-sm">{row.figma}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function MonsterDocsSection() {
  return (
    <section id="monster-docs" className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-12">
            <Badge variant="outline" className="border-accent-1/30 text-accent-1 bg-accent-1/5 mb-4">
              <Globe className="h-3.5 w-3.5 mr-1.5" />
              Documentation
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-text mb-4">MonsterWebMCP</h2>
            <p className="text-text-dim text-lg max-w-2xl mx-auto">
              A production-ready WebMCP runtime that bridges the W3C WebMCP specification with the MCP ecosystem
            </p>
          </div>

          <div className="space-y-3">
            <DocSection title="Overview" icon={<BookOpen className="h-4 w-4" />} accent="violet" defaultOpen>
              <p className="text-text-dim text-sm leading-relaxed">
                MonsterWebMCP is a universal WebMCP runtime that implements the W3C WebMCP specification
                (<code className="text-accent-1/80 text-xs">document.modelContext</code>) while maintaining
                full compatibility with the existing MCP ecosystem. It features a 4-transport auto-detection
                cascade, declarative form processing, a comprehensive security model, and optional traditional
                MCP server transports.
              </p>
              <div className="mt-4 p-4 rounded-lg bg-[#0d0d10] border border-border-custom">
                <p className="text-xs text-text-dim mb-2 font-mono">Architecture</p>
                <pre className="text-xs text-[#a1a1aa] font-mono leading-relaxed">{`Browser Page
    │
    ▼
┌──────────────────────────────────────────────┐
│  MonsterMCP (API Surface)                    │
│  registerTool() / executeTool() / getTools() │
│  Declarative: <form toolname="...">          │
├──────────────────────────────────────────────┤
│  Transport Detection Layer                   │
│  Native → Polyfill → In-Memory → HTTP/SSE   │
├──────────────────────────────────────────────┤
│  Security Layer                              │
│  Same-origin + exposedTo + Rate Limiting     │
└──────────────────────────────────────────────┘`}</pre>
              </div>
            </DocSection>

            <DocSection title="Installation" icon={<Download className="h-4 w-4" />} accent="violet">
              <p className="text-text-dim text-sm mb-3">Install MonsterWebMCP via CDN, NPM, or Bun:</p>
              <Tabs defaultValue="cdn" className="w-full">
                <TabsList className="bg-surface border border-border-custom">
                  <TabsTrigger value="cdn" className="text-xs data-[state=active]:bg-accent-1/10 data-[state=active]:text-accent-1">CDN</TabsTrigger>
                  <TabsTrigger value="npm" className="text-xs data-[state=active]:bg-accent-1/10 data-[state=active]:text-accent-1">NPM</TabsTrigger>
                  <TabsTrigger value="bun" className="text-xs data-[state=active]:bg-accent-1/10 data-[state=active]:text-accent-1">Bun</TabsTrigger>
                </TabsList>
                <TabsContent value="cdn">
                  <CodeBlock
                    code={`<!-- Minified bundle (9.6 KB gzipped) -->
<script src="https://unpkg.com/monster-webmcp@latest/dist/monster-webmcp.js"></script>

<!-- ESM module -->
<script type="module">
  import { MonsterMCP } from 'https://unpkg.com/monster-webmcp@latest/dist/monster-webmcp.esm.js';
</script>`}
                    language="html"
                    filename="index.html"
                  />
                </TabsContent>
                <TabsContent value="npm">
                  <CodeBlock
                    code={`npm install monster-webmcp`}
                    language="bash"
                    filename="Terminal"
                  />
                </TabsContent>
                <TabsContent value="bun">
                  <CodeBlock
                    code={`bun add monster-webmcp`}
                    language="bash"
                    filename="Terminal"
                  />
                </TabsContent>
              </Tabs>
            </DocSection>

            <DocSection title="API Reference" icon={<Code2 className="h-4 w-4" />} accent="violet">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-text mb-2 flex items-center gap-2">
                    <span className="text-accent-1 font-mono text-xs bg-accent-1/10 px-2 py-0.5 rounded">registerTool</span>
                  </h4>
                  <p className="text-text-dim text-sm mb-2">Register a tool with the MCP runtime. Spec-aligned with W3C <code className="text-accent-1/80 text-xs">document.modelContext.registerTool()</code>.</p>
                  <CodeBlock
                    code={`import { MonsterMCP } from 'monster-webmcp';

const mcp = new MonsterMCP();

mcp.registerTool({
  name: 'greet',
  description: 'Generate a personalized greeting',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Person to greet' },
      language: { type: 'string', enum: ['en', 'es', 'fr'] }
    },
    required: ['name']
  },
  execute: async (args) => {
    const greetings = { en: 'Hello', es: 'Hola', fr: 'Bonjour' };
    const greeting = greetings[args.language as string] || greetings.en;
    return {
      content: [{ type: 'text', text: \`\${greeting}, \${args.name}!\` }]
    };
  }
}, {
  exposedTo: ['https://trusted-agent.example.com'],
  annotations: { readOnlyHint: true, idempotentHint: true }
});`}
                    language="typescript"
                    filename="register-tool.ts"
                  />
                </div>
                <Separator className="bg-border-custom/30" />
                <div>
                  <h4 className="text-sm font-semibold text-text mb-2 flex items-center gap-2">
                    <span className="text-accent-1 font-mono text-xs bg-accent-1/10 px-2 py-0.5 rounded">unregisterTool</span>
                  </h4>
                  <p className="text-text-dim text-sm">Remove a tool by name. Cleans up abort controllers, security metadata, and transport registrations.</p>
                  <CodeBlock
                    code={`mcp.unregisterTool('greet');`}
                    language="typescript"
                  />
                </div>
                <Separator className="bg-border-custom/30" />
                <div>
                  <h4 className="text-sm font-semibold text-text mb-2 flex items-center gap-2">
                    <span className="text-accent-1 font-mono text-xs bg-accent-1/10 px-2 py-0.5 rounded">executeTool</span>
                  </h4>
                  <p className="text-text-dim text-sm">Execute a registered tool by name with input validation and security checks.</p>
                  <CodeBlock
                    code={`const result = await mcp.executeTool('greet', { name: 'World', language: 'es' });
// result.content[0].text → "Hola, World!"`}
                    language="typescript"
                  />
                </div>
                <Separator className="bg-border-custom/30" />
                <div>
                  <h4 className="text-sm font-semibold text-text mb-2 flex items-center gap-2">
                    <span className="text-accent-1 font-mono text-xs bg-accent-1/10 px-2 py-0.5 rounded">getTools</span>
                  </h4>
                  <p className="text-text-dim text-sm">Returns an array of <code className="text-accent-1/80 text-xs">ToolInfo</code> objects for all registered tools.</p>
                  <CodeBlock
                    code={`const tools = mcp.getTools();
// [{ name: 'greet', description: 'Generate a personalized greeting', inputSchema: {...} }]`}
                    language="typescript"
                  />
                </div>
                <Separator className="bg-border-custom/30" />
                <div>
                  <h4 className="text-sm font-semibold text-text mb-2 flex items-center gap-2">
                    <span className="text-accent-1 font-mono text-xs bg-accent-1/10 px-2 py-0.5 rounded">onToolChange</span>
                  </h4>
                  <p className="text-text-dim text-sm">Subscribe to tool lifecycle events. Returns an unsubscribe function.</p>
                  <CodeBlock
                    code={`const unsubscribe = mcp.onToolChange((event) => {
  console.log(\`\${event.type}: \${event.toolName}\`);
  // event.type: 'registered' | 'unregistered' | 'updated'
});

// Later: unsubscribe();`}
                    language="typescript"
                  />
                </div>
                <Separator className="bg-border-custom/30" />
                <div>
                  <h4 className="text-sm font-semibold text-text mb-2 flex items-center gap-2">
                    <span className="text-accent-1 font-mono text-xs bg-accent-1/10 px-2 py-0.5 rounded">destroy</span>
                  </h4>
                  <p className="text-text-dim text-sm">Destroy the MonsterMCP instance and clean up all resources including transports, registry, and security manager.</p>
                  <CodeBlock
                    code={`mcp.destroy();`}
                    language="typescript"
                  />
                </div>
              </div>
            </DocSection>

            <DocSection title="Transport Layer" icon={<Wifi className="h-4 w-4" />} accent="violet">
              <p className="text-text-dim text-sm leading-relaxed mb-3">
                MonsterWebMCP features a 4-transport auto-detection cascade. The <code className="text-accent-1/80 text-xs">TransportFactory</code> automatically
                selects the best available transport:
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-accent-1/5 border border-accent-1/10">
                  <CheckCircle2 className="h-4 w-4 text-accent-1 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-text">Native Transport</p>
                    <p className="text-xs text-text-dim">Uses <code className="text-accent-1/80">document.modelContext</code> (Chrome 146+). Direct browser integration with the W3C WebMCP specification.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-surface/50 border border-border-custom/30">
                  <CheckCircle2 className="h-4 w-4 text-text-dim mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-text">Polyfill Transport</p>
                    <p className="text-xs text-text-dim">Global namespace-based polyfill for browsers without native support. Works on any modern browser.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-surface/50 border border-border-custom/30">
                  <CheckCircle2 className="h-4 w-4 text-text-dim mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-text">In-Memory Transport</p>
                    <p className="text-xs text-text-dim">Fallback for SSR and testing environments. No browser APIs required.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-surface/50 border border-border-custom/30">
                  <CheckCircle2 className="h-4 w-4 text-text-dim mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-text">HTTP/SSE Transport</p>
                    <p className="text-xs text-text-dim">Opt-in traditional MCP transport. HTTP server with SSE for real-time notifications and Bearer auth.</p>
                  </div>
                </div>
              </div>
              <CodeBlock
                code={`// Auto-detection (default behavior)
const mcp = new MonsterMCP();
console.log(mcp.getTransportType()); // 'native' | 'polyfill' | 'memory'

// Explicit traditional MCP
const mcpServer = new MonsterMCP({
  traditionalMcp: true,
  mcpTransport: {
    type: 'http',
    port: 3001,
    auth: 'bearer',
    token: 'my-secret-token'
  }
});

// Check native availability
console.log(mcp.isNativeAvailable()); // true in Chrome 146+`}
                language="typescript"
                filename="transport-detection.ts"
              />
            </DocSection>

            <DocSection title="Declarative Forms" icon={<LayoutGrid className="h-4 w-4" />} accent="violet">
              <p className="text-text-dim text-sm leading-relaxed mb-3">
                MonsterWebMCP implements the W3C declarative API via a <code className="text-accent-1/80 text-xs">MutationObserver</code> that
                watches for <code className="text-accent-1/80 text-xs">&lt;form toolname=&quot;…&quot;&gt;</code> elements. Form input types are
                automatically converted to JSON Schema:
              </p>
              <CodeBlock
                code={`<!-- Declarative tool registration via HTML -->
<form toolname="search-products" toolautosubmit>
  <input type="text" name="query"
         toolparamdescription="Search query string"
         placeholder="Search products..."
         required />
  <select name="category" toolparamdescription="Product category">
    <option value="all">All</option>
    <option value="electronics">Electronics</option>
    <option value="clothing">Clothing</option>
  </select>
  <input type="number" name="limit"
         toolparamdescription="Max results"
         min="1" max="50" value="10" />
  <input type="checkbox" name="in_stock"
         toolparamdescription="Only show in-stock items" />
  <button type="submit">Search</button>
</form>

<!-- The form is automatically converted to an MCP tool:
{
  name: "search-products",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query string" },
      category: { type: "string", enum: ["all","electronics","clothing"],
                  description: "Product category" },
      limit: { type: "number", description: "Max results",
               minimum: 1, maximum: 50 },
      in_stock: { type: "boolean", description: "Only show in-stock items" }
    },
    required: ["query"]
  }
} -->`}
                language="html"
                filename="declarative-form.html"
              />
            </DocSection>

            <DocSection title="Security Model" icon={<Lock className="h-4 w-4" />} accent="violet">
              <p className="text-text-dim text-sm leading-relaxed mb-3">
                MonsterWebMCP implements a multi-layered security model aligned with W3C WebMCP security considerations:
              </p>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-surface/50 border border-border-custom/30">
                  <p className="text-sm font-medium text-text mb-1">Same-Origin Enforcement</p>
                  <p className="text-xs text-text-dim">By default, tools are only accessible from the same origin that registered them. Cross-origin access requires explicit <code className="text-accent-1/80">exposedTo</code> declaration.</p>
                </div>
                <div className="p-3 rounded-lg bg-surface/50 border border-border-custom/30">
                  <p className="text-sm font-medium text-text mb-1">Origin Validation</p>
                  <p className="text-xs text-text-dim">All tool executions validate the caller origin against the allowlist. Invalid origins receive a security error response.</p>
                </div>
                <div className="p-3 rounded-lg bg-surface/50 border border-border-custom/30">
                  <p className="text-sm font-medium text-text mb-1">Rate Limiting</p>
                  <p className="text-xs text-text-dim">Token bucket algorithm with configurable per-tool limits. Prevents tool abuse and resource exhaustion.</p>
                </div>
                <div className="p-3 rounded-lg bg-surface/50 border border-border-custom/30">
                  <p className="text-sm font-medium text-text mb-1">Input Validation</p>
                  <p className="text-xs text-text-dim">Zero-dependency JSON Schema validation. Tool names must match <code className="text-accent-1/80">/^[a-zA-Z0-9_\-.]{1,128}$/</code>.</p>
                </div>
              </div>
              <CodeBlock
                code={`const mcp = new MonsterMCP({
  allowedOrigins: ['https://trusted-agent.example.com'],
  defaultRateLimit: { maxRequests: 100, windowMs: 60000 },
  rateLimits: {
    'search-products': { maxRequests: 30, windowMs: 60000 }
  }
});

mcp.registerTool(tool, {
  exposedTo: ['https://partner-app.example.com'],
  rateLimit: { maxRequests: 10, windowMs: 30000 },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    untrustedContentHint: false
  }
});`}
                language="typescript"
                filename="security-config.ts"
              />
            </DocSection>

            <DocSection title="Server Components" icon={<Server className="h-4 w-4" />} accent="violet">
              <p className="text-text-dim text-sm leading-relaxed mb-3">
                MonsterWebMCP includes optional server components for traditional MCP connectivity:
              </p>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-accent-1/5 border border-accent-1/10">
                  <p className="text-sm font-medium text-text mb-1">Local Relay (WebSocket)</p>
                  <p className="text-xs text-text-dim">Bun WebSocket server on <code className="text-accent-1/80">ws://localhost:12306</code> for desktop MCP clients. Implements full MCP JSON-RPC protocol.</p>
                </div>
                <div className="p-3 rounded-lg bg-accent-1/5 border border-accent-1/10">
                  <p className="text-sm font-medium text-text mb-1">HTTP Server</p>
                  <p className="text-xs text-text-dim">HTTP MCP server on port 3001 with Bearer auth, SSE for real-time notifications, and CORS support.</p>
                </div>
              </div>
              <CodeBlock
                code={`// Start local relay for desktop MCP clients
import { LocalRelay } from 'monster-webmcp/server/local-relay';

const relay = new LocalRelay({
  port: 12306,
  authToken: 'optional-bearer-token'
});
relay.start();

// Start HTTP MCP server
import { HTTPServer } from 'monster-webmcp/server/http-server';

const server = new HTTPServer({
  port: 3001,
  authToken: 'my-secret',
  cors: true,
  corsOrigins: ['https://client.example.com']
});
server.start();`}
                language="typescript"
                filename="server-setup.ts"
              />
            </DocSection>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function FigmaDocsSection() {
  return (
    <section id="figma-docs" className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-12">
            <Badge variant="outline" className="border-accent-2/30 text-accent-2 bg-accent-2/5 mb-4">
              <Palette className="h-3.5 w-3.5 mr-1.5" />
              Documentation
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-text mb-4">Figma MCP Access</h2>
            <p className="text-text-dim text-lg max-w-2xl mx-auto">
              A Cloudflare Worker-based MCP server that wraps the Figma REST API for AI agent access
            </p>
          </div>

          <div className="space-y-3">
            <DocSection title="Overview" icon={<BookOpen className="h-4 w-4" />} accent="pink" defaultOpen>
              <p className="text-text-dim text-sm leading-relaxed">
                Figma MCP Access is a complete MCP server implementation that wraps the Figma REST API,
                enabling GitHub Copilot Cloud Agent and other MCP clients to access Figma design data
                without requiring browser-based OAuth. It implements the full MCP JSON-RPC 2.0 protocol
                with 7 purpose-built tools.
              </p>
              <div className="mt-4 p-4 rounded-lg bg-[#0d0d10] border border-border-custom">
                <p className="text-xs text-text-dim mb-2 font-mono">Architecture</p>
                <pre className="text-xs text-[#a1a1aa] font-mono leading-relaxed">{`GitHub Copilot Cloud Agent
        │  HTTPS POST /mcp  (Bearer token)
        ▼
┌─────────────────────────────────────────┐
│  Cloudflare Worker / Bun Server         │
│  MCP JSON-RPC 2.0 Protocol             │
│  7 Figma Tools                         │
│  Auth: Bearer token                    │
│  Upstream: api.figma.com REST API      │
└─────────────────────────────────────────┘
        │  HTTPS  (Figma PAT)
        ▼
  api.figma.com/v1/...`}</pre>
              </div>
            </DocSection>

            <DocSection title="Architecture" icon={<Cpu className="h-4 w-4" />} accent="pink">
              <p className="text-text-dim text-sm leading-relaxed mb-3">
                The server follows a clean separation of concerns with each tool as a self-contained module
                containing its definition, validation, and handler. The MCP protocol handler routes requests
                to the appropriate tool and handles all JSON-RPC 2.0 error codes.
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-text-dim">
                  <FileCode className="h-3.5 w-3.5 text-accent-2" />
                  <code className="text-xs text-accent-2/80">src/mcp-handler.ts</code> — MCP JSON-RPC 2.0 protocol handler
                </div>
                <div className="flex items-center gap-2 text-sm text-text-dim">
                  <FileCode className="h-3.5 w-3.5 text-accent-2" />
                  <code className="text-xs text-accent-2/80">src/figma-api.ts</code> — Figma REST API client with error mapping
                </div>
                <div className="flex items-center gap-2 text-sm text-text-dim">
                  <FileCode className="h-3.5 w-3.5 text-accent-2" />
                  <code className="text-xs text-accent-2/80">src/auth.ts</code> — Bearer token authentication
                </div>
                <div className="flex items-center gap-2 text-sm text-text-dim">
                  <FileCode className="h-3.5 w-3.5 text-accent-2" />
                  <code className="text-xs text-accent-2/80">src/tools/</code> — 7 self-contained tool modules
                </div>
                <div className="flex items-center gap-2 text-sm text-text-dim">
                  <FileCode className="h-3.5 w-3.5 text-accent-2" />
                  <code className="text-xs text-accent-2/80">src/utils.ts</code> — JSON-RPC response builders, validation
                </div>
              </div>
              <p className="text-text-dim text-xs mt-3">
                Supported MCP methods: <code className="text-accent-2/80">initialize</code>, <code className="text-accent-2/80">tools/list</code>, <code className="text-accent-2/80">tools/call</code>, <code className="text-accent-2/80">ping</code>, <code className="text-accent-2/80">notifications/initialized</code>. Batch request support included.
              </p>
            </DocSection>

            <DocSection title="7 Tools Reference" icon={<Settings className="h-4 w-4" />} accent="pink">
              <p className="text-text-dim text-sm mb-4">Complete reference for all 7 Figma MCP tools with their input schemas:</p>
              <div className="space-y-4">
                {figmaTools.map((tool) => (
                  <div key={tool.name} className="p-4 rounded-lg bg-surface/50 border border-border-custom/30">
                    <div className="flex items-center gap-2 mb-2">
                      <code className="text-sm font-mono font-semibold text-accent-2">{tool.name}</code>
                      <Badge variant="secondary" className="text-[10px] bg-accent-2/10 text-accent-2 border-accent-2/20 py-0">
                        {tool.api}
                      </Badge>
                    </div>
                    <p className="text-xs text-text-dim mb-3">{tool.description}</p>
                    <div className="space-y-1.5">
                      {tool.params.map((p) => (
                        <div key={p.name} className="flex items-start gap-2 text-xs">
                          <code className="text-accent-2/70 font-mono min-w-[80px]">{p.name}</code>
                          <span className="text-text-dim/60">{p.required ? 'required' : 'optional'}</span>
                          <span className="text-text-dim/40">{p.type}</span>
                          <span className="text-text-dim">— {p.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </DocSection>

            <DocSection title="Authentication" icon={<Lock className="h-4 w-4" />} accent="pink">
              <p className="text-text-dim text-sm leading-relaxed mb-3">
                Figma MCP Access uses a two-layer authentication model:
              </p>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-accent-2/5 border border-accent-2/10">
                  <p className="text-sm font-medium text-text mb-1">Layer 1: Bearer Token (Client → Server)</p>
                  <p className="text-xs text-text-dim">Clients authenticate to the MCP server using a Bearer token in the <code className="text-accent-2/80">Authorization</code> header. Set via <code className="text-accent-2/80">AUTH_TOKEN</code> environment variable.</p>
                </div>
                <div className="p-3 rounded-lg bg-accent-2/5 border border-accent-2/10">
                  <p className="text-sm font-medium text-text mb-1">Layer 2: Figma PAT (Server → Figma API)</p>
                  <p className="text-xs text-text-dim">The server authenticates to Figma using a Personal Access Token. Set via <code className="text-accent-2/80">FIGMA_PAT</code> environment variable. Generate one at Settings → Personal access tokens.</p>
                </div>
              </div>
              <CodeBlock
                code={`# Cloudflare Worker (.dev.vars)
AUTH_TOKEN=your-bearer-token-here
FIGMA_PAT=figd_your-personal-access-token

# Bun Server (.env)
AUTH_TOKEN=your-bearer-token-here
FIGMA_PAT=figd_your-personal-access-token`}
                language="bash"
                filename=".dev.vars"
              />
            </DocSection>

            <DocSection title="Deployment" icon={<Server className="h-4 w-4" />} accent="pink">
              <Tabs defaultValue="cloudflare" className="w-full">
                <TabsList className="bg-surface border border-border-custom">
                  <TabsTrigger value="cloudflare" className="text-xs data-[state=active]:bg-accent-2/10 data-[state=active]:text-accent-2">Cloudflare Worker</TabsTrigger>
                  <TabsTrigger value="standalone" className="text-xs data-[state=active]:bg-accent-2/10 data-[state=active]:text-accent-2">Standalone Bun</TabsTrigger>
                </TabsList>
                <TabsContent value="cloudflare" className="space-y-3">
                  <p className="text-text-dim text-sm">Deploy to Cloudflare Workers with Wrangler:</p>
                  <CodeBlock
                    code={`# Install dependencies
bun install

# Set secrets
npx wrangler secret put AUTH_TOKEN
npx wrangler secret put FIGMA_PAT

# Deploy
npx wrangler deploy`}
                    language="bash"
                    filename="Terminal"
                  />
                  <CodeBlock
                    code={`// wrangler.jsonc
{
  "name": "figma-mcp-access",
  "main": "src/index.ts",
  "compatibility_date": "2025-01-01",
  "vars": {}
}`}
                    language="jsonc"
                    filename="wrangler.jsonc"
                  />
                </TabsContent>
                <TabsContent value="standalone" className="space-y-3">
                  <p className="text-text-dim text-sm">Run as a standalone Bun server on port 8788:</p>
                  <CodeBlock
                    code={`# Set environment variables
export AUTH_TOKEN=your-bearer-token
export FIGMA_PAT=figd_your-personal-access-token

# Start the server
bun run src/server.ts`}
                    language="bash"
                    filename="Terminal"
                  />
                  <CodeBlock
                    code={`// The standalone server uses Bun.serve()
// Endpoints:
//   GET  /health   → Health check
//   POST /mcp      → MCP JSON-RPC 2.0 handler
//   GET  /mcp      → SSE stream (notifications)`}
                    language="typescript"
                    filename="server.ts"
                  />
                </TabsContent>
              </Tabs>
            </DocSection>

            <DocSection title="Code Examples" icon={<Terminal className="h-4 w-4" />} accent="pink">
              <p className="text-text-dim text-sm mb-3">Calling the MCP server from various clients:</p>
              <CodeBlock
                code={`// Initialize the MCP connection
const response = await fetch('https://your-worker.workers.dev/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-bearer-token'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'my-agent', version: '1.0.0' }
    }
  })
});

// List available tools
const toolsResponse = await fetch('https://your-worker.workers.dev/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-bearer-token'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list'
  })
});

// Call a tool
const fileResponse = await fetch('https://your-worker.workers.dev/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-bearer-token'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'get_figma_file',
      arguments: { file_key: 'YOUR_FILE_KEY', depth: 2 }
    }
  })
});`}
                language="typescript"
                filename="mcp-client.ts"
              />
            </DocSection>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function QuickStartSection() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-text mb-4">Quick Start</h2>
            <p className="text-text-dim text-lg">Get started in 30 seconds</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* MonsterWebMCP Quick Start */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Globe className="h-5 w-5 text-accent-1" />
                <h3 className="text-lg font-semibold text-text">MonsterWebMCP</h3>
              </div>
              <CodeBlock
                code={`// 1. Import
import { MonsterMCP } from 'monster-webmcp';

// 2. Initialize
const mcp = new MonsterMCP();

// 3. Register a tool
mcp.registerTool({
  name: 'hello',
  description: 'Say hello',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' }
    },
    required: ['name']
  },
  execute: async (args) => ({
    content: [{
      type: 'text',
      text: \`Hello, \${args.name}!\`
    }]
  })
});

// Done! Your tool is now available to
// browser agents via WebMCP 🎉`}
                language="typescript"
                filename="quick-start.ts"
              />
            </div>

            {/* Figma MCP Access Quick Start */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Palette className="h-5 w-5 text-accent-2" />
                <h3 className="text-lg font-semibold text-text">Figma MCP Access</h3>
              </div>
              <CodeBlock
                code={`# 1. Clone & install
git clone <figma-mcp-access-repo>
cd figma-mcp-access
bun install

# 2. Set environment variables
export AUTH_TOKEN=my-secret-token
export FIGMA_PAT=figd_your-personal-access-token

# 3. Start the server
bun run src/server.ts

# 4. Test it
curl http://localhost:8788/health
# → { "status": "ok" }

# 5. Call a tool
curl -X POST http://localhost:8788/mcp \\
  -H "Authorization: Bearer my-secret-token" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,\\
       "method":"tools/list"}'
# Done! 7 Figma tools ready 🎉`}
                language="bash"
                filename="Terminal"
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function FooterSection() {
  return (
    <footer className="mt-auto border-t border-border-custom/50 bg-surface/30">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-accent-1" />
              <div className="h-2 w-2 rounded-full bg-accent-2" />
            </div>
            <span className="text-sm text-text-dim">
              Built with <Heart className="h-3 w-3 inline text-accent-2 mx-0.5" /> WebMCP technology
            </span>
          </div>

          <div className="flex items-center gap-6">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-sm text-text-dim hover:text-text transition-colors flex items-center gap-1.5">
              <Github className="h-4 w-4" />
              GitHub
            </a>
            <a href="#monster-docs" className="text-sm text-text-dim hover:text-accent-1 transition-colors flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" />
              Docs
            </a>
            <span className="text-sm text-text-dim/60 flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5" />
              MIT License
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/*  Main Page                                                        */
/* ────────────────────────────────────────────────────────────────── */

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#09090b]">
      {/* Navigation bar */}
      <nav className="sticky top-0 z-50 border-b border-border-custom/50 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-sm bg-accent-1" />
              <div className="h-3 w-3 rounded-sm bg-accent-2" />
            </div>
            <span className="font-semibold text-sm text-text tracking-tight">WebMCP Tools</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => document.getElementById('monster-docs')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-xs text-text-dim hover:text-accent-1 transition-colors"
            >
              MonsterWebMCP
            </button>
            <button
              onClick={() => document.getElementById('figma-docs')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-xs text-text-dim hover:text-accent-2 transition-colors"
            >
              Figma MCP
            </button>
            <Button variant="outline" size="sm" className="text-xs h-7 border-border-custom text-text-dim hover:text-text">
              <Download className="h-3 w-3 mr-1" />
              Download
            </Button>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        <HeroSection />
        <Separator className="bg-border-custom/30 max-w-5xl mx-auto" />
        <ToolsGridSection />
        <Separator className="bg-border-custom/30 max-w-5xl mx-auto" />
        <ComparisonSection />
        <Separator className="bg-border-custom/30 max-w-5xl mx-auto" />
        <MonsterDocsSection />
        <Separator className="bg-border-custom/30 max-w-5xl mx-auto" />
        <FigmaDocsSection />
        <Separator className="bg-border-custom/30 max-w-5xl mx-auto" />
        <QuickStartSection />
      </main>

      <FooterSection />
    </div>
  );
}
