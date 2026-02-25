import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HwpApiClient } from "../client/hwp-api-client.js";

export function registerConvertFileTool(
  server: McpServer,
  apiClient: HwpApiClient
): void {
  server.registerTool(
    "convert_hwp_to_md",
    {
      title: "Convert HWP file to Markdown",
      description:
        "로컬 파일 경로의 HWP 또는 HWPX 파일을 Markdown으로 변환합니다. " +
        "서버 파일시스템에 존재하는 파일 경로를 지정해야 합니다.",
      inputSchema: {
        filePath: z
          .string()
          .describe("HWP 또는 HWPX 파일의 절대 또는 상대 경로"),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async ({ filePath }) => {
      try {
        const result = await apiClient.convertFile(filePath);
        return {
          content: [
            {
              type: "text" as const,
              text: result.markdown,
            },
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
