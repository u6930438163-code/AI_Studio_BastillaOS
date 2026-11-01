"""Test the local MCP handshake and live Ollama model reachability."""
import asyncio
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

async def main():
    async with streamablehttp_client("http://127.0.0.1:8000/mcp") as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            names = {tool.name for tool in tools.tools}
            expected = {"ollama_status", "agent_command"}
            assert expected <= names, f"Missing MCP tools: {expected - names}"
            result = await session.call_tool("ollama_status", {})
            if result.isError:
                raise RuntimeError("MCP ollama_status returned a tool error")
            if not result.content:
                raise RuntimeError("MCP ollama_status returned an empty response")
            print("MCP handshake and Ollama diagnostic tool call: OK")
            print("Tools:", ", ".join(sorted(names)))
            print("Ollama diagnostic:", result)

if __name__ == "__main__":
    asyncio.run(main())
