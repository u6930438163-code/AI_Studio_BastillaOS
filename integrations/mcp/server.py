"""BastillaOS read-only MCP bridge for the existing local Ollama-backed API.

Run on the same host as BastillaOS. Do not expose this service directly to
the public internet: place it behind HTTPS with authenticated access.
"""
import os
import httpx
from mcp.server.fastmcp import FastMCP

BASE = os.environ.get("BASTILLA_API_URL", "http://127.0.0.1:3000").rstrip("/")
TIMEOUT = float(os.environ.get("BASTILLA_API_TIMEOUT", "90"))
mcp = FastMCP("BastillaOS Ollama Bridge", json_response=True)

async def request(method: str, path: str, payload=None, allow_statuses=()):
    async with httpx.AsyncClient(timeout=TIMEOUT, trust_env=False) as client:
        response = await client.request(method, BASE + path, json=payload)
        if response.status_code not in allow_statuses:
            response.raise_for_status()
        return response.json()

@mcp.tool()
async def ollama_status() -> dict:
    """Read live local Ollama connectivity and model status."""
    return await request("GET", "/api/ollama/models", allow_statuses=(503,))

@mcp.tool()
async def agent_command(agent: str = "triad", command: str = "SYSTEM_STATUS") -> dict:
    """Run one predefined read-only diagnostic command for an agent role."""
    if agent not in {"triad", "Alex", "Astyria", "Aurelius"}:
        raise ValueError("Unsupported agent role")
    if command not in {"SYSTEM_STATUS", "DATA_STORE_AUDIT", "VERSION_TIMELINE"}:
        raise ValueError("Unsupported diagnostic command")
    return await request("POST", "/api/triad/command", {"agent": agent, "command": command})

if __name__ == "__main__":
    # Bind only to loopback. Use a separately authenticated HTTPS reverse proxy.
    mcp.run(transport="streamable-http")
