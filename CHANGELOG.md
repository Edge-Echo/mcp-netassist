# Changelog

## [0.1.0] - 2026-09-22

### Added

- Six MCP tools over stdio, usable from any MCP client:
  - `net_github_status` — DNS, TCP 443 and HTTPS status for github.com
  - `net_proxy_status` — system proxy settings plus a disabled-but-leftover value
  - `net_proxy_probe` — local proxy port reachability
  - `net_diag` — DNS → TCP → HTTP chain for any host
  - `net_hosts_check` — GitHub entries pinned in the hosts file
  - `net_doctor` — the full preflight, with concrete suggestions
- `Dockerfile` for container-based introspection checks.
- Injection-safe PowerShell: every input crosses the script boundary as Base64.
- Verified end to end with a real MCP client: connect, `tools/list`, and calls to all six tools.
