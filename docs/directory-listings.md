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
entry rather than from documentation. Publishing:

```bash
# Authentication is GitHub OAuth, so this step needs the repository owner.
npx -y @modelcontextprotocol/mcp-publisher login github
npx -y @modelcontextprotocol/mcp-publisher publish
```

The name is namespaced `io.github.Edge-Echo/mcp-netassist` because ownership is verified through
GitHub; the package itself is the npm one, run with `npx -y`.

**Keeping it current:** the registry pins a version, so each npm release needs a matching
`server.json` bump and republish, or the entry advertises a version that is no longer newest.

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
| Official MCP Registry | not listed — `server.json` prepared, needs an authenticated publish |
