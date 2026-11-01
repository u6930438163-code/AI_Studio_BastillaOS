"""Smoke test: verify the bridge exposes the expected MCP tools.

Start BastillaOS, Ollama and the MCP bridge first. Then run this script.
"""
import asyncio
from mcp import Client

async def main():
    async with Client("http://127.0.0.1:8000/mcp") as client:
        tools = await client.list_tools()
        names = {tool.name for tool in tools.tools}
        expected = {"ollama_status", "agent_command"}
        assert expected <= names, f"Missing MCP tools: {expected - names}"
        result = await client.call_tool("ollama_status", {})
        print("MCP handshake: OK")
        print("Tools:", ", ".join(sorted(names)))
        print("Ollama status:", result)

if __name__ == "__main__":
    asyncio.run(main())
