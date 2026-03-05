# hwpConverMdMCP

HWP/HWPX 파일을 Markdown으로 변환하는 [hwpConverMd](../hwpConverMd) API의 MCP(Model Context Protocol) 서버입니다.

Claude Desktop, Cursor, Claude Code, Flowise 등 MCP 클라이언트에서 HWP 문서 변환 기능을 사용할 수 있습니다.

---

## 아키텍처

```
MCP 클라이언트 (Claude Desktop / Cursor / Flowise CustomFunction)
        │
        │  stdio 또는 Streamable HTTP (JSON-RPC + SSE)
        ▼
  hwpConverMdMCP (Node.js MCP Server)
        │
        │  HTTP (multipart/form-data)
        ▼
  hwpConverMd (Python FastAPI Server)
        │
        ├── HwpFastConverter (XML 직접 파싱, 고속)
        ├── HwpConverter (hwp5html 폴백)
        │
        ├── POST /api/v1/convert        → JSON (markdown + download_url)
        ├── POST /api/v1/convert/base64  → JSON (Base64 입력, Flowise용)
        └── GET  /api/v1/download/{file} → 파일 다운로드
```

---

## 전제조건

- **Node.js** >= 18.0.0
- **hwpConverMd** Python 서버가 실행 중이어야 합니다

### hwpConverMd 서버 실행

```bash
# Docker로 실행 (권장)
cd ../hwpConverMd
docker compose up --build

# 또는 직접 실행
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

서버가 정상 동작하면 `http://localhost:8000/` 에서 `{"status": "ok"}` 응답을 확인할 수 있습니다.

---

## 설치

```bash
npm install
npm run build
```

---

## MCP Tools

| Tool | 설명 | 파라미터 | 응답 |
|------|------|----------|------|
| `convert_hwp_to_md` | 로컬 파일 경로로 변환 | `filePath`: 파일 경로 | markdown 텍스트 |
| `convert_hwp_content_to_md` | Base64 콘텐츠로 변환 | `content`: Base64, `filename`: 파일명 | markdown + `[DOWNLOAD_URL]` |

### convert_hwp_content_to_md 응답 형식

이 도구는 MCP `content` 배열로 두 가지 텍스트 블록을 반환합니다:

```json
{
  "content": [
    { "type": "text", "text": "# 변환된 마크다운 내용..." },
    { "type": "text", "text": "[DOWNLOAD_URL]/api/v1/download/파일명.md" }
  ]
}
```

- 첫 번째 블록: 변환된 마크다운 전체 텍스트
- 두 번째 블록: `[DOWNLOAD_URL]` 접두사 + HWP API의 다운로드 경로 (없을 수도 있음)

---

## 사용법

### 1. Claude Desktop에서 사용 (stdio)

`claude_desktop_config.json`에 추가:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "hwp-converter": {
      "command": "node",
      "args": ["/absolute/path/to/hwpConverMdMCP/dist/transport/stdio.js"],
      "env": {
        "HWP_API_URL": "http://localhost:8000"
      }
    }
  }
}
```

### 2. Cursor에서 사용 (stdio)

프로젝트 루트에 `.cursor/mcp.json` 생성:

```json
{
  "mcpServers": {
    "hwp-converter": {
      "command": "node",
      "args": ["/absolute/path/to/hwpConverMdMCP/dist/transport/stdio.js"],
      "env": {
        "HWP_API_URL": "http://localhost:8000"
      }
    }
  }
}
```

### 3. Claude Code에서 사용 (stdio)

```bash
claude mcp add hwp-converter \
  -e HWP_API_URL=http://localhost:8000 \
  -- node /absolute/path/to/hwpConverMdMCP/dist/transport/stdio.js
```

### 4. Streamable HTTP 모드 (Flowise / 웹 클라이언트용)

```bash
# 빌드 후 실행
npm run start:http

# 또는 개발 모드
npm run dev:http
```

MCP 엔드포인트: `http://localhost:3000/mcp`


## Docker Compose

루트 디렉토리의 `docker-compose.yml`로 전체 스택(API + MCP + Flowise)을 함께 기동합니다:

```bash
# 루트 디렉토리에서
cd ..
docker compose up -d --build
```

| 서비스 | 포트 | URL |
|--------|------|-----|
| api | 8000 | http://localhost:8000/docs |
| mcp | 3001 | http://localhost:3001/mcp |
| flowise | 3000 | http://localhost:3000 |

> MCP 컨테이너의 `HWP_API_URL=http://api:8000` (Docker 내부 네트워크)

---

## 환경변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `HWP_API_URL` | hwpConverMd API 서버 URL | `http://localhost:8000` |
| `MCP_HTTP_PORT` | Streamable HTTP 포트 | `3000` |

---

## 개발

```bash
npm install

npm run dev:stdio     # stdio 모드 개발
npm run dev:http      # HTTP 모드 개발
npm run build         # TypeScript 빌드

npm run start:stdio   # stdio 모드 실행
npm run start:http    # HTTP 모드 실행
```

---

## Kubernetes 배포

### 매니페스트 구조

```
k8s_manifest/
├── common/
│   ├── namespace.yaml         # 네임스페이스
│   ├── default-deny.yaml      # 기본 NetworkPolicy deny-all
│   └── resource-quota.yaml    # 리소스 제한
└── mcp/
    ├── serviceaccount.yaml    # 전용 ServiceAccount
    ├── rbac.yaml              # 최소 권한 RBAC
    ├── configmap.yaml         # 설정
    ├── mcp-deployment.yaml    # Deployment + Service
    ├── networkpolicy.yaml     # MCP → API 통신 허용
    └── ingress.yaml           # 외부 접근
```

