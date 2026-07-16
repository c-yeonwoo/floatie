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

### A. 대시보드로 (권장, Git 연동)
1. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git** → `c-yeonwoo/sumgyeol` 선택
2. 빌드 설정:
   - **Build command:** `npm run build:web`
   - **Build output directory:** `dist`
   - **Node version:** 20 (환경변수 `NODE_VERSION=20`)
3. **환경변수** (Production & Preview 모두):
   ```
   SUPABASE_URL=https://psrlbanwvmnhacgyrgvl.supabase.co
   SUPABASE_PUBLISHABLE_KEY=sb_publishable_mmGLw3hDiVcl7JFxxDSRZQ_nI-HME2x
   VITE_SUPABASE_URL=https://psrlbanwvmnhacgyrgvl.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_mmGLw3hDiVcl7JFxxDSRZQ_nI-HME2x
   DEPLOY_TARGET=cloudflare
   ```
   (`VITE_*`는 빌드 타임에 박히고, `SUPABASE_*`는 SSR 워커 런타임에서 읽음)
4. Deploy → `https://<project>.pages.dev` 발급

### B. CLI로 (수동)
```bash
npm i -g wrangler
wrangler login                 # 브라우저 인증
npm run build:web
wrangler pages deploy dist --project-name floatie
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
- [ ] **인앱 회원 탈퇴** 구현 — Apple 5.1.1(v) 필수, 현재 미구현
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

## 권장 순서
1. **Cloudflare 웹 배포** (§1) → `.pages.dev`에서 실기기 테스트
2. 웹 안정화 후 **App Store 관문**(§2: 회원탈퇴·appId·아이콘·푸시·4.2 대응)
3. 스토어 제출
