# 구현 TODO — 플로티 (PRD v0.4)

## P0 — 핵심 루프

- [ ] **원격 DB** 마이그레이션 적용 확인 (`docs/APPLY_MIGRATION.md`)
- [x] 성별 역할 가드 (여 발송 / 남 수행)
- [x] 일일 무료 1회 + 티켓
- [x] 12h 수락 후 타이머 · 미답장/포기 → 24h 수신 밴
- [x] Sea 홈 · 브랜드 · 알림 deep link
- [x] profiles 락다운 · threads/messages INSERT revoke
- [x] 남 열기 전 패스 · Sea 신고/차단
- [x] PRD v0.4 = Sea SSOT
- [ ] 여/남 2계정 E2E 수동 테스트 (재검증)

## P1 — 프로필 인터뷰 v2

설계: [`PROFILE_INTERVIEW_V2.md`](./PROFILE_INTERVIEW_V2.md) · **Accepted**

- [x] PO 확정: I1·I2 필수 · 흡연 포함 · 칩 고정(+어드민 후속) · 카드는 AI 요약
- [x] I1·I2 + `ai_ideal_line` + unlock 「이런 사람에게 끌려요」
- [x] S4 주말 에너지 · AI 7:3 · facts(직업·흡연·키선택)
- [x] 원격 마이그레이션 `20260717200000` + Edge `generate-profile` 배포
- [x] `/me`·`/me/edit` Sea 정합 (사진3 · 키필수 · intro/ideal · 홈 복귀)
- [x] `/me/edit` 인터뷰 재편집 (S1–S4 · I1–I2) + AI 재생성(2/일)
- [ ] (후) soft prompt · 칩 어드민 UI

## P1 — 매칭 · 티켓 (운영)

- [x] 활성 풀 48h→7d→30d→전역
- [x] 이상형 **발송 필터** Out (프로필 서술용 이상형과는 별개)
- [x] 베타 티켓 기본 10장
- [ ] 티켓 상점 IAP (실결제)

## P2 — 채팅 · 기타

- [x] 채팅 무제한 · 7일
- [x] 양측 연락처 제안
- [ ] Palette 연동 (후순위)

## Backlog (과금·확장)

- [ ] **티켓 단가·번들 확정** (안 ≈₩4,900)
- [ ] **채팅 7일 후 티켓 연장** UX·가격
- [ ] 칩 목록 어드민 편집 UI (`interview_chips_v2`)
- [ ] 남 리텐션(빈 바다 CTA)
- [ ] 성별 역할 A/B

## P3 — 출시 · 안전

- [x] 신고 → 관리자 검토 → 영구 제명
- [x] 휴대폰 본인인증 게이트 (OTP · 운영 SMS 연동 남음)
- [ ] 커스텀 금칙어
- [ ] 프리셋 80
- [ ] appId + TestFlight
- [ ] 약관 법률 확정 · PASS 등 고도 본인인증

## Done

- [x] 숨결 레거시 제거
- [x] P0/P1 가드 + Sea + 채팅/연락처 + 보안 하드닝
