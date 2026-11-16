# 배포 가이드 (Fly.io)

PolyMath 는 **Yjs CRDT · SSE · 디스크 저장** 을 쓰므로 serverless(Vercel) 대신 **persistent VM + volume** 이 있는 Fly.io 가 가장 궁합이 좋습니다. 5분이면 끝납니다.

## 사전 준비

1. [Fly CLI 설치](https://fly.io/docs/hands-on/install-flyctl/) — Windows:
   ```powershell
   iwr https://fly.io/install.ps1 -useb | iex
   ```
2. `fly auth signup` 또는 `fly auth login`
3. 결제카드 등록 — 무료 티어 내에서는 과금 X (약관 요구)

## 1. 앱 생성 & volume

```bash
cd F:/tca

# fly.toml 생성 (이미 레포에 있으므로 app 이름만 커스터마이즈 할 거면 skip)
fly launch --no-deploy
# → "copy existing config?" → Yes
# → app name: polymath-tutor (당신 선호 이름)
# → region: nrt (도쿄, 한국 접근 가장 빠름)
# → setup Postgres / Redis? → No

# 영속 데이터용 volume 1GB (같은 region)
fly volumes create polymath_data --size 1 --region nrt
```

`fly.toml` 안 `app = "polymath-tutor"` 를 당신이 만든 이름으로 바꾸세요.

## 2. 환경변수 (선택)

서버 측 fallback 키가 필요하면:

```bash
fly secrets set ANTHROPIC_API_KEY=sk-ant-...
```

없어도 작동 — 사용자가 각자 설정에 자기 키 입력.

## 3. 배포

```bash
fly deploy
```

Docker 이미지 빌드 (약 2-3분) → Fly 레지스트리 푸시 → 실행. 끝나면:

```bash
fly open
# https://polymath-tutor.fly.dev 에서 열림
```

## 4. 도메인 연결 (선택)

```bash
fly certs create polymath.yourdomain.com
# 나오는 DNS 레코드를 당신 도메인에 추가 (CNAME 또는 A/AAAA)
fly certs show polymath.yourdomain.com
```

## 5. 로그·모니터링

```bash
fly logs                           # 실시간 로그
fly status                         # 머신 상태
fly ssh console                    # VM 접속
fly ssh console --command "ls /data"  # 영속 데이터 확인
```

## 6. 데이터 백업

JSON 파일 몇 개뿐이라 간단:

```bash
fly ssh console
cd /data
tar -czf /tmp/polymath-backup.tgz *.json files/
# 로컬로:
exit
fly ssh sftp get /tmp/polymath-backup.tgz ./backup-$(date +%F).tgz
```

## 7. 비용 가늠

- VM shared-cpu-1x 512MB · auto-stop: **거의 무료** (유휴 시 중지, 접속 시 1-2초 wake)
- Volume 1GB: 약 $0.15/월
- 아웃바운드 전송: 160GB/월 무료
- **총: 사용자 100명까지 월 $0 ~ $1**

트래픽 늘면:
- `[[vm]] memory_mb = 1024` 로 상향
- `min_machines_running = 1` 로 상시 가동 (약 $3/월)

## 트러블슈팅

### "Yjs was already imported" 로그
`next.config.mjs` 의 externals 가 작동 중인지 확인. 재배포로 해결.

### 코드 수정이 다른 탭에 안 전파됨
dev 모드 특성. **production (`fly deploy` 결과) 에서는 정상**. 의심 시 `fly logs` 로 `/y/update` POST 가 보이는지 확인.

### Volume 공간 부족
```bash
fly volumes list
fly volumes extend <volume-id> --size 5    # 5GB 로 늘림
```

### "앱이 자꾸 자고 있어서 깨우기 느리다"
`fly.toml` 에서:
```toml
auto_stop_machines = "suspend"   # stop 대신 suspend — 더 빠른 wake
min_machines_running = 1         # 1 이면 상시 가동 (유료)
```

## 다음 단계

- **GitHub Actions 로 CI/CD**: push 시 자동 `fly deploy`
- **Sentry 모니터링**: `fly secrets set SENTRY_DSN=...`
- **커스텀 도메인**: 위 4번
- **Postgres 전환**: 사용자 1000명 이상이면 JSON → DB
