# 플로티 — 로드맵 (MVP → Open)

> 2026-07-18 · [`POSITIONING_TOBE.md`](./POSITIONING_TOBE.md)와 함께 읽기  
> 원칙: **루프 감정 극대화 → 공급(성비) → 학습 → 과금 → 확장**

---

## Now — Closed beta (초대)

| 항목 | 상태 |
|------|------|
| Sea 핵심 루프 | Done |
| 레거시 라우트 → `/home` | Done |
| 병 12h 타이머 · 남 빈바다 CTA · 여 표류 카피 | Done |
| 열기 전 닉 숨김 (나이대·지역만) | Done |
| 퍼널 이벤트 `analytics_events` | Done |
| 푸시 Edge `dispatch-push` (FCM 키 선택) | Done · 키 없으면 in-app |
| 스토어 카피 PRD v0.4 정합 | Done |

**운영 체크:** [`BETA_OPS.md`](./BETA_OPS.md) — E2E · OTP · 성비 · 신고 수동.

**베타 성공 기준 (2주):** 주간 unlock 합의치 · 여 D1 · 빈바다 불만 qualitative 감소.

---

## Next — Concurrency + Chat-first (우선)

상세: [`IMPLEMENTATION_TODO.md`](./IMPLEMENTATION_TODO.md) Epic A/B

1. **동시성** — 남: 수행중·유효채팅 중 수신/매칭 제외(1슬롯) · 여: 플로티 수만큼 병렬 채팅 · 활성채팅 중 신규 플로티 잠금  
2. **패스 자동재배달** — hop≤5 · 여 알림 · 48h 미수락 시 회수+재작성  
3. **풀 제외 보강** + expire **서버 cron**  
4. **Chat-first 홈** 디자인→구현 (채팅 시작 시 Sea 축소)  
5. (병행) 퍼널 리포트 · FCM 실통 · 프리셋 큐레이션

---

## Then — Soft open / TestFlight

| 테마 | 항목 |
|------|------|
| 출시 | appId · 아이콘 polish · TestFlight · 약관 법률 확정 |
| 본인인증 | `dev_otp` off · SMS/PASS |
| 안전 | 커스텀 금칙어 · 신고 SLA |
| 과금 준비 | 티켓 단가·번들 확정 · IAP 샌드박스 |
| 채팅 | 7일 만료 연출 · (옵션) 티켓 연장 |

가입 티켓: 오픈 시 `ticket_grant_mode` → 2장.

---

## Later — Differentiation polish

- 닮은 연예인 AI (옵트인)  
- MBTI 메타 한 줄 (필터 금지)  
- 칩 어드민 UI  
- Palette 연동 (후순위)  
- 성별 역할 A/B (데이터 있을 때만)

---

## Explicitly out (당분간)

- 공개 피드 · 팔로우 · 좋아요  
- 이상형 **발송 필터**  
- 영구/무기한 채팅앱  
- Dating 스토어 카테고리 피벗 (의도적 결정 전)

---

## 마일스톤 요약

```text
Closed beta ──학습──► Soft open ──IAP──► Public
   │                    │                 │
   unlock·D1            푸시·인증·약관      과금·확장 실험
```
