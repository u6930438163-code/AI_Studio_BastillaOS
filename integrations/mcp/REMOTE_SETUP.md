# Remote BastillaOS MCP bridge

This is an optional, separate MCP process. It does not replace the existing local MCP integration.

## Run
```sh
python3 -m venv .venv-mcp
.venv-mcp/bin/pip install -r integrations/mcp/requirements.txt
BASTILLA_REMOTE_API_URL=https://ais-dev-wcohfbaczr2ohtvwiuxtdt-873947482948.europe-west2.run.app/api/ \
  .venv-mcp/bin/python integrations/mcp/remote_server.py
```

Local MCP endpoint: `http://127.0.0.1:8001/mcp/` (not directly accessible to ChatGPT).

Set `BASTILLA_REMOTE_API_TOKEN` in your hosting secret manager if the remote API requires bearer authentication. To enable task submission, set `BASTILLA_REMOTE_MCP_WRITES=1` only after verifying the remote request schemas and configuring authenticated HTTPS access to MCP. The remote API routes have not been independently verified.

**Deployment:** Use a persistent HTTPS host/reverse proxy with access control. Never expose port 8001 or a command endpoint without authentication. A GitHub repository by itself is not hosting. Do not publish the Codespaces port publicly as a shortcut.
