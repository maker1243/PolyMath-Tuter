# PolyMath Tutor 🎓

**융합형 AI 학습·실습 플랫폼** — 소크라테스식 AI 튜터 + 실시간 협업 코딩 + CRDT 기반 공유 에디터 + 학습 활동 영구 기록.

| 영역 | 핵심 |
|------|------|
| 🤖 **AI 튜터** | Claude / Gemini / Groq 중 선택, 소크라테스식 반문 또는 "건너뛰기 (바로 답)" 모드 |
| 👥 **협업 룸** | Yjs CRDT 로 실시간 동시 편집, 공유 채팅·파일·AI 호출, 호스트 지갑 (키 없는 참여자도 호스트 비용으로 AI 사용) |
| 📚 **학습 기록** | 로그인 사용자의 모든 활동 영구 저장 → 대시보드 KPI·주간 차트·CSV 내보내기 |
| 🎮 **생산성** | 뽀모도로 타이머, 키보드 단축키 (`?`), 테마 토글, 멘션 자동완성, QR 공유 |

## 🚀 로컬 실행

```bash
npm install
npm run dev
# http://localhost:3000
```

AI 공급자 키는 **설정 페이지** 에서 각자 저장 (localStorage + 로그인 시 서버 동기화). 키 없으면 자동으로 데모 응답.

## 📦 배포 (Fly.io, 5분)

데이터 디스크 포함 1-region 배포. 자세한 가이드는 [DEPLOY.md](./DEPLOY.md).

```bash
# 1) Fly CLI 설치 후
fly launch --no-deploy          # fly.toml 생성 — app 이름만 바꾸기
fly volumes create polymath_data --size 1 --region nrt
fly deploy
```

## 🏗️ 아키텍처

- **Next.js 14 App Router** + TypeScript + Tailwind
- **Yjs** + y-monaco 로 공유 에디터 CRDT (서버 relay 통해 broadcast)
- **쿠키 세션** (scrypt + HttpOnly) · process 전역 저장소 (dev 모듈 격리 회피)
- **JSON 디스크 영속** (`$POLYMATH_DATA_DIR` 또는 `./.polymath-data`) — rooms, auth, activity, user-prefs, uploaded files
- **AI**: `@anthropic-ai/sdk` + REST (Gemini, Groq) — provider 추상화

## 🔑 주요 디렉토리

```
app/
  api/
    auth/{login,signup,logout,me,password,profile}
    collab/[roomId]/{stream,message,cursor,typing,run,ai-ask,file,host,...}
    user/prefs
    activity/{summary,export}
  collab/[roomId]/page.tsx      # 1200+ 줄 — 룸 메인 UI
  dashboard, tutor, settings, auth, ...

lib/
  collab-store.ts               # Room·CRDT·broadcast 중앙 저장소
  collab-persist.ts             # JSON 디스크 영속
  auth-store.ts, auth.ts        # 세션 + scrypt
  activity-store.ts             # 활동 집계
  providers.ts, claude.ts       # AI 공급자 추상화
  data-dir.ts                   # POLYMATH_DATA_DIR 유틸
```

## 📝 환경변수

[.env.example](./.env.example) 참조. 핵심:
- `POLYMATH_DATA_DIR` — 영속 데이터 디렉토리 (기본 `.polymath-data`)
- `ANTHROPIC_API_KEY` — 서버측 fallback (선택)

## 🧪 테스트

```bash
npm run typecheck
```

E2E 는 아직 없음 (TODO).

## 📄 라이선스

MIT.
