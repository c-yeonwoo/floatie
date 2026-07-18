# 구현 TODO — 플로티 (PRD v0.4 + 동시성/재배달)

> 로드맵·포지션: [`ROADMAP.md`](./ROADMAP.md) · [`POSITIONING_TOBE.md`](./POSITIONING_TOBE.md) · [`BETA_OPS.md`](./BETA_OPS.md)  
> **Next epic:** 남 1슬롯 · 여 병렬 채팅 · 패스 자동재배달 · Chat-first 홈

---

## 제품 규칙 (이번 라운드 확정안)

### 남 — 동시에 1명만

| 상태 | 수신/매칭 |
|------|-----------|
| 플로티 **수행 중** (수락·미답장, 12h 타이머) | 새 플로티 수신 제외 |
| **유효 채팅** (`mission_threads`: `closed_at` null · `expires_at` > now) | 새 플로티 수신 제외 · 추가 매칭 불가 |
| 열기 전 패스 | 노패널티 · 해당 미션은 **자동 재배달** |

### 여 — 플로티 수만큼 병렬 채팅 · 채팅 중 발송 잠금

| 상태 | 발송 · 매칭 |
|------|-------------|
| 활성 채팅 **없음** | 띄운 플로티 수만큼 unlock→매칭 가능 |
| 활성 채팅 **1개 이상** | **추가 플로티 띄우기 금지** (모든 활성 채팅 종료/`expires`/`closed`까지) |
| 이미 표류·답장·unlock된 병 | 진행·매칭 **계속 가능** → **병렬 채팅 허용** (상한 = 채팅 잠금 전에 띄운 플로티 수) |

> **확정 (2026-07-18):** 여자는 플로티 수만큼 **병렬 채팅 OK**. 남자만 동시 1슬롯.  
> UI: Chat-first 홈은 **스레드 리스트/전환** 필요 (단일 스레드 풀스크린만으로는 부족).

### 패스 → 자동 재배달 → 48h 회수

```text
(여) 띄움 → delivery #1
  (남) 열기 전 패스
    → hop+1 · 다른 남에게 자동 재배달 · 여 in-app 「다른 사람에게 떠내려갔어요」
  … (최대 N hop 또는 풀 고갈)
  최초 띄움 시각 기준 48h 동안 수락(accepted_at) 없음
    → 자동 회수(expired/recalled) · 여 「다시 써볼까요?」 CTA (본문 재작성 유도)
```

| 파라미터 | 권장 기본 |
|----------|-----------|
| 자동 재배달 상한 **N** | **5** (그 전 풀 고갈이면 즉시 회수+재작성) |
| 미수락 벽시계 | **48h** from `missions.created_at` (또는 first delivery) |
| 재배달 시 티켓/일일무료 | **추가 차감 없음** (같은 미션의 hop) |
| 패스 페어 쿨다운 | 유지 14일 (그 남에게 다시 안 감) |

---

## Epic A — 동시성 · 풀 · 재배달 (P0 · 서버 먼저)

### A0. 스펙 고정 (반나절)

- [x] ADR: `docs/decisions/0010-concurrency-and-redeploy.md`
  - N=5 · 48h · **여 병렬 채팅(플로티 수)** · 남 수행중/채팅중 제외
  - 알림 kind: `mission_redeployed` · `mission_no_response`+`can_rewrite`
- [x] PRD §4·§6 루프/풀 문단 갱신

### A1. 스키마 · RPC

- [x] `missions.redeploy_count` · partial unique active delivery
- [x] `decline_delivery` → pass + 자동 hop + 여 `mission_redeployed`
- [x] `expire_stale_deliveries` 미션 단위 48h + `can_rewrite`
- [x] `_pick_male_receiver` 슬롯 제외 (수행/채팅/기수신)
- [x] `deliver_mission` 여 `chat_active_no_new_floatie`
- [x] `start_match` 남 `already_in_chat` · 여 병렬 OK
- [ ] pg_cron / Edge cron: expire 서버 주기 (후속 — 클라는 withExpiry 유지)

