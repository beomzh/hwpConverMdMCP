#!/usr/bin/env node
import express from "express";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, loadConfig } from "../index.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const app = express();

  const sessions = new Map<string, StreamableHTTPServerTransport>();

  // K8s 헬스체크용 엔드포인트
  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok", service: "hwp-converter-mcp" });
  });

  app.post("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && sessions.has(sessionId)) {
      const transport = sessions.get(sessionId)!;
      await transport.handleRequest(req, res);
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        sessions.set(id, transport);
      },
    });

    transport.onclose = () => {
      const id = transport.sessionId;
      if (id) sessions.delete(id);
    };

    const server = createServer();
    await server.connect(transport);
    await transport.handleRequest(req, res);
  });

  app.get("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId && sessions.has(sessionId)) {
      const transport = sessions.get(sessionId)!;
      await transport.handleRequest(req, res);
      return;
    }
    res.status(400).json({ error: "No valid session. Send an initialize request first." });
  });

  app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId && sessions.has(sessionId)) {
      const transport = sessions.get(sessionId)!;
      await transport.handleRequest(req, res);
      sessions.delete(sessionId);
      return;
    }
    res.status(400).json({ error: "No valid session." });
  });

  app.listen(config.mcpHttpPort, () => {
    console.log(
      `HWP Converter MCP server (Streamable HTTP) listening on port ${config.mcpHttpPort}`
    );
    console.log(`  Endpoint: http://localhost:${config.mcpHttpPort}/mcp`);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
