import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HwpApiClient } from "./client/hwp-api-client.js";
import { registerConvertFileTool } from "./tools/convert-file.js";
import { registerConvertContentTool } from "./tools/convert-content.js";
import { loadConfig } from "./config.js";

export function createServer(): McpServer {
  const config = loadConfig();
  const apiClient = new HwpApiClient(config.hwpApiUrl);

  const server = new McpServer(
    {
      name: "hwp-converter-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        logging: {},
      },
    }
  );

  registerConvertFileTool(server, apiClient);
  registerConvertContentTool(server, apiClient);

  return server;
}

export { loadConfig } from "./config.js";
