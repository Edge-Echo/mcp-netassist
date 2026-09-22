// Verify the MCP server end to end: connect a real MCP client over stdio,
// list tools, and call the zero-config ones.
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { fileURLToPath } from 'node:url'

const serverPath = fileURLToPath(new URL('../lib/server.js', import.meta.url))

const transport = new StdioClientTransport({ command: process.execPath, args: [serverPath] })
const client = new Client({ name: 'verify', version: '0.1.0' })

let failed = 0
function check(name, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}

try {
  await client.connect(transport)
  check('connect over stdio', true)

  const tools = await client.listTools()
  const names = tools.tools.map((t) => t.name).sort()
  const expected = ['net_diag', 'net_doctor', 'net_github_status', 'net_hosts_check', 'net_proxy_probe', 'net_proxy_status']
  check('tools listed', names.length === expected.length, names.join(', '))
  check('expected tool set', expected.every((n) => names.includes(n)))
  check('descriptions present', tools.tools.every((t) => (t.description ?? '').length > 20))

  const github = await client.callTool({ name: 'net_github_status', arguments: {} })
  const githubText = github.content?.[0]?.text ?? ''
  check('net_github_status runs', githubText.includes('GitHub reachable'), githubText.split('\n')[0])
  check('net_github_status reports DNS', githubText.includes('DNS:'))

  const proxy = await client.callTool({ name: 'net_proxy_status', arguments: {} })
  const proxyText = proxy.content?.[0]?.text ?? ''
  check('net_proxy_status runs', proxyText.includes('System proxy'), proxyText.split('\n')[0])

  const probe = await client.callTool({ name: 'net_proxy_probe', arguments: { ports: [10808, 10809] } })
  const probeText = probe.content?.[0]?.text ?? ''
  check('net_proxy_probe runs', probeText.includes('10808'), probeText.split('\n')[0])

  const hosts = await client.callTool({ name: 'net_hosts_check', arguments: {} })
  const hostsText = hosts.content?.[0]?.text ?? ''
  check('net_hosts_check runs', hostsText.length > 0, hostsText.split('\n')[0].slice(0, 60))

  const doctor = await client.callTool({ name: 'net_doctor', arguments: {} })
  const doctorText = doctor.content?.[0]?.text ?? ''
  check('net_doctor runs', doctorText.includes('✔') || doctorText.includes('⚠') || doctorText.includes('✖'))
  check('net_doctor gives suggestions or all-clear', doctorText.includes('Suggested fix:') || doctorText.includes('No action needed'))

  await client.close()
} catch (err) {
  console.error(`FAIL  harness error: ${err instanceof Error ? err.message : String(err)}`)
  failed++
}

console.log(`\n${failed === 0 ? 'ALL PASS' : `${failed} FAILED`}`)
process.exit(failed ? 1 : 0)
