# 배포 — Supabase + Cloudflare + App Store

한 코드베이스로 세 곳에 배포한다.

```
Supabase(백엔드) ──┬── Cloudflare Pages (SSR 웹/PWA)
                   └── Capacitor 네이티브 셸 → App Store / Play
```

---

## 0. Supabase (이미 완료)

- 프로젝트: `floatie` (`psrlbanwvmnhacgyrgvl`), region ap-northeast-1
- 마이그레이션 전체 적용됨 (`supabase db push` → up to date)
- 클라 키: `.env` (publishable = 공개 키)
- 새 마이그레이션 추가 시: `supabase db push`

---

## 1. Cloudflare Pages (웹)

레포는 이미 CF 배포 준비 완료. **웹 빌드는 모바일과 분리**돼 있다:

| 스크립트 | 용도 | 출력 |
|---|---|---|
| `npm run build:web` | Cloudflare (SSR) | `dist/` (`_worker.js` + `_routes.json` + 정적) |
| `npm run build` | Capacitor(모바일) | `dist/client/` |

### 현황 (2026-07-17)

- 프로젝트: **floatie** → https://floatie.pages.dev  
- **Git Provider: No** (Direct Upload). main 머지만으로는 CF가 안 뜸.  
- 자동 배포: GitHub Actions [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml) (`push` → `main`)

### A. 자동 배포 (권장)

Repo **Settings → Secrets and variables → Actions** 에 등록:

| Secret | 값 |
|--------|-----|
| `CLOUDFLARE_API_TOKEN` | CF → [API Tokens](https://dash.cloudflare.com/profile/api-tokens) → Create Token → **Custom**: Account · **Cloudflare Pages** · **Edit** (+ Workers Scripts Edit 권장). Account 리소스는 이 계정만. |
| `CLOUDFLARE_ACCOUNT_ID` | `86723a5c873a8660fb654694ccf68d93` |
| `VITE_SUPABASE_URL` | `.env` 와 동일 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env` 와 동일 |
| `SUPABASE_URL` | `VITE_SUPABASE_URL` 과 동일 |
| `SUPABASE_PUBLISHABLE_KEY` | `VITE_…` 과 동일 |

Pages **프로젝트 Settings → Environment variables** (Production) 에도 SSR 런타임용으로 `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` 유지.

시크릿 넣은 뒤 Actions → **Deploy Cloudflare Pages** → Run workflow 로 한 번 검증.

### B. CLI로 (수동)
```bash
wrangler login
npm run deploy:pages   # build:web + pages deploy → floatie
```

### C. Supabase Auth 리다이렉트 (필수)
Supabase 대시보드 → Authentication → URL Configuration:
- **Site URL:** `https://<project>.pages.dev` (또는 커스텀 도메인)
- **Redirect URLs**에 추가: 위 도메인 + (인앱 OAuth 쓰면) 커스텀 스킴
- Google OAuth 쓰면 Google Cloud 콘솔의 승인된 리디렉션 URI도 갱신

---

## 2. Capacitor → App Store / Play

현재 `capacitor.config.ts`는 **원격 URL 웹뷰**(`server.url`)로 동작 — SSR이라 로컬 번들이 셸만 됨.

### 배포 전 체크리스트
- [ ] `server.url` → Cloudflare 도메인으로 교체 (현재 `sumgyeol.lovable.app`)
- [ ] `appId` `app.gyeol.client` → `app.floatie.app` 등으로 변경 (스토어 등록 전, 변경 시 재등록 불가하니 신중)
- [ ] 앱 아이콘 / 스플래시 (Floatie 디자인)
- [x] **인앱 회원 탈퇴** — `/me` `deleteAccount` (Apple 5.1.1(v))
- [ ] 푸시(FCM/APNs) — 스토어 필수는 아니나 루프상 사실상 필요, Apple 4.2 통과에도 유리
- [ ] 신고/차단/EULA 노출 확인 — Apple 1.2 (기능은 이미 있음)
- [ ] 연령 등급 17+, 18+ 게이트(생년 게이트 있음)
- [ ] ⚠️ **4.2 최소기능**: 순수 원격 URL 웹뷰는 리젝 위험 → 네이티브 기능(카메라·푸시·햅틱) 보강

### 빌드 흐름
```bash
npm run build            # dist/client (모바일 셸)
npx cap sync ios         # / android
npx cap open ios         # Xcode → Archive → App Store Connect
```

---

## 3. 푸시 알림 (FCM/APNs)

**구현됨(코드/DB):**
- 클라 등록 `src/lib/push.ts` — 네이티브에서만 권한 요청·등록, 웹은 no-op
- 토큰 저장: `device_tokens` 테이블 + `upsert_device_token()` RPC (원격 적용됨)
- `_authenticated` 진입 시 자동 등록

**남은 것(당신 계정/키):**
- iOS: Apple Developer → **APNs Auth Key(.p8)** → Xcode에 Push Notifications capability 추가
- Android: Firebase 프로젝트 → **google-services.json** → `android/app/`에 추가, FCM 서버키
- **발송 Edge Function**: `dispatch-push` — `in_app_notifications` insert 트리거(pg_net 설정 시) 또는 수동 invoke. `device_tokens` → FCM (`FCM_SERVER_KEY`). payload URL은 **`/home?d=`** 또는 **`/thread/$id`** (레거시 `/delivery` 금지).
- 플러그인 반영: `npm i` 후 `npx cap sync` (이미 `@capacitor/push-notifications` 설치됨)

## 권장 순서
1. **Cloudflare 웹 배포** (§1) → `.pages.dev`에서 실기기 테스트
2. 웹 안정화 후 **App Store 관문**(§2: 회원탈퇴·appId·아이콘·푸시·4.2 대응)
3. 스토어 제출
