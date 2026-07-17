# 플로티(Floatie) — Head of Product 진단 리포트

> **일자:** 2026-07-17  
> **범위:** 디자인 · UX · 플로우 · 비대칭 · 카피/줄바꿈 · 데이터 정합성 · e2e  
> **방법:** PRD(`docs/PRD.md`) · Sea 이식 계획(`docs/SEA_PORT_PLAN.md`) · 라우트/RPC/마이그레이션 교차 검토  
> **e2e:** 레포에 Playwright/Cypress 등 **자동화 테스트 없음**. `SEA_PORT_PLAN`에 수동 14/14 기록은 있으나 `IMPLEMENTATION_TODO`는 미체크 — **이번 세션에서 2계정 라이브 e2e는 재실행하지 못함**(테스트 계정·시나리오 스크립트 부재).

---

## 0. 한 줄 판정

**핵심 루프(바다 홈)의 감성은 살아 있으나, PRD ↔ Sea 리디자인 ↔ 레거시 라우트가 세 갈래로 갈라져 있어 “제품 정합성”이 출시 전 최대 리스크다.**  
기능이 없어서가 아니라, **유저가 보는 규칙과 DB가 강제하는 규칙이 서로 다르다.**

| 축 | 상태 |
|----|------|
| 브랜드 UI(플로티/바다/병) | 양호 (주 홈 `/home`) |
| 핵심 서버 가드(여발송·일일1·풀·만료) | 대체로 구현됨 |
| PRD ↔ 구현 정합 | **위험** — unlock 모델이 바뀌었는데 문서·카피·레거시 UI 미갱신 |
| 단일 표면(Single surface) | **위험** — Sea + `/send` `/outbox` `/delivery` `/waiting` 공존 |
| 자동화 e2e | **없음** |
| 스토어 레디 | 미완 (IAP 스텁, 본인인증 SMS, 앱명 레거시 문서) |
| Trust & Safety UX | **위험** — 차단 INSERT UI 없음, Sea 쪽지에 신고 진입점 없음 |
| RLS / 권한 | **치명** — profiles 자기변조로 admin·티켓·인증 우회 가능 |

> 보완: [Floatie UX/flow audit](888d6c2a-08c9-4c26-966e-8b57000be756) · [Data consistency audit](f29b0a41-0ef9-4bc3-80f1-b13a57c9ffd4) 결과를 §5·§8·부록 A/B에 병합함.

---

## 1. 제품 모델 스냅샷 (현재 실제 동작)

Sea 마이그레이션(`20260717020000_sea_match.sql`) 기준 **실제 규칙**:

```text
(여) 질문 띄우기 → 랜덤 남 배달
 → (남) 발견 → 열어보기 → 수락(12h) → 답장(+선택 사진)
 → (여) 마음에 들어요(= sender OK) → unlocked_at (남에게 프로필 오픈 알림)
 → 아무나 티켓 1장으로 「매칭하고 대화 시작」→ thread (20통·7일)
```

PRD v0.3가 말하는 규칙과 **다름**:

| 규칙 | PRD | 현재 Sea DB |
|------|-----|-------------|
| Unlock | **양방향 OK** | **여자(sender) OK만**으로 unlock |
| 대화 시작 | unlock 후 조건부 채팅(과금 위치 미정) | **매칭 CTA = 티켓 1장** |
| 패스 | 양측, 14일 쿨다운 | DB는 있음 · **Sea UI에 패스 없음** |
| 사진 미션 | Phase 2 Out | Sea compose에 **사진 답변 토글 In** |

→ **SSOT가 깨진 상태.** PRD를 Sea에 맞추거나, Sea를 PRD로 되돌려야 한다. 중간은 안 된다.

---

## 2. 핵심 플로우 진단

### 2.1 여(발송) 플로우 — Sea `/home`

| 단계 | UX | 이슈 |
|------|----|------|
| FAB 「플로티 띄우기」 | 명확 | 이상형 필터 **없음** (필터는 죽은 `/send`에만) |
| compose | 양피지·프리셋칩 | 글자수 **60** (`/send`는 **40**) — 비대칭 |
| 표류 | 병 + mood | 타이머/수락 여부 홈에서 거의 안 보임 |
| 답장 도착 | glow 병 → 「마음에 들어요」 | **패스 CTA 없음** · 확인 카피가 PRD식 양방향 |
| unlock 후 | 프로필 오버레이 | 상태머신에 `match`가 안 잡혀 CTA 문구가 항상 「매칭하고…」 |
| 회수 | drift만 | 좋음 |

