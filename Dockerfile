# Container image for Glama's introspection checks and for anyone who wants to
# run the MCP server without a local Node install.
#
# NOTE: the diagnostic tools call PowerShell, so they only work on Windows.
# On Linux the server still starts and answers MCP introspection requests
# (initialize / tools/list) — the tools themselves report a clear error.
FROM node:22-alpine

WORKDIR /app

# Install runtime dependencies only (the built lib/ ships in the repository).
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY lib ./lib
COPY README.md ./

# MCP servers speak JSON-RPC over stdio.
ENTRYPOINT ["node", "lib/server.js"]
