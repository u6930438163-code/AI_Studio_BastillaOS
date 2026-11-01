# Secure GitHub agent integration — preparation

This directory defines the intended permissions for Aria (`si_1`), Alex, Astyria and Aurelius. **This is a configuration scaffold, not a live connection.** The existing BastillaOS chat roles are not independent background agents.

## Next implementation steps

1. Implement a server-side GitHub App installation-token client. Never pass tokens to model prompts, browser code, or logs.
2. Add an authenticated webhook handler at `/api/integrations/github/webhook`, verify `X-Hub-Signature-256` with a dedicated webhook secret, reject replays, and deduplicate deliveries.
3. Map authenticated agent actions to the allowlist in `agents.config.json`; reject all other operations server-side. Create a per-agent audit trail.
4. Restrict writes to `integration/*` or `agents/*` branches and pull requests; protect `main`, require reviews and checks, and disable automatic merge.
5. Connect the existing `/api/triad/message` roles to a queued job runner with explicit scoped service identity, rate limits, timeouts and cancellation. Do not assume role names are autonomous services.
6. Configure GitHub App installation and server secrets in the deployment environment, never in the repository. Test webhook verification and a draft PR with a disposable branch before enabling agents.

## Security notes

The repository is currently public. Do not commit API keys, tokens, OAuth secrets, chat histories or private model data. The `BASTILLA_GITHUB_APP_TOKEN` name is illustrative: prefer short-lived installation tokens minted on the server. Do not use a personal access token with broad administrator permissions. Never give AI models unrestricted shell, root or repository administration access.
