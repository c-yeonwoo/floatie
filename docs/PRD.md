# 익명 미션 앱 — Product Requirements Document

> **작업 레포:** `~/dev-private/sumgyeol` (`c-yeonwoo/sumgyeol`)  
> **한 줄:** 익명 미션/질문에 답하고, 서로 OK하면 프로필이 열리는 라이트 소셜.  
> **상태:** PRD v0.2 · 2026-07-14  
> **브랜드:** 미확정. 표시용 임시 이름 **쪽지** (숨결/결 폐기). 로고·색·최종명은 루프 검증 후.  
> Palette 등과 **무관·비연동**.

---

## 0. 한 줄 정의

**익명의 누군가가 보낸 가벼운 미션/질문에 답하고, 서로 “괜찮았다(OK)”고 인정하면 그때 프로필이 열리는 설렘형 라이트 소셜 앱.**

---

## 1. 포지셔닝

### 카테고리: **라이트 소셜 / 설렘** (데이팅 앱 아님)

| 축 | 결정 |
|----|------|
| 스토어 | Social Networking |
| 카피 | “데이트·연애·매칭·이상형” 금지. “설렘·미션·쪽지·서로 알아가기” |
| KPI | 미션 완료 · 양방향 OK · 재방문 (매칭 성사 아님) |

→ [`decisions/0001-category-light-social.md`](./decisions/0001-category-light-social.md)

---

## 2. 이름 · 브랜드 — 열어둠 + 임시 표시명

| 구분 | 값 |
|------|-----|
| 레포/폴더 | `sumgyeol` 유지 (GitHub rename은 나중에) |
| **임시 표시 이름** | **쪽지** |
| 폐기 | 숨결, 결, gyeol, sumgyeol을 유저-facing에 쓰지 않음 |
| 최종 브랜드 | 기능 정체성 보인 뒤 네이밍 세션 |
| 번들 ID | 스토어 제출 전 `app.gyeol.client` → 새 ID로 교체 (임시 후보: `app.jjokji.client`) |

대안 가칭 (나중에 골라보기): 보틀노트, 드리프트, OK쪽지, 미션쪽지.

스토어 카피 골격: [`store/APP_STORE_COPY.md`](./store/APP_STORE_COPY.md) (이름만 쪽지로 치환해 사용).

---

## 3. 핵심 루프 (MVP)

```text
작성 → 익명 전달 → 수행/답장 → 발신자 OK|패스 → (양방향 OK) unlock → (선택) 짧은 대화
```

| 규칙 | MVP |
|------|-----|
| Unlock 전 | 미션+답장만. 닉네임·얼굴·스펙 비공개 (성별·연령대 힌트만 옵트인) |
| OK | **양방향**일 때만 미니 프로필 공개 |
| 패스 | 페널티 없음. 동일 쌍 14일 쿨다운 |
| 미응답 | 48h 만료 |
| 답장 형식 | 텍스트·칩. 사진은 Phase 2 |

---

## 4. 매칭: 약한 fit

하드: 18+, 성별 선호, 차단, 동일 쌍 쿨다운 14일, 일일 수신 캡 8.  
소프트: 지역 → 연령대 → 활성 → 성비 큐.  
딥 ML fit / 장소 집합 미션: Out.

→ [`decisions/0002-matching-weak-fit.md`](./decisions/0002-matching-weak-fit.md)

---

## 5. Unlock 후 UX

인앱 텍스트 스레드 **7일 soft expiry** + 외부 연락은 **양측 동의** 시에만.

→ [`decisions/0003-unlock-ephemeral-chat.md`](./decisions/0003-unlock-ephemeral-chat.md)

---

## 6. 수익화

MVP **완전 무료**. Phase 1.5 송신 부스터만. 수신·OK·unlock 유료화 금지.

→ [`decisions/0004-monetization-after-retention.md`](./decisions/0004-monetization-after-retention.md)

---

## 7. MVP In / Out

**In:** 가입(소셜/이메일), 최소 프로필, 미션 송수신(텍스트·칩), 양방향 OK→unlock, 인앱 짧은 채팅, 차단·신고, 일일 캡, 안전 센터.

**Out:** 숨결식 공개 피드·팔로우·AI 결, 지인망/주선, 장소 집합, 사진 미션, 유료·광고, 영구 메신저.

---

## 8. 미션

런칭 프리셋 **80** (질문 50 · 행동인증 30). 톤 가이드: [`missions/PRESET_GUIDE.md`](./missions/PRESET_GUIDE.md).

---

## 9. 안전

프리셋 화이트리스트 + 커스텀 필터·신고, 사진 Phase 2, 쿨다운·수신 캡·성비 가드, 18+, 안전 센터.  
→ [`TRUST_AND_SAFETY.md`](./TRUST_AND_SAFETY.md)

---

## 10. 레포 · 스택 (확정)

**숨결 골격 위에서 제품을 갈아끼운다.**

| 층 | 선택 |
|----|------|
| 레포 | `sumgyeol` |
| DB/Auth/Storage | **Supabase** |
| UI | React + TanStack + Tailwind (기존) |
| 모바일 | **Capacitor** (기존 ios/android) |
| 백엔드 | Nest 없음. Supabase (+ server functions) |

→ [`decisions/0005-stack-supabase-capacitor.md`](./decisions/0005-stack-supabase-capacitor.md)

**구현 원칙:** 피드/팔로우/AI/유사도는 삭제 또는 라우트 비활성. `blocks`/`reports`/auth/image/Capacitor는 유지. 신규 도메인: missions · deliveries · oks · unlocks · threads.

---

## 11. 성공 지표 (가설, 4주)

D1/D7 ≥35%/15% · 수신→답장 ≥55% · 답장→OK ≥40% · 양방향 unlock ≥25% · 신고율 ≤0.5%.  
북극성: **주간 양방향 OK 수**.

---

## 12. 페이즈

| Phase | 범위 |
|-------|------|
| MVP | 위 In |
| 1.5 | 송신 부스터, 프리셋 운영 |
| 2 | 사진 미션 |
| 3 | 시즌·약한 취향 태그 (선택) |

---

## 13. 다음 액션

1. ~~유저-facing 카피에서 숨결/결 제거 → 임시명 쪽지~~ (탭·온보딩·메타·Capacitor 표시명)
2. ~~Supabase 미션 스키마 마이그레이션 초안~~ → **원격 DB에 `db push` 필요** (`docs/APPLY_MIGRATION.md`)
3. ~~라우트: 수신→답장→OK→unlock 최소 플로우~~ (home/send/outbox/delivery/thread)
4. 웹에서 2계정으로 루프 검증 → Capacitor TestFlight
5. (여유) 최종 네이밍 + bundle id 교체 · 구 피드/AI 라우트 삭제 · 프리셋 80개 확장

---

## 결정 요약

| # | 결정 |
|---|------|
| 카테고리 | 라이트 소셜/설렘 |
| 이름 | 임시 **쪽지**, 브랜드 후정 |
| 매칭 | 약한 fit |
| unlock 후 | 인앱 7일 + 선택 연락 |
| 수익화 | MVP 무료 |
| 스택 | **sumgyeol + Supabase + Capacitor** |
| 프리셋 | 80 + 톤 가이드 |
