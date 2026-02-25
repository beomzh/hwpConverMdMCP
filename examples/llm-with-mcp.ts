/**
 * LLM + MCP 연동 예제
 *
 * Anthropic Claude API를 사용하여 HWP 문서를 변환하고,
 * LLM이 내용을 분석/요약하는 전체 파이프라인입니다.
 *
 * 실행:
 *   ANTHROPIC_API_KEY=sk-ant-... npx tsx examples/llm-with-mcp.ts /path/to/document.hwp "이 문서를 요약해줘"
 *
 * 사전 준비:
 *   - MCP 서버 실행 중
 *   - npm install @anthropic-ai/sdk @modelcontextprotocol/sdk
 *   - ANTHROPIC_API_KEY 환경변수 설정
 */

import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

// ================================================
// [수정 필요] 환경에 맞게 변경
// ================================================
const MCP_URL = process.env.MCP_URL || "http://localhost:3000/mcp";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY 환경변수를 설정하세요.");
  process.exit(1);
}

// MCP 도구 정의를 Anthropic tool 형식으로 변환
function mcpToolToAnthropicTool(mcpTool: {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}): Anthropic.Tool {
  return {
    name: mcpTool.name,
    description: mcpTool.description || "",
    input_schema: mcpTool.inputSchema as Anthropic.Tool["input_schema"],
  };
}

async function main() {
  const filePath = process.argv[2];
  const userPrompt = process.argv[3] || "이 문서의 핵심 내용을 요약해줘";

  if (!filePath) {
    console.error(
      '사용법: npx tsx examples/llm-with-mcp.ts <파일경로.hwp> ["프롬프트"]'
    );
    process.exit(1);
  }

  // ===== Step 1: MCP 서버 연결 =====
  const mcpClient = new Client({
    name: "llm-hwp-agent",
    version: "1.0.0",
  });

  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  await mcpClient.connect(transport);
  console.error("[MCP] 서버 연결됨");

  // MCP 도구 목록 가져오기
  const { tools: mcpTools } = await mcpClient.listTools();
  const anthropicTools = mcpTools.map(mcpToolToAnthropicTool);
  console.error("[MCP] 도구:", mcpTools.map((t) => t.name).join(", "));

  // ===== Step 2: 파일을 base64로 준비 =====
  const fileBuffer = readFileSync(filePath);
  const base64Content = fileBuffer.toString("base64");
  const filename = basename(filePath);

  // ===== Step 3: LLM에게 문서 변환 + 분석 요청 =====
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  // 첫 번째 메시지: 사용자 요청
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `HWP 파일 "${filename}"을 마크다운으로 변환한 후, 다음 작업을 수행해줘:\n\n${userPrompt}\n\n파일 내용(base64): 이미 준비되어 있으니 convert_hwp_content_to_md 도구를 사용해줘.`,
    },
  ];

  console.error("\n[LLM] Claude에게 요청 중...\n");

  // ===== Step 4: Agentic Loop - LLM이 도구를 호출할 때까지 반복 =====
  let continueLoop = true;

  while (continueLoop) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      tools: anthropicTools,
      messages,
    });

    // 응답 처리
    if (response.stop_reason === "tool_use") {
      // LLM이 도구 호출을 요청함
      const assistantContent = response.content;
      messages.push({ role: "assistant", content: assistantContent });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of assistantContent) {
        if (block.type === "tool_use") {
          console.error(`[LLM → MCP] 도구 호출: ${block.name}`);

          // 도구 인자 준비 (base64 콘텐츠 주입)
          let args = block.input as Record<string, string>;
          if (block.name === "convert_hwp_content_to_md") {
            args = { ...args, content: base64Content, filename };
          }

          // MCP 서버에 도구 호출
          const mcpResult = await mcpClient.callTool({
            name: block.name,
            arguments: args,
          });

          const resultText = (
            mcpResult.content as Array<{ type: string; text: string }>
          )[0]?.text;

          console.error(
            `[MCP → LLM] 결과: ${resultText?.substring(0, 100)}...`
          );

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: resultText || "변환 결과가 비어있습니다.",
            is_error: mcpResult.isError === true,
          });
        }
      }

      // 도구 결과를 대화에 추가
      messages.push({ role: "user", content: toolResults });
    } else {
      // LLM이 최종 응답을 생성함
      continueLoop = false;

      console.log("\n" + "=".repeat(60));
      console.log("LLM 분석 결과:");
      console.log("=".repeat(60) + "\n");

      for (const block of response.content) {
        if (block.type === "text") {
          console.log(block.text);
        }
      }
    }
  }

  await mcpClient.close();
}

main().catch(console.error);
