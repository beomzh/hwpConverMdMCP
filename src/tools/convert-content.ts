import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HwpApiClient } from "../client/hwp-api-client.js";

export function registerConvertContentTool(
  server: McpServer,
  apiClient: HwpApiClient
): void {
  server.registerTool(
    "convert_hwp_content_to_md",
    {
      title: "Convert HWP content to Markdown",
      description:
        "Base64로 인코딩된 HWP 또는 HWPX 파일 내용을 Markdown으로 변환합니다. " +
        "파일 경로 대신 파일 내용을 직접 전달할 때 사용합니다. " +
        "filename은 포맷 감지를 위해 .hwp 또는 .hwpx 확장자를 포함해야 합니다.",
      inputSchema: {
        content: z
          .string()
          .describe("Base64로 인코딩된 HWP 또는 HWPX 파일 내용"),
        filename: z
          .string()
          .describe(
            "원본 파일명 (.hwp 또는 .hwpx 확장자 포함, 포맷 감지용)"
          ),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async ({ content, filename }) => {
      try {
        const ext = filename.toLowerCase();
        if (!ext.endsWith(".hwp") && !ext.endsWith(".hwpx")) {
          return {
            content: [
              {
                type: "text" as const,
                text: "오류: 파일명은 .hwp 또는 .hwpx 확장자를 포함해야 합니다.",
              },
            ],
            isError: true,
          };
        }

        const result = await apiClient.convertContent(content, filename);
        return {
          content: [
            { type: "text" as const, text: result.markdown },
            { type: "text" as const, text: `[DOWNLOAD_URL]${result.download_url || ""}` },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `변환 실패: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
