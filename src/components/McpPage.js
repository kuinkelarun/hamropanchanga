import React, { useState } from 'react';

const MCP_URL = 'https://hamropanchanga-mcp-server.up.railway.app/mcp';
const HEALTH_URL = 'https://hamropanchanga-mcp-server.up.railway.app/health';

const CLIENTS = [
  {
    id: 'claude-desktop',
    label: 'Claude Desktop',
    icon: '🤖',
    configFile: {
      'Windows (direct install)': '%APPDATA%\\Claude\\claude_desktop_config.json',
      'Windows (Store)': 'C:\\Users\\<you>\\AppData\\Local\\Packages\\Claude_pzs8sxrjxfjjc\\LocalCache\\Roaming\\Claude\\claude_desktop_config.json',
      'macOS': '~/Library/Application Support/Claude/claude_desktop_config.json',
    },
    warning: 'The "type": "http" config format is not supported by Claude Desktop — it produces a "not valid MCP server configuration" error. The "type": "http" format only works on the claude.ai web interface (Custom Connectors). Use the mcp-remote proxy config below instead.',
    steps: [
      'Install mcp-remote globally (requires Node.js — verify with node --version): npm install -g mcp-remote',
      'Open Claude Desktop → File → Settings → Developer → Edit Config to open the correct config file automatically.',
      'Merge the snippet below into your config file (inside "mcpServers").',
      'Replace <you> with your Windows username and npcal_your_key_here with your actual API key.',
      'Save the file, then fully quit Claude Desktop from the system tray and relaunch.',
      'Click the + icon in the chat input bar, then select Connectors — HamroPanchanga should appear in the connected servers list.',
    ],
    config: `{
  "mcpServers": {
    "hamropanchanga": {
      "command": "C:\\\\Users\\\\<you>\\\\AppData\\\\Roaming\\\\npm\\\\mcp-remote.cmd",
      "args": [
        "${MCP_URL}",
        "--header",
        "Authorization:Bearer npcal_your_key_here"
      ]
    }
  }
}`,
    configNote: 'Why the full .cmd path instead of npx? Claude Desktop invokes commands via cmd.exe. If Node.js is installed in C:\\Program Files\\nodejs\\ (the default), the npx path contains a space and cmd.exe misparses it — producing \'C:\\Program\' is not recognized. Referencing mcp-remote.cmd by its full AppData\\Roaming\\npm\\ path (no spaces) avoids this entirely.',
  },
  {
    id: 'vscode',
    label: 'VS Code Copilot',
    icon: '💻',
    configFile: {
      'Workspace (recommended)': '.vscode/mcp.json',
      'User-level (global)': '%APPDATA%\\Code\\User\\mcp.json',
    },
    steps: [
      'In your project, create or open .vscode/mcp.json.',
      'Paste the snippet below (or merge "servers" into an existing file).',
      'Replace npcal_your_key_here with your actual API key.',
      'Open the Copilot Chat panel and switch to Agent mode.',
      'Click the Tools icon — HamroPanchanga tools should appear in the list.',
    ],
    config: `{
  "servers": {
    "hamropanchanga": {
      "type": "http",
      "url": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer npcal_your_key_here"
      }
    }
  }
}`,
  },
  {
    id: 'codex',
    label: 'Codex CLI',
    icon: '⌨️',
    configFile: {
      Location: '~/.codex/config.json',
    },
    steps: [
      'Open or create ~/.codex/config.json.',
      'Add the mcpServers entry below.',
      'Replace npcal_your_key_here with your actual API key.',
      'Run codex in your terminal — MCP tools are automatically available in the session.',
    ],
    config: `{
  "mcpServers": {
    "hamropanchanga": {
      "type": "http",
      "url": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer npcal_your_key_here"
      }
    }
  }
}`,
  },
  {
    id: 'inspector',
    label: 'MCP Inspector',
    icon: '🔍',
    configFile: null,
    steps: [
      'Run the command below in your terminal (Node.js required).',
      'In the browser UI that opens, add the Authorization header.',
      'Click Connect — all available tools will be listed.',
    ],
    config: `npx @modelcontextprotocol/inspector ${MCP_URL}`,
    note: 'Then add header:  Authorization: Bearer npcal_your_key_here',
  },
];