### A2. 클라이언트 · 카피

- [x] 재배달 토스트 · 회수 후 다시 쓰기 시트(프리필)
- [x] 여: 채팅 중 FAB 잠금
- [ ] 남: 수행중/채팅중 풀 제외 E2E 확인
- [ ] analytics 이벤트 보강 (후속)

### A3. 테스트

- [ ] SQL/RPC 단위 · `e2e-beta.mjs` 패스 체인 (후속)

---

## Epic B — 채팅 포커스 홈 (P0/P1 · 디자인→구현)

> “채팅 시작하면 메인 화면이 채팅 위주” — **페이지 재설계 필요**. Sea는 비활성/대기 모드로 축소.

### B0. 디자인 스파이크

- [ ] `/home` 두 모드 와이어:
  1. **Sea 모드** — 활성 채팅 없음 (병·표류)
  2. **Chat 모드** — 활성 thread **N개**(여 병렬) / 남은 보통 1
- [ ] Chat 모드: 스레드 전환(칩/리스트) + 선택 스레드 대화면 · 남은 일수 · 입력
- [ ] (접힌) 바다·진행 중 병·unlock 대기 진입
- [ ] 마지막 채팅 종료/만료 → Sea 모드 복귀 모션
- [ ] 브랜드·Sea 톤 유지 (카드 대시보드화 금지)

### B1. 구현

- [ ] `home` 라우트: `activeThreads.length > 0` 이면 Chat-first
- [ ] 여: 멀티 스레드 전환 UI · 남: 단일(동일 셸)
- [ ] 기존 `/thread/$id` deep link → 홈 Chat 모드와 동일 셸
- [ ] unlock 대기: Chat 모드 슬림 칩 → 오버레이
- [ ] 7일 만료·종료 UX를 Chat 모드에 이식

---

## Epic C — 문서 · 출시 정합 (병행)

- [ ] `ROADMAP.md` Next에 Epic A/B 반영
- [ ] `BETA_OPS.md` 시나리오: 패스재배달 · 채팅중 발송잠금 · 남 1슬롯
- [ ] 스토어/TRUST: 남은 「한 번에 한 사람」· 여 「여러 플로티→여러 대화」 톤 정리
- [ ] ADR 0002 supersede 노트 (풀 제외 확장)

---

## 기존 백로그 (유지)

### P0 잔여

- [ ] 원격 DB 마이그레이션 적용 확인
- [ ] 여/남 2계정 E2E 수동 (`BETA_OPS.md`)

### P1

- [ ] FCM_SERVER_KEY 실통
- [ ] 프리셋 DB 큐레이션 40→80
- [ ] 티켓 상점 IAP
- [ ] (후) soft prompt · 칩 어드민

### P2 / Later

- [ ] TestFlight · 본인인증 · 금칙어
- [ ] 채팅 티켓 연장
- [ ] Palette · 닮은 연예인 · 성별 역할 A/B

---

## 권장 작업 순서

```text
A0 스펙 사인오프
  → A1 RPC/가드 (동시성+재배달) + cron
  → A2 알림·재작성 UX
  → A3 E2E
  → B0 디자인 (Chat-first 홈)
  → B1 홈 셸 전환
  → C 문서·스토어 카피
```

**추정:** A 서버+가드 2–4일 · A 클라/알림 1–2일 · B 디자인 1–2일 · B 구현 2–3일 (겹치면 약 1주+).

---

## Done (참고)

- [x] Sea 핵심 루프 · 레거시 redirect · 12h/24h 밴 · 닉 숨김 · analytics · dispatch-push
- [x] 활성 풀 48h→7d→30d→전역 (제외 규칙 **미흡** → Epic A에서 보강)
- [x] 채팅 무제한·7일 (동시 1슬롯 **미흡** → Epic A)