### 배포

```bash
# 공통 리소스
kubectl apply -f k8s_manifest/common/

# MCP 서버
kubectl apply -f k8s_manifest/mcp/
```

### K8s 운영 시 주의사항

#### MCP 서버는 1대로 운영 (권장)

MCP 서버는 **인메모리 세션**을 사용합니다. 복수 Pod에서 운영하면 `initialize` 요청을 받은 Pod과 `tools/call` 요청을 받는 Pod이 달라져 `"Server not initialized"` 에러가 발생합니다.

```bash
# MCP는 1대 고정 (stateful)
kubectl scale deploy hwp-mcp --replicas=1

# HPA가 걸려있으면 제거
kubectl delete hpa hwp-mcp
```

> MCP 서버는 프로토콜 중계만 하므로 (CPU 사용 거의 없음) 1대로 충분합니다. 실제 변환 부하는 HWP API가 담당하며 HPA로 스케일링됩니다.

복수 Pod이 필요한 경우 Ingress에 세션 어피니티를 추가하세요:
```yaml
nginx.ingress.kubernetes.io/affinity: "cookie"
nginx.ingress.kubernetes.io/session-cookie-name: "MCP_ROUTE"
nginx.ingress.kubernetes.io/session-cookie-max-age: "600"
```

#### Ingress 설정 (필수)

Base64 인코딩된 HWP 파일이 JSON body로 전송되므로 body size 제한과 타임아웃을 늘려야 합니다:

```yaml
metadata:
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "360"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "360"
```

#### Flowise에서 호출 시 내부 URL 사용

Flowise CustomFunction에서 MCP를 호출할 때는 **K8s 내부 서비스 URL**을 사용하세요:

```javascript
// K8s 내부 (권장) - Ingress 안 거침, body size 제한 없음
const MCP_URL = 'http://hwp-mcp-svc:3000/mcp';

// 외부 Ingress (비권장) - hairpin NAT, SSL, body size 제한
const MCP_URL = 'https://hwp-mcp.your-domain.com/mcp';
```

### 보안 설정

| 항목 | 적용 내용 |
|------|-----------|
| **ServiceAccount** | 서비스별 전용 SA, `automountServiceAccountToken: false` |
| **RBAC** | ConfigMap 읽기만 허용 (최소 권한) |
| **SecurityContext** | `runAsNonRoot`, `drop ALL capabilities`, `seccompProfile: RuntimeDefault` |
| **NetworkPolicy** | `default-deny-all` + 명시적 허용만 (mcp->api, ingress->mcp) |

### 확인

```bash
# Pod 상태
kubectl get pods -l app=hwp-mcp

# MCP 초기화 테스트
kubectl port-forward svc/hwp-mcp-svc 3000:3000
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
```

---

## MCP 도구 호출 방법

### 방법 A: MCP 클라이언트 앱 (Claude Desktop / Cursor)

설정 후 자연어로 요청하면 LLM이 자동으로 도구를 호출합니다:

> "이 HWP 파일을 마크다운으로 변환해줘: /path/to/document.hwp"

### 방법 B: MCP Client SDK 프로그래밍

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const client = new Client({ name: "my-app", version: "1.0.0" });
await client.connect(
  new StreamableHTTPClientTransport(new URL("http://localhost:3000/mcp"))
);

// 파일 경로로 변환 (로컬 환경)
const result = await client.callTool({
  name: "convert_hwp_to_md",
  arguments: { filePath: "/path/to/document.hwp" },
});

// Base64로 변환 (원격/K8s/Flowise 환경)
const result2 = await client.callTool({
  name: "convert_hwp_content_to_md",
  arguments: { content: base64String, filename: "document.hwp" },
});
```

### 방법 C: curl로 JSON-RPC 직접 호출

```bash
# 1. 세션 초기화
SESSION_ID=$(curl -si -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' \
  | grep -i mcp-session-id | awk -F': ' '{print $2}' | tr -d '\r')

echo "Session: $SESSION_ID"

# 2. Initialized 알림
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'

# 3. 도구 호출
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"convert_hwp_to_md","arguments":{"filePath":"/path/to/doc.hwp"}}}'
```

### 두 도구의 사용 시나리오

| 도구 | 언제 사용 | 환경 |
|------|----------|------|
| `convert_hwp_to_md` | MCP 서버와 같은 파일시스템 | 로컬, Docker volume mount |
| `convert_hwp_content_to_md` | 파일시스템이 분리된 환경 | K8s, Flowise, 원격 서버 |

---

## LLM 연동

이 MCP 서버 자체가 LLM 연동 레이어입니다.

| 방식 | 설명 | 코드 필요 |
|------|------|-----------|
| Claude Desktop/Cursor | config.json 설정만으로 자동 연동 | 없음 |
| Claude Code | `claude mcp add` 명령으로 등록 | 없음 |
| Flowise | CustomFunction에서 MCP JSON-RPC 호출 | CustomFunction 코드 |
| 프로그래밍 (Anthropic API) | MCP Client + Claude API 조합 | `examples/llm-with-mcp.ts` |

### Anthropic Claude API + MCP 연동 예제

```bash
ANTHROPIC_API_KEY=sk-ant-... npx tsx examples/llm-with-mcp.ts /path/to/doc.hwp "이 문서를 요약해줘"
```

자세한 코드는 `examples/llm-with-mcp.ts`를 참조하세요.
