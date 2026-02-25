export interface Config {
  hwpApiUrl: string;
  mcpHttpPort: number;
}

export function loadConfig(): Config {
  const hwpApiUrl = process.env.HWP_API_URL || "http://localhost:8000";
  const mcpHttpPort = parseInt(process.env.MCP_HTTP_PORT || "3000", 10);

  return { hwpApiUrl, mcpHttpPort };
}
