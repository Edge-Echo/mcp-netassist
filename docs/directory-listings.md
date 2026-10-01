# Listing this server on MCP directories

Notes from actually going through it, so the next listing does not repeat the same searches.

## Glama

### The badge format in instructions is not the format in use

Glama's own rejection/setup email gives:

```
https://glama.ai/api/servers/<server-id>/score.svg
```

That path 404s. All three shapes below were tried against a live listing and none resolved:

| Attempted | Result |
|---|---|
| `glama.ai/api/servers/Edge-Echo/mcp-netassist/score.svg` | 404 |
| `glama.ai/api/servers/edge-echo%2Fmcp-netassist/score.svg` | 404 |
| `glama.ai/api/mcp/v1/servers/Edge-Echo/mcp-netassist/score.svg` | 200, but `text/html` — the SPA fallback page, not an image |

The format that works is the one used by the 2,800-odd entries already in
[punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers):

```markdown
[![<name> MCP server](https://glama.ai/mcp/servers/<owner>/<repo>/badges/score.svg)](https://glama.ai/mcp/servers/<owner>/<repo>)
```

Verified live: `https://glama.ai/mcp/servers/Edge-Echo/mcp-netassist/badges/score.svg` returns
`HTTP 200` with `image/svg+xml`.

**To find the current format for any directory, read what live entries actually use rather than
trusting the submission instructions.** A template can drift away from the deployed system.

### `Add Server` rejects a server that is already listed — that is not a failure

Submitting a server that Glama already indexed returns:

> MCP server already exists for this repository — feel free to resubmit after addressing the issue

There is nothing to change in the submission. It means the entry exists and the remaining step is
ownership, not indexing.

### Whether it is claimed can be checked without logging in

The score badge is a public SVG, and its `<desc>` states the ownership status:

```xml
<title>netassist – MCP server rated A on Glama</title>
<desc>Glama score badge for Edge-Echo/mcp-netassist: claimed by its maintainer,
      tool definitions rated A, 6 tools, maintenance rated B.</desc>
```

So before hunting for a "Claim" control:

```bash
curl -s https://glama.ai/mcp/servers/<owner>/<repo>/badges/score.svg | head -c 400
```

If it says *claimed by its maintainer*, the ownership step is already done. This is a better signal
than the UI, which only renders its claim control while signed in — the claim modal is bundled
(`ClaimMcpServerModal`) but not rendered for a signed-out visitor, and there is no standalone
route (`/claim`, `/mcp/servers/<owner>/<repo>/claim`, `/mcp/add`, `/dashboard` all 404).

### Reachability of the listing page is itself worth verifying

A 200 on `https://glama.ai/mcp/servers/<owner>/<repo>` confirms the entry is public and shows its
grades, category and last-updated time. Cheap to check, and it settles "are we actually listed"
without an account.


## Official MCP Registry

We are not on it. Queried directly:

```
registry.modelcontextprotocol.io/v0/servers?search=netassist   ->  0 results
```

This one matters more than the others: it is the registry other clients and directories read, so
being absent here keeps propagating.

`server.json` is committed at the repository root and follows
`https://static.modelcontextprotocol.io/schemas/2025-09-29/server.schema.json`, copied from a live
entry rather than from documentation.

### Publishing

The publisher is **not an npm package** — it is a binary attached to releases of
[modelcontextprotocol/registry](https://github.com/modelcontextprotocol/registry)
(latest checked: `v1.8.1`).

> Careful with the name: there is an unrelated package called `mcp-publisher` on npm. It is not
> this tool.

```bash
# Windows asset in v1.8.1: mcp-publisher_windows_amd64.tar.gz
# Download and extract it from
#   https://github.com/modelcontextprotocol/registry/releases/latest

# Authentication is GitHub OAuth, so this step needs the repository owner.
mcp-publisher login github

# Run from the repository root, where server.json lives.
mcp-publisher publish
```

The name is namespaced `io.github.Edge-Echo/mcp-netassist` because ownership is verified through
GitHub; the package is the npm one, run with `npx -y`.

**Keeping it current:** the registry pins a version, so each npm release needs a matching
`server.json` bump and republish, or the entry advertises a version that is no longer newest.

### Things that only a real publish reveals

All five of these cost a round trip and none are in the registry's docs or the JSON schema.

**1. Ownership is verified against the published npm package, not just `server.json`.**

```
400 Failed to publish server
    registry validation failed for package 0 (mcp-netassist):
    NPM package 'mcp-netassist' is missing required 'mcpName' field.
    Add this to your package.json: "mcpName": "io.github.Edge-Echo/mcp-netassist"
```

The package must carry `mcpName` matching the registry name, and because it is read from the
*tarball*, it requires an npm release — a local edit does nothing. Hence 0.1.1.

**2. The registry JWT expires quickly.** A publish run ten minutes after login returned:

```
401 Unauthorized: Invalid or expired Registry JWT token
    failed to parse token: token has invalid claims: token is expired
```

Login and publish should be back to back, not separated by other work.

**3. A 504 right after releasing the npm version is propagation, not a bad manifest.**

```
504 Gateway Time-out (nginx)
```

The registry fetches the package to check `mcpName`, so it can time out while npm's CDN catches
up. Retrying the same command succeeded with no changes.

**4. The publisher binary does not use the system proxy.** Behind a local proxy it fails with:

```
read tcp ...: wsarecv: A connection attempt failed because the connected party
did not properly respond
```

It is a Go binary, so `HTTPS_PROXY` / `HTTP_PROXY` are honoured — set them explicitly rather than
relying on the OS proxy setting.

**5. It can only write inside the working tree.** Storing the token failed with:

```
Error: failed to create config directory: mkdir C:\Users\Administrator\.config\mcp-publisher: Access is denied.
```

Directories created by an ordinary shell in the same place succeeded, so this is a write
restriction on the binary rather than a filesystem permission problem. Redirecting
`USERPROFILE` makes `~/.config` resolve inside the working tree:

```powershell
$env:USERPROFILE = 'C:\Users\Administrator\Desktop\Harness\.publisher-home'
$env:HTTPS_PROXY = 'http://127.0.0.1:10808'
mcp-publisher login github   # then publish immediately
```

**Background processes:** a PowerShell `Start-Job` does not survive the command that created it,
so it cannot be used to hold a login open across steps. Whatever supervises the run has to be the
thing that owns the process.

**Verifying the result:** the exit code is not the evidence. Query the registry:

```bash
curl -s 'https://registry.modelcontextprotocol.io/v0/servers?search=netassist'
```

A published entry carries `_meta."io.modelcontextprotocol.registry/official"`.

## Other directories checked

| Directory | Result |
|---|---|
| Smithery | not listed; needs `smithery.yaml` in the repo or the web UI |
| PulseMCP | API returns 410 (version retired); check the site's submit form |
| mcp.so | API returned 500 from here; check the site |
| LobeHub | probe 404; check the site |

## Status

| Directory | State |
|---|---|
| Glama | listed, claimed |
| punkpeye/awesome-mcp-servers | PR open, `mergeable=clean`, format check passing |
| Official MCP Registry | **listed** as `io.github.Edge-Echo/mcp-netassist@0.1.1` |
