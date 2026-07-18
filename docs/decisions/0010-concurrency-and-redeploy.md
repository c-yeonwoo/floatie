# ADR 0010 — 동시성 · 패스 자동재배달 · 미수락 회수

- Status: Accepted
- Date: 2026-07-18
- Relates: [`0002-matching-weak-fit.md`](./0002-matching-weak-fit.md)

## Context

1. 열기 전 패스 시 플로티가 `closed`만 되고 다른 남에게 안 가면, 여의 일일 무료 1회가 낭비된다.
2. 풀이 “활성 남”만 보면 이미 수행 중·채팅 중인 남에게 또 떨어져 동시 멀티 매칭이 난다.
3. 제품 규칙: **남 동시 1슬롯** · **여 플로티 수만큼 병렬 채팅** · 활성 채팅 중 여 **신규 플로티 잠금**.

## Decision

### 남 슬롯

수신·매칭 후보에서 제외:

- `mission_deliveries` status ∈ (`delivered`,`replied`) 인 수신 건 (수행·대기 중)
- 유효 `mission_threads` (`closed_at` null · `expires_at` > now()) 참여자

`start_match`: 남이 이미 유효 스레드가 있으면 거부 (`already_in_chat`).

### 여

- 유효 스레드가 **하나라도** 있으면 `deliver_mission` 신규 발송 거부 (`chat_active_no_new_floatie`)
- `start_match`는 병렬 허용 (플로티 수만큼)

### 패스 → 자동 재배달

- 열기 전 `decline_delivery` → pass/쿨다운 후 **같은 mission**에 새 delivery (티켓·일일무료 추가 차감 없음)
- `missions.redeploy_count` 증가 · 상한 **5**
- 여 알림 `mission_redeployed`
- hop 불가(상한·풀 고갈·미션 나이 ≥ 48h) → `mission_no_response` + `can_rewrite`

### 미수락 48h

- 벽시계: `missions.created_at` 기준 48h
- 그 사이 어떤 delivery도 `accepted_at` 없으면 활성 delivery expire + 여 재작성 유도
- 미션당 활성 delivery는 최대 1 (`UNIQUE … WHERE status IN ('delivered','replied')`)

## Consequences

- Chat-first 홈은 여 멀티 스레드 전환 UI 필요 (Epic B)
- expire는 클라 `withExpiry` + (후속) 서버 cron
