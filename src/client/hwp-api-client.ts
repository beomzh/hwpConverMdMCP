import { readFile } from "node:fs/promises";
import { basename } from "node:path";

export interface ConvertResult {
  filename: string;
  markdown: string;
  download_url?: string;
  error?: string;
}

/** HWP API 실제 응답 형식: { results: ConvertResult[] } */
interface ApiResponse {
  results: ConvertResult[];
}

export class HwpApiClient {
  constructor(private baseUrl: string) {}

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/`);
      const data = (await res.json()) as { status: string };
      return data.status === "ok";
    } catch {
      return false;
    }
  }

  async convertFile(filePath: string): Promise<ConvertResult> {
    const fileBuffer = await readFile(filePath);
    const filename = basename(filePath);
    return this.sendConvertRequest(fileBuffer, filename);
  }

  async convertContent(
    base64Content: string,
    filename: string
  ): Promise<ConvertResult> {
    const fileBuffer = Buffer.from(base64Content, "base64");
    return this.sendConvertRequest(fileBuffer, filename);
  }

  private async sendConvertRequest(
    fileBuffer: Buffer,
    filename: string
  ): Promise<ConvertResult> {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: "application/octet-stream" });
    formData.append("file", blob, filename);

    // 고속 변환 기본, hwp5html 폴백 타임아웃(300초) + 여유 = 6분
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6 * 60 * 1000);

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/convert`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HWP API error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as ApiResponse;
      const result = data.results?.[0];
      if (!result) {
        throw new Error("API 응답에 변환 결과가 없습니다.");
      }
      if (result.error) {
        throw new Error(result.error);
      }
      return result;
    } finally {
      clearTimeout(timeout);
    }
  }
}
