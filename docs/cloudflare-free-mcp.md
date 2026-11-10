# Bastilla OS — Cloudflare Workers Free + Codespaces (bez Google Billing)

## Status potwierdzony 2026-11-10

- Cloudflare account: u6930438163@gmail.com.
- Workers subdomain: `bastilla-u6930438163.workers.dev` (activated).
- Deployed Worker: `bastilla-os-mcp`.
- Public, factual health: `https://bastilla-os-mcp.bastilla-u6930438163.workers.dev/health`.
- Authenticated MCP JSON-RPC POST: `https://bastilla-os-mcp.bastilla-u6930438163.workers.dev/mcp`.
- MCP code contains `initialize`, `ping`, `tools/list`, `tools/call`; read-only tools: `system_status`, `ollama_status`, `agents_status`, `vm_status`.
- The Cloudflare Worker is **not** a Linux host. It never fakes agent, VM or Ollama states.
- Codespaces backend URL is **not configured** until the actual Codespace is running and its forwarded URL has been verified.

## Start the actual backend in the Codespace on main

1. Open this repository and create/open a Codespace from the `main` branch.
2. Start Bastilla using its existing startup scripts (Node on local port 3000):
   `bash scripts/start-codespaces.sh`
3. Keep port **3000** private. Check locally:
   `curl -fsS http://127.0.0.1:3000/api/ai/status`
4. Start the separate read-only gateway on port 8788. Enter the **same** 32+ character token later bound to Cloudflare `BACKEND_TOKEN`, without committing it to Git:
   ```bash
   read -r -s -p 'Gateway token: ' BASTILLA_GATEWAY_TOKEN; echo
   export BASTILLA_GATEWAY_TOKEN
   node scripts/codespaces-mcp-gateway.mjs
   ```
5. In Codespaces **Ports**, make only port **8788** public. This exposes **read-only** allowlisted metrics, protected by the gateway's bearer secret; never publish port 3000, port 8000 or privileged terminals.
6. Copy the real forwarded HTTPS URL of port 8788. Configure Cloudflare Worker secrets:
   - `BACKEND_URL`: actual forwarded HTTPS origin, **no path**.
   - `BACKEND_TOKEN`: exactly the token entered in step 4.
7. Verify `/health` now reports `backendConfigured: true`, then call MCP `initialize`, `tools/list` and `tools/call` with `Authorization: Bearer <MCP_ACCESS_TOKEN>`. Backend tool status comes from the live Codespace only.
8. When Codespaces stops or its public URL changes, tools return a transport/HTTP error. Reconfigure `BACKEND_URL` if necessary. GitHub Codespaces is **not** a permanent 24/7 host.

## GitHub main -> Cloudflare sync

The workflow `.github/workflows/bastilla-cloudflare-mcp.yml` deploys on changes to the MCP code on **main** only. It is intentionally disabled until credentials are supplied, to avoid failing every push:

- GitHub Actions **Secrets**: `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (token scoped to Workers Scripts Edit).
- GitHub Actions **Variables**: `BASTILLA_MCP_AUTO_DEPLOY=true`.
- Cloudflare script code is synchronized on push; Codespaces runtime data, model weights and secrets are **not** pushed to GitHub.
- Cloudflare `MCP_ACCESS_TOKEN` stays a Worker secret and must not be committed.

## Security and limitations

- Worker requires its existing `MCP_ACCESS_TOKEN`; unauthenticated POSTs return HTTP 401.
- Worker tools are *read-only*. No root commands, arbitrary shell, Docker start or agent dispatch over the public endpoint.
- Dedicated gateway returns the **actual** application API response or an explicit error and has no write routes.
- This endpoint uses static bearer authentication; a ChatGPT custom MCP connector that requires OAuth cannot use it directly until OAuth support is configured.
- Google AI Studio remains an editing interface; direct Cloudflare deployment does not guarantee the AI Studio preview automatically refreshes.
- No Google Cloud Run billing, fictitious spacecraft, fake backend status or simulated AI agents are used.
