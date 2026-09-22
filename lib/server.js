#!/usr/bin/env node
// mcp-netassist — network & proxy diagnostics as an MCP server.
//
// Works with any MCP client (Claude Code, Cursor, Reasonix, CodeWhale, DSH, …):
// the diagnostics live behind the protocol, so every agent gets the same
// "is GitHub reachable / is my proxy alive / what should I change" answers.
import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { checkDiag, checkGithub, checkHosts, checkProxyPorts, checkProxyStatus, DEFAULT_PROXY_PORTS, } from './checks.js';
import { runDoctor } from './doctor.js';
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const server = new McpServer({ name: 'netassist', version: pkg.version });
/** Wrap a handler so failures come back as tool errors instead of crashes. */
function safe(fn, render) {
    return async () => {
        try {
            const value = await fn();
            return { content: [{ type: 'text', text: render(value) }] };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { content: [{ type: 'text', text: `netassist error: ${message}` }], isError: true };
        }
    };
}
// ── 1. GitHub reachability ───────────────────────────────────────────────────
server.tool('net_github_status', 'Check whether github.com is reachable right now: DNS resolution, TCP 443, and the HTTPS status code with round-trip time.', {}, safe(() => checkGithub(), (s) => [
    `GitHub reachable: ${s.reachable}`,
    `DNS: ${s.dns.join(', ')}`,
    `TCP 443: ${s.tcp443}${s.tcpMs !== undefined ? ` (${s.tcpMs} ms)` : ''}`,
    `HTTPS: ${typeof s.httpStatus === 'number' && s.httpStatus > 0 ? `HTTP ${s.httpStatus}` : 'failed'}`,
].join('\n')));
// ── 2. System proxy ──────────────────────────────────────────────────────────
server.tool('net_proxy_status', 'Show the Windows system proxy configuration (registry) and proxy environment variables. Distinguishes "system proxy" from "TUN mode" from "no proxy", and flags a disabled-but-leftover registry value.', {}, safe(() => checkProxyStatus(), (p) => [
    `System proxy: ${p.enabled ? (p.server || '(enabled, no server)') : 'disabled'}`,
    `Override: ${p.override || '(none)'}`,
    `env HTTP_PROXY: ${p.envHttp || '(unset)'}`,
    `env HTTPS_PROXY: ${p.envHttps || '(unset)'}`,
    ...(p.staleServer ? [`Note: the registry still holds ${p.staleServer} while the proxy switch is off.`] : []),
].join('\n')));
// ── 3. Proxy port probe ──────────────────────────────────────────────────────
server.tool('net_proxy_probe', 'Probe local proxy ports for TCP reachability. Defaults to the common ports (10808, 10809, 7890, 7897, 8888, 1080); pass `ports` to override.', { ports: z.array(z.number().int()).optional().describe(`Ports to probe (default ${DEFAULT_PROXY_PORTS.join(', ')})`) }, async ({ ports }) => {
    try {
        const probes = await checkProxyPorts(ports ?? DEFAULT_PROXY_PORTS);
        const open = probes.filter((p) => p.status === 'OPEN');
        const text = [
            ...probes.map((p) => `  ${String(p.port).padStart(5)}  ${p.status}`),
            '',
            open.length ? `Open: ${open.map((p) => p.port).join(', ')}` : 'No probed port is open.',
        ].join('\n');
        return { content: [{ type: 'text', text }] };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: `netassist error: ${message}` }], isError: true };
    }
});
// ── 4. Full diagnosis chain ──────────────────────────────────────────────────
server.tool('net_diag', 'Full reachability diagnosis for any host: DNS resolution, TCP connect test, then an HTTP(S) status check.', {
    host: z.string().describe('Hostname or IP address'),
    port: z.number().int().optional().describe('TCP port to test (default 443)'),
    path: z.string().optional().describe('URL path for the HTTP check (default /)'),
}, async ({ host, port, path }) => {
    try {
        const r = await checkDiag(host, port ?? 443, path ?? '/');
        return {
            content: [{
                    type: 'text',
                    text: [`Host: ${r.host}`, `DNS: ${r.dns.join(', ')}`, `TCP: ${r.tcp}`, r.http].join('\n'),
                }],
        };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: `netassist error: ${message}` }], isError: true };
    }
});
// ── 5. hosts conflict scan ───────────────────────────────────────────────────
server.tool('net_hosts_check', 'Scan the Windows hosts file for GitHub-related entries. Pinned entries bypass a proxy and can go stale — this lists what is pinned.', {}, safe(() => checkHosts(), (h) => h.hasGithub
    ? `Found ${h.entries.length} GitHub entr${h.entries.length === 1 ? 'y' : 'ies'}:\n${h.entries.join('\n')}`
    : 'No GitHub entries in the hosts file (clean).'));
// ── 6. Doctor ────────────────────────────────────────────────────────────────
server.tool('net_doctor', 'Run the full network preflight (system proxy, proxy ports, TUN adapters, GitHub reachability, hosts conflicts) and report each finding with concrete suggestions about what to change. Use this before blaming the network for a failure.', {}, async () => {
    try {
        const report = await runDoctor();
        const lines = [];
        for (const f of report.findings) {
            lines.push(`${f.level === 'ok' ? '✔' : f.level === 'warn' ? '⚠' : '✖'} ${f.title}`);
            if (f.detail)
                lines.push(`   ${f.detail}`);
        }
        lines.push('');
        if (report.suggestions.length) {
            lines.push('Suggested fix:');
            for (const s of report.suggestions)
                lines.push(`- ${s}`);
        }
        else {
            lines.push('No action needed — configuration looks self-consistent.');
        }
        return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: `netassist error: ${message}` }], isError: true };
    }
});
const transport = new StdioServerTransport();
await server.connect(transport);
