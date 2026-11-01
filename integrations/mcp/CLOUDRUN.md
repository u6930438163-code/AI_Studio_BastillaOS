# BastillaOS MCP on Google Cloud Run

This deploys the **MCP server**, not the AI Studio editor app. The service
proxies diagnostic requests to an already-running BastillaOS API.

**Security:** This server does not implement OAuth or bearer-token validation.
Deploy with Cloud Run IAM authentication enabled. Do **not** enable
`--allow-unauthenticated`. A private IAM-protected endpoint is useful for
server-to-server testing but is **not** directly connectable from ChatGPT as a
custom MCP connector. ChatGPT connectivity requires a separate supported OAuth
authorization layer.

## Build and deploy (requires Google Cloud CLI and permissions)

From repository root, with a configured Google Cloud project:

```bash
gcloud builds submit --tag REGION-docker.pkg.dev/PROJECT/REPOSITORY/bastilla-mcp:latest \
  --file integrations/mcp/Dockerfile.cloudrun .
```

If your `gcloud builds submit` version does not support `--file`, build and
push the image using Docker or Cloud Build configuration instead.

```bash
gcloud run deploy bastilla-mcp \
  --image REGION-docker.pkg.dev/PROJECT/REPOSITORY/bastilla-mcp:latest \
  --region REGION \
  --no-allow-unauthenticated \
  --set-env-vars BASTILLA_API_URL=https://YOUR-DEPLOYED-BASTILLA-API
```

The remote BastillaOS API must be reachable from Cloud Run and authorize the
requests appropriately. If it is private or requires a bearer token, the current
bridge needs a compatible identity/authentication integration first.

The MCP path is `/mcp`. Check service logs and test the protocol with an
authorized identity, not only an HTTP GET. An HTTP 401/403 on an unauthenticated
request to a private service is expected and **not** proof of protocol failure.

Do not confuse `/api/mcp/openapi.json` (ChatGPT Actions schema) with a real
MCP transport endpoint.