const TOOL_GROUPS = [
  {
    category: 'Nepali Calendar',
    icon: '📅',
    tools: [
      { name: 'get_today', desc: "Get today's date in Nepal Time (AD + BS)." },
      { name: 'convert_ad_to_bs', desc: 'Convert a Gregorian date to Bikram Sambat.' },
      { name: 'convert_bs_to_ad', desc: 'Convert a BS date to Gregorian.' },
      { name: 'convert_batch', desc: 'Convert up to 100 dates in one call.' },
    ],
  },
  {
    category: 'Tithis',
    icon: '🌙',
    tools: [
      { name: 'get_tithi_today', desc: 'Get the active tithi right now in Nepal Time.' },
      { name: 'get_tithi_for_date', desc: 'Get the tithi for any specific AD date.' },
      { name: 'list_tithis_in_range', desc: 'List all tithis in an AD date range (max 366 days).' },
      { name: 'find_next_tithi', desc: 'Find the next occurrence of a named tithi (e.g. Purnima, Ekadashi).' },
      { name: 'resolve_tithi_event_date', desc: 'Resolve a tithi spec (paksha + tithi name + lunar month) to the next AD date.' },
    ],
  },
  {
    category: 'Events',
    icon: '🎉',
    tools: [
      { name: 'list_events', desc: 'List calendar events visible to you in a date range.' },
      { name: 'list_upcoming_events', desc: 'Events in the next N days (Nepal Time).' },
      { name: 'get_event', desc: 'Get a single event by ID.' },
      { name: 'create_event', desc: 'Create a calendar event by AD date or tithi spec.' },
      { name: 'update_event', desc: 'Update an existing event.' },
      { name: 'delete_event', desc: 'Delete an event.' },
    ],
  },
  {
    category: 'Family Trees',
    icon: '🌳',
    tools: [
      { name: 'list_trees', desc: 'List trees owned by or shared with you.' },
      { name: 'get_tree', desc: 'Get full details of a family tree.' },
      { name: 'create_tree', desc: 'Create a new family tree.' },
      { name: 'list_members', desc: 'List all members in a tree.' },
      { name: 'get_member', desc: "Get a single member's details." },
      { name: 'find_member', desc: 'Search members by name across your trees.' },
      { name: 'add_member', desc: 'Add a new member to a tree.' },
      { name: 'update_member', desc: 'Update member fields.' },
      { name: 'remove_member', desc: 'Delete a member.' },
    ],
  },
  {
    category: 'API Keys',
    icon: '🔑',
    tools: [
      { name: 'request_api_key', desc: 'Submit an API key request.' },
      { name: 'list_my_api_key_requests', desc: 'Check the status of your requests.' },
      { name: 'get_my_api_keys', desc: 'List your active API keys (metadata only).' },
    ],
  },
];

function CodeBlock({ code }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="relative group">
      <pre className="bg-gray-900 text-green-400 rounded-lg p-4 text-xs overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">
        {code}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-600"
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );
}

const totalTools = TOOL_GROUPS.reduce((n, g) => n + g.tools.length, 0);