### 2.2 남(수행) 플로우 — Sea `/home`

| 단계 | UX | 이슈 |
|------|----|------|
| 빈 바다 | 「잔잔한…」 | **능동 CTA 없음** → 리텐션 빈약(PRD 열린 질문 #6) |
| 발견 → 확인 모달 | 닉/나이대/지역 선노출 | PRD 「unlock 전 신원 비공개」와 **충돌**(의도적 Sea 결정이나 문서 미반영) |
| 수락 | 「수락하기」 | **12h 카운트다운 UI 없음**(레거시 `/delivery`에만 있음) |
| 답장 | 텍스트+사진 | 「포기」는 **토스트만** — DB 상태·쿨다운 **미적용** |
| 답장 후 | 「내가 답장했어요」 | 상대 OK 대기. 남쪽 **패스/OK UI 없음** |
| unlock 알림 | `profile_opened` | toast 기본 분기 → deep link 약함 |

### 2.3 Unlock → 매칭 → 채팅

- Unlock 후 양쪽이 프로필을 볼 수 있음(Sea).
- `start_match`가 개시자 티켓 −1. 상점 카피와는 맞지만 PRD 「수신·답장·OK 무료」정신과는 어긋날 수 있음(매칭=과금은 Sea 결정으로 문서화는 됨).
- 채팅: 20통·7일·상호 연락처 제안 — 구현 OK.
- 스레드 헤더 「←」가 `/outbox`로 감 — **레거시로 튕김**.

### 2.4 알림 · 재발송

`NotificationToasts` / `notificationHref`가 도착·답장을 **`/delivery/$id`**(레거시)로보냄.  
Sea가 주 표면이면 **홈의 병/쪽지로 딥링크**해야 함.  
무응답 재발송은 `/waiting/$id` — 홈과 분리된 두 번째 「표류」경험.

---

## 3. 비대칭(Asymmetry) — 의도 vs 버그

| 비대칭 | 의도? | 판정 |
|--------|-------|------|
| 여만 발송 / 남만 수신 | 제품 가설 | OK (서버+클라 가드) |
| 남: 발신자 사진 없음 / 여: 답장자 **사진 포함** (`sender_card` vs `receiver_card`) | Sea 의도 | **문서·온보딩 카피와 불일치**. 여자는 패스 전에 얼굴 봄 |
| Unlock = 여 OK만 | Sea 의도 | **PRD·온보딩·confirm 카피 전부 구모델** |
| 남에게 패스 UI 없음 | 누락 | **버그/미완** — 거절 수단이 「포기(가짜)」뿐 |
| 여 compose에 필터 없음 | 누락 | 기능 orphan |
| 키 필터 vs 온보딩에 키 미수집 | 누락 | 필터 사실상 무력 |

---

## 4. 카피 · 텍스트 · 줄바꿈

### 4.1 사실과 다른 카피 (신뢰 리스크)

| 위치 | 카피 | 실제 |
|------|------|------|
| `home` confirm | 「서로 좋으면 프로필이 공개돼요」 | 여 OK만으로 공개 |
| `onboarding` 사진 | 「서로 좋다고 하기 전엔 비공개」 | 답장 시점에 여에게 남 사진 노출 |
| `delivery` | 「서로 좋다고 하기 전까지 비밀」 | Sea DB와 불일치 |
| `home` 포기 toast | 「하루 동안 새 플로티를 만날 수 없어요」 | **강제 없음** |

### 4.2 줄바꿈 · 오버플로 위험

| 요소 | 문제 |
|------|------|
| `.fl-note h3` | `overflow-wrap`/`word-break` 없음. 공백 없는 장문·이모지 연속 시 가로 넘침 가능 |
| `.fl-mood span` | pill + `inline-block`, 긴 mood 문장 시 화면 폭 초과 가능(좌우 패딩만 empty에 있음) |
| `.fl-hrow .qq` | `nowrap`+ellipsis — 이력은 OK, 본문 쪽지는 `pre-wrap`으로 양호 |
| `.fl-fab` | `white-space: nowrap` — 작은 폭/큰 글꼴에서 잘릴 수 있음 |
| 채팅 버블 | `word-break` 없음 — URL·장한글 넘침 가능 |

### 4.3 브랜드 잔재

- 앱 UI 본체: 플로티 위주 (양호).
- 루트 모바일 문서(`IOS_BUILD.md`, `MOBILE_*`): 여전히 **「결」**.
- Capacitor `server.url`: `sumgyeol.lovable.app` — 스토어 전 교체 필요.
- `.lovable/plan.md` 등 내부 계획: 레거시 허용이나 혼동 유발.

---

## 5. 데이터 정합성

### 5.1 잘 된 것

- `only female can send` — RPC + 클라
- 일일 무료 1 + 티켓 (서버)
- 활성 풀 48h→7d→30d→전역
- 수락 후 12h 만료 + trust −15
- 미수락 48h 만료(페널티 없음) + 재발송 알림
- verdict forgery 차단 (`set_delivery_verdict`)
- pass 시 pair_cooldown 14일 (DB)
- 차단/쿨다운/일일 수신 캡(8)

### 5.2 깨지거나 위험한 것

| ID | 심각도 | 이슈 | 근거 |
|----|--------|------|------|
| D0 | **P0-보안** | `profiles` UPDATE로 민감 컬럼 자기변조 | RLS에 컬럼 제한 없음 → `is_admin`/`ticket_balance`/`identity_verified_at`/`gender`/`status`/`trust_score` 조작 가능 |
| D1 | P0 | Unlock 모델 PRD≠DB≠카피 | `sea_match.sql` vs PRD §4 vs confirm 카피 · **단방향 unlock 시 남 프로필도 RLS로 여에게 노출** |
| D2 | P0 | Sea에 pass/포기 미연결 | `onGiveUp` → toast only |
| D3 | P0 | `match` 상태 미계산 | `sea.ts`가 `unlocked_at`만 보고 `opened` 반환. thread 존재 여부 미조회 |
| D4 | P1 | 일일 리셋 시차 | 서버 `date_trunc('day', now())`≈UTC, 클라 `setHours(0,0,0,0)`=로컬 |
| D5 | P1 | `mission_threads` 직접 INSERT로 티켓 우회 | `start_match`와 별개로 옛 INSERT 정책 생존 |
| D6 | P1 | `mission_messages` RLS가 20통/`closed_at` 미강제 | RPC만 캡 체크 → 직접 INSERT 우회 |
| D7 | P1 | 차단 후에도 기존 스레드 메시지 가능 | `send_mission_message`에 blocks 미검사 |
| D8 | P1 | Storage RLS vs Sea 사진 경로 | `photos[]`/`reply_photo`가 answers 버킷 예외와 불일치 가능 |
| D9 | P1 | `gender=other`(수정 화면) | 발송도 수신도 안 됨 |
| D10 | P1 | height 필터 | 온보딩에 `height_cm` 없음 |
| D11 | P2 | 일일 발송/수신 캡 동시성 레이스 | `deliver_mission` count에 lock 없음 |
| D12 | P2 | expire는 lazy(읽기 시) | 스케줄러 없음 |
| D13 | P2 | `missions` INSERT에 성별 가드 없음 | deliver RPC만 막음 → 고아 row |
| D14 | P2 | 프리셋 80 미달 · trust UI 비노출 | TODO 미완 |

### 5.3 상태머신 (Sea 프론트)

```text
woman: drift → replied → opened → (match: 코드상 정의만, 미사용) → expired/done
man:   arrived → answered → opened → (match 미사용) → expired
```

`start_match` 후 `status='closed'`여도 `unlocked_at`이 있어 **opened로 남음**.  
바다에서 「매칭된 병」시각 차별이 없고, CTA는 중복 탭 시 idempotent 반환이라 동작은 되나 **인지 UX는 깨짐**.

---

## 6. 디자인 · UX 품질

**강점**

- 바다 + 병 + 양피지 쪽지: 한 화면 한 목적, 브랜드 신호 강함.
- 탭바 제거 후 몰입도↑.
- Empty / mood / FAB 역할 분리 명확(여).

**약점**

- 레거시 list UI(`/send`,`/outbox`,`/delivery`)가 알림·스레드에서 재진입 → **디자인 시스템 분열**.
- 병 위치 `id` 해시 — 다수 시 **겹침·화면 밖**.
- 티켓 상점: 결제 스텁 toast — 베타 OK, 스토어 전 차단 필요.
- 이모지 toast 다수 — 톤은 따뜻하나 일부 시스템 폰트에서 줄 높이 어색할 수 있음.

---

## 7. e2e 현황

| 항목 | 결과 |
|------|------|
| 자동화 스위트 | **없음** (`package.json` scripts에 test/e2e 없음) |
| 문서상 수동 e2e | `SEA_PORT_PLAN.md`: 14/14 통과 기록 (2026-07-17) |
| `IMPLEMENTATION_TODO` | 「여/남 2계정 E2E 수동 테스트」 **미체크** — 문서 간 불일치 |
| 이번 세션 | 코드·스키마 정적 전수 진단. **라이브 2계정 루프 재실행 불가** |

**권장 최소 e2e 체크리스트 (수동 재검증용)**

1. 여 온보딩 → 홈 FAB → 띄우기 → 병 drift  
2. 남 온보딩 → 병 arrived → 신원카드(사진X) → 수락 → 12h UI(현재 부재 확인) → 답장  
3. 여: 답장자 카드(사진O) → 마음에 들어요 → unlock  
4. 카피 「서로 좋으면」이 뜨는지(회귀)  
5. 남: profile_opened 알림 → 홈에서 프로필 → 매칭(티켓−1) → 스레드  
6. 여: 같은 스레드 진입, 20통/7일 카피  
7. 패스/포기: Sea에서 불가능·가짜인지 확인  
8. 알림 「열기」가 `/delivery`로 가는지 확인  
9. 자정 전후 무료 1회(UTC vs KST)  
10. 회수 / 미수락 48h / 수락 후 12h 만료+trust  

---

## 8. 우선순위 개선안

### P0 — 출시 전 반드시 (보안 → 정합성 → UX)

1. **`profiles` 컬럼 락다운 (최우선):** `is_admin`/`status`/`trust_score`/`ticket_balance`/`identity_verified_at`/`last_active_at`(·가입 후 `gender`)를 직접 UPDATE 불가하게 REVOKE/WITH CHECK, 변경은 SECURITY DEFINER RPC만.  
2. **SSOT 확정:** Unlock = (A) 양방향 OK 복원 **또는** (B) Sea 단방향 채택 후 PRD·카피·온보딩 전면 수정.  
3. **레거시 라우트 정리:** `/send` `/outbox` `/delivery` `/waiting` → Sea deep link 통일.  
4. **Sea에 패스 + 진짜 포기** + 허위 「하루 금지」토스트 제거.  
5. **상태머신:** thread 있으면 `match` · CTA 「대화 이어가기」.  
6. **차단 UI + 신고(Sea 쪽지)** + 차단 시 스레드 `closed_at` / `send_mission_message` blocks 가드.  
7. **RLS 우회 차단:** `mission_threads` INSERT revoke( `start_match` 전용) · `mission_messages`에 cap/`closed_at` 강제 또는 INSERT revoke.

### P1 — 루프·신뢰 · 스토리지

8. Storage RLS를 Sea `photos[]`/`reply_photo` 경로에 맞춤(회귀 테스트).  
9. 일일 캡 **Asia/Seoul** + advisory lock(동시성).  
10. Sea compose 이상형 1개 + `height_cm`(또는 필터 제거).  
11. 12h 카운트다운을 쪽지에 표시(+ trust 경고).  
12. 글자수 40/60 단일화 · `gender=other` 제거/경고.  
13. 스레드 back → `/home`.  
14. 프로필 편집 `bio`/`ai_intro` 단일화.  
15. 홈 mutation 한국어 에러 매핑.  
16. 자동화 e2e(여·남 스모크 + 사진 signed URL + 티켓 우회 시도 부정).

### P2 — 폴리시

13. mood/h3/채팅 `overflow-wrap: anywhere`.  
14. 병 충돌 회피 레이아웃.  
15. trust_score 가벼운 노출(또는 페널티 카피만).  
16. 모바일 문서·appId·Capacitor URL 플로티화.  
17. 프리셋 80 · 금칙어 · IAP.

### P3 — 전략

18. 남 리텐션(발견 전 도파민: 오늘의 파도, 신뢰 회복 미션 등).  
19. 성별 역할 A/B.  
20. 매칭 티켓 과금 가격 감수성 테스트.

---

## 9. “지금 고쳐야 할 문장” 초안 (B안: Sea 단방향 채택 시)

| 위치 | Before | After |
|------|--------|-------|
| 마음에 들어요 confirm | 서로 좋으면 프로필이 공개 | 마음을 전하면 **내 프로필이 상대에게 열려요**. 대화는 티켓으로 시작할 수 있어요. |
| 온보딩 사진 | 서로 좋다고 하기 전엔 비공개 | unlock 전엔 남에게 사진이 안 보여요. 답장이 오면 상대(여)에게는 사진이 보일 수 있어요. |
| 포기 | 하루 동안 새 플로티… | (삭제) 또는 「이 플로티만 접어요. 페널티는 없어요.」 |

---

## 10. 결론

플로티는 **감정용 코어 루프의 뼈대와 비주얼 방향은 출시 후보**다.  
다만 Head of Product + 보안 기준으로는:

1. **`profiles` RLS가 민감 컬럼을 열어 두어** 본인인증·관리자·과금 전제가 한 번에 깨질 수 있고,  
2. **규칙의 단일 진실**이 없으며(PRD↔Sea↔카피),  
3. **주 표면과 알림/레거시**가 유저를 다른 UX로 끌어가며,  
4. **거절·차단·신고·타이머** 같은 신뢰 장치가 UI·RLS에서 빠지거나 우회된다.

다음 작업은 기능 추가가 아니라 **(1) profiles 락다운 → (2) 결제/캡 RLS → (3) 플로우 SSOT** 순이다.

---

---

## 부록 A — UX 전수 ([Floatie UX/flow audit](888d6c2a-08c9-4c26-966e-8b57000be756))

| sev | 이슈 | 근거 |
|-----|------|------|
| P0 | `blocks` INSERT 클라 경로 전무 | `blocks.ts`·`me.blocked`는 조회/해제만 |
| P0 | 매칭 전 쪽지에 신고 없음 | `ReportDialog` = delivery/thread only |
| P1 | 프로필 `bio` vs `ai_intro` 이원 편집 | 수정해도 Sea/unlock 카드 불변 |
| P1 | 「내 프로필」오버레이 vs `/me` 이중 화면 | 톤·필드 불일치, handle 미수집 |
| P1 | 홈 toast에 영문 RPC 에러 노출 | `onError`가 `e.message` 직출 |
| P2 | 채팅 20·7일을 확정 약속처럼 노출 | PRD §8은 아직 「조건 설계 필요」 |
| P2 | FAB `nowrap` 작은 화면/큰 글씨 잘림 | `sea.css` `.fl-fab` |
| P3 | 온보딩 「여자/남자」 vs 수정 「여성/남성」 | 라벨 격식 불일치 |

## 부록 B — 데이터/RLS ([Data consistency audit](f29b0a41-0ef9-4bc3-80f1-b13a57c9ffd4))

| sev | 이슈 | 제안 |
|-----|------|------|
| **P0** | profiles 자기 UPDATE → admin/티켓/인증/밴/성별 우회 | 민감 컬럼 REVOKE + DEFINER RPC만 |
| P0 | 여 OK만 unlock + peer 프로필 양방향 RLS 노출 | PRD 갱신 또는 남 동의 스텝 |
| P1 | threads 직접 INSERT → 매칭 티켓 우회 | INSERT revoke, `start_match`만 |
| P1 | messages RLS에 cap/closed 없음 | RLS 보강 또는 INSERT revoke |
| P1 | 차단 ≠ 채팅 차단 | send RPC + thread close |
| P1 | Storage RLS vs photo/reply 경로 | EXISTS 정책 추가, signed URL 회귀 |
| P2 | 일일 캡·메시지 캡 레이스 | advisory lock |
| P3 | PRD v0.3 미갱신 · `dev_otp_enabled` 기본 true | PRD v0.4 · prod assert |

**수정 순서 권고(감사 합의):** D0 profiles 락다운 → threads/messages RLS → Unlock SSOT·문서 → Sea 안전 UI.

*관련:* [`PRD.md`](./PRD.md) · [`SEA_PORT_PLAN.md`](./SEA_PORT_PLAN.md) · [`IMPLEMENTATION_TODO.md`](./IMPLEMENTATION_TODO.md) · [`TRUST_AND_SAFETY.md`](./TRUST_AND_SAFETY.md)
