import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// 创建了一个 MCP Server，只不过当前的 MCP Server 没有任何的工具
export const server = new McpServer({
  name: "check-dependency",
  version: "1.0.0",
});
