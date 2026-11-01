"""Test the local MCP handshake and live Ollama model reachability."""
import asyncio
import json
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
            print("MCP handshake: OK")
            print("Tools:", ", ".join(sorted(names)))
            result = await session.call_tool("ollama_status", {})
            if result.isError:
                raise RuntimeError(f"Ollama status tool failed: {result.content}")
            status = result.structuredContent
            if status is None:
                for block in result.content:
                    if block.type == "text":
                        try:
                            status = json.loads(block.text)
                        except json.JSONDecodeError:
                            continue
                        break
            if not isinstance(status, dict) or status.get("connected") is not True:
                raise RuntimeError(f"Ollama is not connected: {status!r}")
            print("Ollama diagnostic: connected, models:", len(status.get("models", [])))

if __name__ == "__main__":
    asyncio.run(main())
