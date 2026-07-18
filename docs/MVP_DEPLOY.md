# MVP 배포 준비 — 플로티 (Closed beta → 웹 공개)

> 2026-07-18 · SSOT 운영: [`BETA_OPS.md`](./BETA_OPS.md) · 인프라: [`DEPLOY.md`](./DEPLOY.md)  
> 목표: **Cloudflare 웹 MVP** 초대/소프트 오픈 가능 상태. TestFlight는 다음 게이트.

---

## 이미 된 것

| 영역 | 상태 |
|------|------|
| Sea 핵심 루프 · 동시성/재배달 (#18) | Done · 원격 DB 적용됨 |
| Pages 자동 배포 (`main` push) | Workflow 있음 → https://floatie.pages.dev |
| Edge `generate-profile` · `dispatch-push` | Deployed (FCM 키는 선택) |
| 인앱 탈퇴 · 신고/차단 · 18+ 게이트 | Done |
| E2E 스크립트 | `node scripts/e2e-beta.mjs` |

---

## Go / No-Go (웹 MVP)

### Must (배포 전)

- [ ] **Pages 최신 배포** 성공 — Actions → Deploy Cloudflare Pages green  
- [ ] **Auth URL** — Supabase Site URL + Redirect = `https://floatie.pages.dev` (+ 커스텀 도메인 있으면 추가)  
- [ ] **실기기 스모크** — 여/남 각 1: 띄우기 → 패스재배달 or 답장 → unlock → 매칭 → 메시지 1통  
- [ ] **OTP 정책** — 초대만이면 `dev_otp` 유지 + QA 계정 문서화 / 외부면 SMS 연동  
- [ ] **신고 담당** 1명 · [`TRUST_AND_SAFETY.md`](./TRUST_AND_SAFETY.md) SLA 인지  

### Should (같은 주)

- [ ] Edge **`expire-stale` cron** 15분 (Dashboard 스케줄 또는 `CRON_SECRET` + 외부 cron)  
- [ ] `FCM_SERVER_KEY` (푸시) — 없어도 웹 MVP 가능, 리텐션에 유리  
- [ ] Capacitor `server.url` → `https://floatie.pages.dev` (네이티브 셸 쓸 때)  

### Later (Soft open / 스토어)

- [ ] Chat-first 홈 (Epic B)  
- [ ] appId/아이콘 polish · TestFlight  
- [ ] `dev_otp` off · 본인인증 강화  
- [ ] IAP · `ticket_grant_mode` → 2장  
- [ ] 약관/개인정보 법률 확정  

---

## 배포 명령 (웹)

```bash
# 자동: main 푸시 → GitHub Actions
# 수동:
npm run deploy:pages   # build:web + wrangler pages deploy
```

시크릿: [`DEPLOY.md`](./DEPLOY.md) §1 A.

---

## 배포 직후 체크 (5분)

1. https://floatie.pages.dev/login — 카피·파비콘  
2. 로그인 → `/home` Sea  
3. 여: 플로티 1개 띄우기 · 표류 카피  
4. 남: 나이대·지역만 · 패스 시 여 알림  
5. `/send` → `/home` 리다이렉트  

---

## 네이티브 (후속)

`capacitor.config.ts` 의 `server.url` 을 Pages 도메인으로 맞춘 뒤:

```bash
npm run build && npx cap sync ios
npx cap open ios   # Archive → TestFlight
```

스토어 카피: [`store/APP_STORE_COPY.md`](./store/APP_STORE_COPY.md)

---

## 의도적 보류 (MVP 웹)

| 항목 | 이유 |
|------|------|
| Chat-first 홈 전면 개편 | 디자인 스파이크 필요 · 루프는 `/thread` 로 충분 |
| 프리셋 40→80 | 학습 후 큐레이션 |
| 성별 역할 A/B | 데이터 부족 |
