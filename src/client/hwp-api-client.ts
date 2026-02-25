import { readFile } from "node:fs/promises";
import { basename } from "node:path";

export interface ConvertResult {
  filename: string;
  markdown: string;
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

    const response = await fetch(`${this.baseUrl}/api/v1/convert`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HWP API error (${response.status}): ${errorText}`);
    }

    return (await response.json()) as ConvertResult;
  }
}
