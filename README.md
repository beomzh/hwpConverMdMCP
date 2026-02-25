# hwpConverMdMCP

HWP/HWPX 파일을 Markdown으로 변환하는 [hwpConverMd](https://github.com/beomzh/hwpConverMd) 프로젝트의 MCP(Model Context Protocol) 서버입니다.

Claude Desktop, Cursor, Claude Code 등 MCP 클라이언트에서 HWP 문서 변환 기능을 직접 사용할 수 있습니다.

## 아키텍처

```
MCP 클라이언트 (Claude Desktop / Cursor / etc.)
        │
        │  stdio 또는 Streamable HTTP
        ▼
  hwpConverMdMCP (Node.js MCP Server)
        │
        │  HTTP API (multipart/form-data)
        ▼
  hwpConverMd (Python FastAPI Server)
```

## 전제조건

- **Node.js** >= 18.0.0
- **hwpConverMd** Python 서버가 실행 중이어야 합니다

### hwpConverMd 서버 실행

```bash
# hwpConverMd 프로젝트 디렉토리에서
cd ../hwpConverMd

# Docker로 실행 (권장)
docker compose up --build

# 또는 직접 실행
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

서버가 정상 동작하면 `http://localhost:8000` 에서 `{"status": "ok"}` 응답을 확인할 수 있습니다.

## 설치

```bash
npm install
npm run build
```

## MCP Tools

| Tool | 설명 | 파라미터 |
|------|------|----------|
| `convert_hwp_to_md` | 로컬 파일 경로로 HWP/HWPX → Markdown 변환 | `filePath`: 파일 경로 |
| `convert_hwp_content_to_md` | Base64 인코딩 콘텐츠로 변환 | `content`: Base64 문자열, `filename`: 파일명 (.hwp/.hwpx) |

## 사용법

### 1. Claude Desktop에서 사용 (stdio)

`claude_desktop_config.json` 파일에 다음을 추가합니다:

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

개발 모드로 사용하려면:

```json
{
  "mcpServers": {
    "hwp-converter": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/hwpConverMdMCP/src/transport/stdio.ts"],
      "env": {
        "HWP_API_URL": "http://localhost:8000"
      }
    }
  }
}
```

### 2. Cursor에서 사용 (stdio)

프로젝트 루트에 `.cursor/mcp.json` 파일을 생성합니다:

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

### 4. Streamable HTTP 모드 (웹 클라이언트용)

HTTP 서버를 시작합니다:

```bash
# 빌드된 버전
npm run start:http

# 또는 개발 모드
npm run dev:http
```

MCP 엔드포인트: `http://localhost:3000/mcp`

HTTP 클라이언트에서 연결:

```bash
# 초기화 요청 (POST)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
```

## 환경변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `HWP_API_URL` | hwpConverMd Python API 서버 URL | `http://localhost:8000` |
| `MCP_HTTP_PORT` | Streamable HTTP 모드 포트 (HTTP 모드에서만 사용) | `3000` |

## 개발

```bash
# 의존성 설치
npm install

# stdio 모드로 개발
npm run dev:stdio

# HTTP 모드로 개발
npm run dev:http

# 빌드
npm run build

# 빌드 후 실행
npm run start:stdio   # stdio 모드
npm run start:http    # HTTP 모드
```

## Docker로 실행

MCP 서버와 hwpConverMd API 서버를 함께 Docker Compose로 실행할 수 있습니다.

### 사전 준비

프로젝트 디렉토리 구조가 다음과 같아야 합니다:

```
hwpToMd/
├── hwpConverMd/          # Python API 서버
└── hwpConverMdMCP/       # 이 프로젝트 (MCP 서버)
```

### 실행 방법

```bash
# hwpConverMdMCP 디렉토리에서
docker compose up --build -d
```

이 명령으로 두 서비스가 동시에 기동됩니다:

| 서비스 | 컨테이너 | 포트 | 역할 |
|--------|----------|------|------|
| `api` | hwpConverMd API | `8000` | HWP → Markdown 변환 엔진 |
| `mcp` | MCP 서버 | `3000` | MCP 프로토콜 인터페이스 |

> **중요**: MCP 컨테이너의 `HWP_API_URL`은 `http://api:8000`으로 설정되어 있어 Docker 내부 네트워크를 통해 API 서버에 접근합니다.

### 수정이 필요한 부분

`docker-compose.yml`에서 **hwpConverMd 경로**를 확인하세요:

```yaml
services:
  api:
    build: ../hwpConverMd          # <-- hwpConverMd 프로젝트 경로 확인
    volumes:
      - ../hwpConverMd:/app        # <-- 동일 경로
      - ../hwpConverMd/temp:/app/temp
      - ../hwpConverMd/output:/app/output
```

만약 디렉토리 구조가 다르다면 이 경로들을 실제 `hwpConverMd` 프로젝트 위치로 수정해야 합니다.

### 기존 hwpConverMd 컨테이너와 연동

이미 hwpConverMd API가 별도로 실행 중이라면, MCP 컨테이너만 단독 실행할 수 있습니다:

```bash
# 1. 기존 hwpConverMd 네트워크 이름 확인
docker network ls | grep hwpconvermd

# 2. MCP 이미지 빌드
docker build -t hwp-converter-mcp .

# 3. 기존 네트워크에 연결하여 MCP 컨테이너 실행
docker run -d \
  --name hwp-mcp \
  --network hwpconvermd_default \
  -p 3000:3000 \
  -e HWP_API_URL=http://hwpconvermd-api-1:8000 \
  -e MCP_HTTP_PORT=3000 \
  hwp-converter-mcp
```

> **`HWP_API_URL` 수정 포인트**: `hwpconvermd-api-1` 부분을 실제 API 컨테이너 이름으로 변경하세요. `docker ps` 명령으로 확인할 수 있습니다.

### 동작 확인

```bash
# 컨테이너 상태 확인
docker ps

# MCP 서버 로그 확인
docker logs hwp-mcp

# MCP 초기화 테스트
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
```

정상 응답 예시:
```
event: message
data: {"result":{"protocolVersion":"2025-03-26","capabilities":{"logging":{},"tools":{"listChanged":true}},"serverInfo":{"name":"hwp-converter-mcp","version":"1.0.0"}},"jsonrpc":"2.0","id":1}
```

### 종료

```bash
docker compose down
```

## MCP 도구 호출 방법

기존에 API에 직접 curl로 문서를 던지던 방식과 비교:

```
[기존 방식 - 직접 API 호출]
curl -F "file=@doc.hwp" http://localhost:8000/api/v1/convert

[MCP 방식 - LLM이 도구를 호출]
사용자 → "이 문서 변환해줘" → LLM(Claude) → MCP tool call → API → 마크다운 → LLM이 분석
```

### 방법 A: MCP 클라이언트 앱 (Claude Desktop / Cursor)

설정 후 자연어로 요청하면 LLM이 자동으로 도구를 호출합니다:

> "이 HWP 파일을 마크다운으로 변환해줘: /path/to/document.hwp"

### 방법 B: MCP Client SDK로 프로그래밍

```typescript
// examples/mcp-client-basic.ts 참조
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

// base64로 변환 (원격/K8s 환경)
const result2 = await client.callTool({
  name: "convert_hwp_content_to_md",
  arguments: { content: base64String, filename: "document.hwp" },
});
```

실행:
```bash
npx tsx examples/mcp-client-basic.ts /path/to/document.hwp
```

### 방법 C: curl로 직접 JSON-RPC 호출

```bash
# 1. 세션 초기화
SESSION_ID=$(curl -si --max-time 5 -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' \
  | grep -i mcp-session-id | awk -F': ' '{print $2}' | tr -d '\r')

# 2. 도구 호출
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"convert_hwp_to_md","arguments":{"filePath":"/path/to/doc.hwp"}}}'
```

### 두 도구의 사용 시나리오

| 도구 | 언제 사용 | 환경 |
|------|----------|------|
| `convert_hwp_to_md` | MCP 서버와 같은 파일시스템 | 로컬 개발, Docker volume mount |
| `convert_hwp_content_to_md` | 파일시스템이 분리된 환경 | K8s, 원격 서버, 웹 클라이언트 |

## LLM 연동

이 MCP 서버 자체가 LLM 연동 레이어입니다. 별도의 LLM 연동 프로젝트는 필요하지 않습니다.

### 연동 방식 비교

| 방식 | 설명 | 코드 필요 |
|------|------|-----------|
| Claude Desktop/Cursor | config.json 설정만으로 자동 연동 | 없음 |
| Claude Code | `claude mcp add` 명령으로 등록 | 없음 |
| 프로그래밍 (Anthropic API) | MCP Client + Claude API 조합 | `examples/llm-with-mcp.ts` |
| 프로그래밍 (OpenAI 호환) | MCP Client + 다른 LLM API 조합 | 동일 패턴 |

### Anthropic Claude API + MCP 연동 예제

```bash
# 설치
npm install @anthropic-ai/sdk @modelcontextprotocol/sdk

# 실행
ANTHROPIC_API_KEY=sk-ant-... npx tsx examples/llm-with-mcp.ts /path/to/doc.hwp "이 문서를 요약해줘"
```

이 예제는 다음 흐름을 자동으로 수행합니다:

```
1. MCP 서버 연결
2. Claude API에 도구 목록 전달
3. Claude가 convert_hwp_content_to_md 도구 호출 결정
4. MCP 서버에서 HWP → Markdown 변환
5. 변환 결과를 Claude에게 전달
6. Claude가 사용자 요청(요약/분석)을 수행
```

자세한 코드는 `examples/llm-with-mcp.ts`를 참조하세요.

## Kubernetes 배포

`k8s_manifest/` 디렉토리에 API와 MCP를 **별도 프로젝트로 분리**하여 manifest가 준비되어 있습니다.

### 디렉토리 구조

```
k8s_manifest/
├── common/                # 공통 (양쪽 프로젝트 공유)
│   ├── namespace.yaml         # 네임스페이스 + Pod Security Standards
│   ├── resource-quota.yaml    # ResourceQuota + LimitRange
│   └── default-deny.yaml      # 기본 네트워크 차단 정책
├── api/                   # hwpConverMd (Python API) - 별도 프로젝트
│   ├── serviceaccount.yaml
│   ├── rbac.yaml
│   ├── deployment.yaml        # Deployment + Service
│   └── networkpolicy.yaml
└── mcp/                   # hwpConverMdMCP (MCP 서버) - 이 프로젝트
    ├── serviceaccount.yaml
    ├── rbac.yaml
    ├── configmap.yaml
    ├── deployment.yaml        # Deployment + Service
    ├── networkpolicy.yaml
    └── ingress.yaml
```

> **참고**: `api/` 디렉토리의 manifest는 hwpConverMd 프로젝트에서 별도 관리될 수 있습니다.
> 여기서는 참조용으로 포함했으며, 실제 운영 시에는 각 프로젝트 레포에서 독립적으로 관리하세요.

### 보안 설정

| 항목 | 적용 내용 |
|------|-----------|
| **ServiceAccount** | 서비스별 전용 SA (`hwp-api-sa`, `hwp-mcp-sa`), `automountServiceAccountToken: false` |
| **RBAC** | ConfigMap 읽기만 허용 (최소 권한) |
| **SecurityContext** | `runAsNonRoot`, `drop ALL capabilities`, `seccompProfile: RuntimeDefault` |
| **readOnlyRootFilesystem** | MCP: `true` / API: `false` (Python `__pycache__` 등 쓰기 필요) |
| **NetworkPolicy** | `default-deny-all` + 명시적 허용만 (mcp→api, ingress→mcp) |
| **Pod Security Standards** | namespace `baseline` enforce, `restricted` warn/audit |
| **ResourceQuota** | namespace 전체 CPU/Memory/Pod 수 상한 |

### 배포 순서

```bash
# 1. 공통 리소스 (네임스페이스, 기본 정책)
kubectl apply -f k8s_manifest/common/

# 2. API 서버 (hwpConverMd 프로젝트)
kubectl apply -f k8s_manifest/api/

# 3. MCP 서버 (이 프로젝트)
kubectl apply -f k8s_manifest/mcp/
```

### 수정이 필요한 부분

#### 1. 이미지 레지스트리

```yaml
# api/deployment.yaml
image: your-registry.com/hwp-converter-api:1.0.0   # [수정 필요]

# mcp/deployment.yaml
image: your-registry.com/hwp-converter-mcp:1.0.0   # [수정 필요]
```

#### 2. 도메인 + TLS (`mcp/ingress.yaml`)

```yaml
tls:
  - hosts:
      - mcp.your-domain.com       # [수정 필요]
    secretName: hwp-mcp-tls       # [수정 필요]
rules:
  - host: mcp.your-domain.com     # [수정 필요]
```

#### 3. Ingress Controller 네임스페이스 (`api/networkpolicy.yaml`, `mcp/networkpolicy.yaml`)

```yaml
namespaceSelector:
  matchLabels:
    kubernetes.io/metadata.name: ingress-nginx   # [수정 필요] 실제 값 확인
```

```bash
kubectl get ns --show-labels | grep ingress
```

#### 4. IngressClass (`mcp/ingress.yaml`)

```bash
kubectl get ingressclass   # 사용 가능한 클래스 확인
```

### 확인

```bash
# Pod 상태
kubectl get pods -n hwp-converter

# 헬스체크
kubectl port-forward -n hwp-converter svc/hwp-mcp-svc 3000:3000
curl http://localhost:3000/healthz
# → {"status":"ok","service":"hwp-converter-mcp"}

# RBAC 확인
kubectl auth can-i --as=system:serviceaccount:hwp-converter:hwp-mcp-sa \
  get configmaps -n hwp-converter
# → yes

kubectl auth can-i --as=system:serviceaccount:hwp-converter:hwp-mcp-sa \
  list pods -n hwp-converter
# → no (정상 - 최소 권한)
```
