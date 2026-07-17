# 구현 TODO — 플로티 (PRD v0.4)

> 로드맵·포지션: [`ROADMAP.md`](./ROADMAP.md) · [`POSITIONING_TOBE.md`](./POSITIONING_TOBE.md) · [`BETA_OPS.md`](./BETA_OPS.md)

## P0 — 핵심 루프 · 베타 해소

- [ ] **원격 DB** 마이그레이션 적용 확인 (`docs/APPLY_MIGRATION.md` · `db push`)
- [x] 성별 역할 가드 (여 발송 / 남 수행)
- [x] 일일 무료 1회 + 티켓
- [x] 12h 수락 후 타이머 · 미답장/포기 → 24h 수신 밴
- [x] Sea 홈 · 브랜드 · 알림 deep link
- [x] profiles 락다운 · threads/messages INSERT revoke
- [x] 남 열기 전 패스 · Sea 신고/차단
- [x] PRD v0.4 = Sea SSOT
- [x] 레거시 `/send` `/outbox` `/delivery` `/waiting` → `/home`
- [x] 병 12h 타이머 뱃지 · 여 표류 카피 · 남 빈바다 알림 CTA
- [x] 열기 전 닉 숨김 (나이대·지역만)
- [x] 퍼널 `analytics_events` + `track()`
- [x] 푸시 Edge `dispatch-push` (FCM 키 선택)
- [x] 스토어/TRUST 카피 v0.4 정합
- [ ] 여/남 2계정 E2E 수동 (`BETA_OPS.md`)

## P1 — 프로필 인터뷰 v2

- [x] S1–S4 교체 · love_view 칩 · facts 포함 AI 생성
- [x] I1·I2 + `ai_ideal_line` + unlock 「이런 사람이에요」
- [x] `/me`·`/me/edit` Sea 정합
- [ ] (후) soft prompt · 칩 어드민 UI

## P1 — 매칭 · 티켓 (운영)

- [x] 활성 풀 48h→7d→30d→전역
- [x] 이상형 **발송 필터** Out
- [x] 베타 티켓 기본 10장
- [ ] 티켓 상점 IAP (실결제)

## P2 — 채팅 · 출시

- [x] 채팅 무제한 · 7일 · 연락처 제안
- [ ] FCM 키 실통 · TestFlight
- [ ] Palette 연동 (후순위)

## Backlog

- [ ] 티켓 단가·번들 · 채팅 연장
- [ ] 프리셋 40→80 (질 우선)
- [ ] 남 리텐션 A/B · 성별 역할 A/B
- [ ] 커스텀 금칙어 · PASS
- [ ] 닮은 연예인 AI · MBTI 메타

## Done

- [x] 숨결 레거시 제거
- [x] Sea + 채팅/연락처 + 보안 하드닝
- [x] MVP 감사 개선 일괄 해소 (2026-07-18)
