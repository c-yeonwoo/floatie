# 플로티 — 로드맵 (MVP → Open)

> 2026-07-18 · [`POSITIONING_TOBE.md`](./POSITIONING_TOBE.md) · [`MVP_DEPLOY.md`](./MVP_DEPLOY.md)  
> 원칙: **루프 감정 극대화 → 공급(성비) → 학습 → 과금 → 확장**

---

## Now — Web MVP deploy

| 항목 | 상태 |
|------|------|
| Sea 핵심 루프 | Done |
| 동시성 · 패스 재배달 · 발송 잠금 (#18) | Done |
| Pages CI (`main` → floatie.pages.dev) | Done (검증 중) |
| Capacitor `server.url` → Pages | Done (이 PR) |
| MVP Go/No-Go 체크리스트 | [`MVP_DEPLOY.md`](./MVP_DEPLOY.md) |
| expire-stale Edge + cron | 배포·스케줄 필요 |
| 초대 스모크 · OTP 정책 | 운영 |

**운영:** [`BETA_OPS.md`](./BETA_OPS.md) · Auth redirect · 신고 담당.

**베타 성공 기준 (2주):** 주간 unlock · 여 D1 · 빈바다 불만 감소.

---

## Next — Learn + Soft open

1. Chat-first 홈 (Epic B — 디자인 후)  
2. FCM 실통 · expire cron 안정화  
3. 프리셋 큐레이션 40→80  
4. TestFlight · app 아이콘 · 약관  
5. `dev_otp` off · SMS/PASS  
6. 빈바다 후속: 데일리 「오늘의 한 줄」 성향 칩 · 이상형 미니 퀴즈 · 지난 패스/표류 회고 (프로필 넛지 1차 이후)  

---

## Then — Public / IAP

| 테마 | 항목 |
|------|------|
| 과금 | 티켓 단가 확정(UI) · IAP · grant 2장 |
| 채팅 | 7일 만료 연출 · **티켓 연장**(미구현·백로그) |
| 안전 | 커스텀 금칙어 · 신고 SLA |

---

## Later

- 닮은 연예인 AI · MBTI 메타 · 칩 어드민 · Palette · 성별 역할 A/B  

## Explicitly out

- 공개 피드 · 팔로우 · 좋아요 · 이상형 발송 필터 · 영구 채팅앱 · Dating 카테고리 피벗  

---

```text
Web MVP ──학습──► Soft open ──IAP──► Public
   │                 │                 │
   초대·스모크        TestFlight·인증     과금·확장
```
