/**
 * 기본 MCP Client 예제
 *
 * MCP 서버에 직접 연결하여 HWP → Markdown 변환 도구를 호출합니다.
 * 기존에 curl로 API에 직접 던지던 것과 동일한 역할입니다.
 *
 * 실행:
 *   npx tsx examples/mcp-client-basic.ts /path/to/document.hwp
 *
 * 사전 준비:
 *   - MCP 서버 실행 중 (npm run start:http 또는 docker compose up)
 *   - npm install @modelcontextprotocol/sdk
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

// ================================================
// [수정 필요] MCP 서버 주소
// 로컬: http://localhost:3000/mcp
// K8s:  http://mcp.your-domain.com/mcp
// ================================================
const MCP_URL = process.env.MCP_URL || "http://localhost:3000/mcp";

async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error("사용법: npx tsx examples/mcp-client-basic.ts <파일경로.hwp>");
    process.exit(1);
  }

  // 1. MCP 클라이언트 생성 및 연결
  const client = new Client({
    name: "hwp-converter-client",
    version: "1.0.0",
  });

  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  await client.connect(transport);
  console.error("[연결됨] MCP 서버:", MCP_URL);

  // 2. 사용 가능한 도구 목록 확인
  const tools = await client.listTools();
  console.error("[도구 목록]", tools.tools.map((t) => t.name).join(", "));

  // 3. 방법 A: 파일 경로로 변환 (MCP 서버와 같은 파일시스템일 때)
  //    → 로컬 개발 환경에서 사용
  console.error("\n--- 방법 A: 파일 경로 기반 ---");
  try {
    const result = await client.callTool({
      name: "convert_hwp_to_md",
      arguments: { filePath },
    });

    const markdown = (result.content as Array<{ type: string; text: string }>)[0]?.text;
    if (result.isError) {
      console.error("[오류]", markdown);
    } else {
      console.log(markdown);
    }
  } catch (err) {
    console.error("[파일경로 방식 실패 - base64 방식 시도]", (err as Error).message);

    // 4. 방법 B: Base64 콘텐츠로 변환 (원격 MCP 서버, K8s 환경)
    //    → 클라이언트와 서버의 파일시스템이 다를 때
    console.error("\n--- 방법 B: Base64 콘텐츠 기반 ---");
    const fileBuffer = readFileSync(filePath);
    const base64Content = fileBuffer.toString("base64");
    const filename = basename(filePath);

    const result2 = await client.callTool({
      name: "convert_hwp_content_to_md",
      arguments: { content: base64Content, filename },
    });

    const markdown2 = (result2.content as Array<{ type: string; text: string }>)[0]?.text;
    if (result2.isError) {
      console.error("[오류]", markdown2);
    } else {
      console.log(markdown2);
    }
  }

  await client.close();
}

main().catch(console.error);