export default function McpPage() {
  const [activeClient, setActiveClient] = useState('claude-desktop');
  const client = CLIENTS.find(c => c.id === activeClient);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="flex items-center gap-3 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">MCP Server</h1>
              <p className="text-gray-500 mt-1">Connect your AI assistant to HamroPanchanga tools</p>
            </div>
          </div>
          <p className="text-gray-600 max-w-2xl mt-4 leading-relaxed">
            The HamroPanchanga MCP (Model Context Protocol) server exposes Nepali calendar, tithi,
            events, and family tree tools to any MCP-compatible AI client — including Claude Desktop,
            VS Code Copilot, Codex CLI, and more. Your AI assistant can look up today's tithi, convert
            dates, create events, add family members, and query your family trees — all directly in chat.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-sm px-3 py-1.5 rounded-full font-medium">
              <span className="w-2 h-2 bg-indigo-500 rounded-full inline-block"></span>
              Streamable HTTP transport
            </span>
            <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 text-sm px-3 py-1.5 rounded-full font-medium">
              <span className="w-2 h-2 bg-green-500 rounded-full inline-block"></span>
              {totalTools}+ tools available
            </span>
            <span className="inline-flex items-center gap-1.5 bg-yellow-50 text-yellow-700 text-sm px-3 py-1.5 rounded-full font-medium">
              <span className="w-2 h-2 bg-yellow-500 rounded-full inline-block"></span>
              API key required
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-8">

          {/* Step 1: Get API Key */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold shrink-0">1</span>
              <h2 className="text-lg font-semibold text-gray-900">Get an API Key</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              MCP connections authenticate with the same{' '}
              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">npcal_</code>{' '}
              API keys used by the REST API. Free plan includes 1,000 requests/day.
            </p>
            <ol className="space-y-2 text-sm text-gray-700 mb-5">
              {[
                'Sign in at the Calendar API page.',
                'Submit an API key request with your name and use case.',
                'Once approved, copy your key — it is shown only once.',
                'Paste it into the client config below.',
              ].map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-gray-400 font-mono text-xs mt-0.5 shrink-0">{i + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>
            <a
              href="/developer"
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Go to Calendar API page →
            </a>
          </section>

          {/* Step 2: Connect your client */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold shrink-0">2</span>
              <h2 className="text-lg font-semibold text-gray-900">Connect Your AI Client</h2>
            </div>

            {/* Client tabs */}
            <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-4">
              {CLIENTS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setActiveClient(c.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeClient === c.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span>{c.icon}</span>
                  {c.label}
                </button>
              ))}
            </div>

            {/* Config file location */}
            {client.configFile && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Config file location</p>
                {Object.entries(client.configFile).map(([label, path]) => (
                  <p key={label} className="text-xs text-blue-800 font-mono">
                    <span className="text-blue-500">{label}: </span>{path}
                  </p>
                ))}
              </div>
            )}

            {/* Warning banner (e.g. Claude Desktop "type: http" gotcha) */}
            {client.warning && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2">
                <span className="text-amber-500 text-sm shrink-0 mt-0.5">⚠️</span>
                <p className="text-xs text-amber-800">{client.warning}</p>
              </div>
            )}

            {/* Steps */}
            <ol className="space-y-1.5 text-sm text-gray-700 mb-5">
              {client.steps.map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-gray-400 font-mono text-xs mt-0.5 shrink-0">{i + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>

            {/* Config snippet */}
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {client.id === 'inspector' ? 'Terminal command' : 'Config snippet'}
            </p>
            <CodeBlock code={client.config} />

            {client.note && (
              <p className="mt-2 text-xs text-gray-500 font-mono">{client.note}</p>
            )}

            {client.configNote && (
              <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-xs text-gray-500 italic">{client.configNote}</p>
              </div>
            )}

            {client.id !== 'inspector' && (
              <p className="mt-3 text-xs text-gray-500">
                Replace{' '}
                <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">npcal_your_key_here</code>{' '}
                with your actual API key from Step 1.
              </p>
            )}
          </section>

          {/* Available Tools */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Available Tools</h2>
            <p className="text-sm text-gray-500 mb-6">
              These tools are available to your AI assistant once connected.
              Some tools require admin privileges on your HamroPanchanga account.
            </p>
            <div className="space-y-6">
              {TOOL_GROUPS.map(group => (
                <div key={group.category}>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                    <span>{group.icon}</span>
                    {group.category}
                  </h3>
                  <div className="space-y-2">
                    {group.tools.map(tool => (
                      <div key={tool.name} className="flex gap-3 text-sm">
                        <code className="shrink-0 bg-gray-100 text-gray-800 px-2 py-0.5 rounded font-mono text-xs self-start mt-0.5">
                          {tool.name}
                        </code>
                        <span className="text-gray-600">{tool.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Server info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Server Details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Endpoint</p>
                <code className="text-xs font-mono text-indigo-700 break-all">{MCP_URL}</code>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Transport</p>
                <span className="text-xs text-gray-700">Streamable HTTP (MCP 2025-03-26)</span>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Authentication</p>
                <code className="text-xs font-mono text-gray-700">Authorization: Bearer npcal_…</code>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Rate limit (free plan)</p>
                <span className="text-xs text-gray-700">1,000 requests / day</span>
              </div>
            </div>
          </div>

          {/* Quick links */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/developer" className="text-indigo-600 hover:underline flex items-center gap-1.5">
                  <span>🔑</span> Request an API key
                </a>
              </li>
              <li>
                <a
                  href={HEALTH_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 hover:underline flex items-center gap-1.5"
                >
                  <span>💚</span> Server health check
                </a>
              </li>
              <li>
                <a
                  href="https://modelcontextprotocol.io"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 hover:underline flex items-center gap-1.5"
                >
                  <span>📖</span> MCP specification
                </a>
              </li>
            </ul>
          </div>

          {/* Troubleshooting */}
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
            <h3 className="text-sm font-semibold text-amber-900 mb-2">Troubleshooting</h3>
            <ul className="space-y-1.5 text-xs text-amber-800">
              <li>• Verify your API key is active on the <a href="/developer" className="underline">Calendar API page</a>.</li>
              <li>• Check the <a href={HEALTH_URL} target="_blank" rel="noreferrer" className="underline">health endpoint</a> to confirm the server is running.</li>
              <li>• Ensure your config file is valid JSON.</li>
              <li>• Restart your AI client after editing the config.</li>
              <li>• <strong>Claude Desktop:</strong> "not valid MCP server configuration" error — remove any <code className="bg-amber-100 px-0.5 rounded">"type": "http"</code> config and use the <code className="bg-amber-100 px-0.5 rounded">mcp-remote</code> proxy config shown in the Claude Desktop tab above.</li>
              <li>• <strong>Claude Desktop on Windows:</strong> <code className="bg-amber-100 px-0.5 rounded">'C:\Program' is not recognized</code> — use the full path to <code className="bg-amber-100 px-0.5 rounded">mcp-remote.cmd</code> in <code className="bg-amber-100 px-0.5 rounded">AppData\Roaming\npm\</code> instead of <code className="bg-amber-100 px-0.5 rounded">npx</code> (npx path contains spaces if Node.js is in Program Files).</li>
              <li>• <strong>Claude Desktop (Windows Store):</strong> Config edits to <code className="bg-amber-100 px-0.5 rounded">%APPDATA%\Claude\</code> have no effect — the Store version uses a sandboxed path. Use <em>File → Settings → Developer → Edit Config</em> in Claude Desktop to open the correct file.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
