# 바다(Sea) 리디자인 실앱 이식 — 단계별 계획

> 프로토타입(`scratchpad/floatie_sea_prototype.html`, artifact 808739ec) → 실제 앱(`src/`) 이식.
> 원칙: 백엔드 골격(auth·profiles·mission_deliveries·threads·notifications·push·storage)은 재사용, 프론트 재구성 + 스키마 보강 중심. 브랜치 작업, 머지 전 사용자 확인.

## 컨셉 요약 (프로토타입 확정본)
- 하단 탭바 제거 → 전체화면 **바다**, 보낸/받은 플로티가 **떠다니는 병**
- **쪽지(양피지)** = 플로티를 읽고/쓰는 단일 표면 (compose/read/reply-view/history 상세 모두 쪽지)
- 상태 기반 액션: drift(회수) → replied(마음에 들어요) → opened(상대 프로필 보기) → match(대화)
- 여자가 프로필 열기 → 남자쪽 **알림 + 프로필 잠금해제**
- 프로필: 아쿠아 카드 UI(쪽지와 다름), **AI가 소개문 생성** (질문 답변 기반)
- 온보딩: 단계별(닉네임→생년/성별→지역→사진 3장 필수→질문 3개→AI 생성→리뷰)
- 프로필 수정: 인터뷰 아님 → 섹션 편집 + **AI 재생성(하루 2회)**
- 상단 아바타 드롭다운: 내 프로필 / 플로티 이력 / 티켓 상점 / 설정 / 로그아웃

## 단계 (각 단계 = 독립 커밋, 검증 후 다음)

### Stage 1 — 스키마 보강 (migration) — ✅ 파일 작성 (remote push 보류)
- `20260717000000_profile_ai_sea.sql`: profiles + `photos[]`·`intro_answers`·`ai_intro`·`ai_tags`·`intro_regen_date`·`intro_regen_count`, `regenerate_intro(intro,tags)` RPC(하루 2회 서버 강제)
- 사진은 **기존 `answers` 버킷 재사용** (StorageImg 통합) — 새 버킷 불필요
- 티켓: `profiles.ticket_balance`(기본 5) 이미 존재 — 재사용
- ⚠️ remote `db push`는 사용자 확인 후 (additive라 저위험이나 live 변경)

### 발견된 백엔드 모델 변경점 (해당 스테이지에서 마이그레이션으로)
- **매칭=과금** [결정됨]: 상호 OK → 프로필 오픈(스레드 X). `trg_mission_try_unlock`에서 스레드 자동생성 제거하고 `unlocked_at`만 세팅. 새 `start_match(delivery_id)` RPC = **매칭 누른 쪽 ticket_balance -1 → mission_threads 생성**. (Stage 7)
- **신원 선노출**: 남자가 열기 전 발신자 닉/나이/지역 노출. 현재 RLS는 unlock 후에만. delivered 상태 receiver에게 제한 필드(display_name·birth_year·region, 사진 X) 노출 RPC/뷰. (Stage 6)
- **사진 peer 열람**: `answers` 버킷 signed URL — unlock 후 상대 사진 열람 정책. (Stage 6/7)

### 운영 결정 [사용자 확인됨]
- DB 마이그레이션은 **마지막에 일괄 remote push + 머지 확인**. 그 전까지 브랜치에서 파일로만.
- 매칭 결제: 먼저 누른 쪽 티켓 1장.

### Stage 2 — 디자인 토큰 & 공용 컴포넌트 — ✅ (119fa1f)
- `src/styles/sea.css` (fl- 네임스페이스) + styles.css import
- SeaWaves, IdentityCard, ConfirmModal

### Stage 3 — 온보딩 스텝퍼 + AI 생성 — ✅ (9ababb4)
- onboarding 스텝퍼 재작성, 사진 3장 업로드(answers 버킷)
- lib/profile-ai.ts + Edge Function generate-profile(Claude Haiku, 템플릿 폴백)

### Stage 4 — 여자 바다 홈 + 탭바 제거 — ✅ (bdfcc76)
- 탭바 제거(full-bleed home/onboarding), 바다 홈(병+mood+FAB+아바타메뉴), ParchmentNote(compose/floatie)+AvatarMenu, lib/sea.ts
- FAB→createAndDeliverMission 연결. 아바타 메뉴 항목은 임시로 기존 라우트(/me,/outbox)로 (Stage 7/8에서 교체)

### Stage 5–6 — 쪽지 흐름 + 남자 바다 — ✅ (bdf47d6)
- 마이그레이션 20260717010000_sea_flow: recall / sender_card·receiver_card(비대칭) / photo_answer / reply_photo / set_reply_photo
- ParchmentNote read/reply 모드, 남자 발견→읽기→수락→답장(+사진), 여자 답장확인→마음에들어요, 회수, 사진답변 토글

### Stage 7 — 프로필 + 양방향 잠금해제 + 매칭 — ✅ (468f78f)
- 마이그레이션 20260717020000_sea_match: unlock=여자OK시 오픈+남자알림(스레드 자동생성 제거), start_match(티켓1장→thread), profile_opened/matched 알림
- ProfileOverlay(아쿠아), verdict→프로필 직행, opened/match→상대 프로필→매칭 CTA→thread

### Stage 8 — 이력·상점·수정 — ✅ (7922f4a)
- 플로티 이력 오버레이(상태 pill + 드릴다운), 티켓 상점 오버레이, 내 프로필/수정
- (follow-up) 섹션 편집+재생성 UI는 regenerate_intro RPC 준비됨 → me/edit 대체 예정, 죽은 라우트(/send,/outbox) 정리

## 최종 남은 것 (사용자 확인 필요)
1. remote `supabase db push` — 마이그레이션 3개 일괄 적용
   - 20260717000000_profile_ai_sea / 20260717010000_sea_flow / 20260717020000_sea_match
2. Edge Function 배포 + `ANTHROPIC_API_KEY` 시크릿 (AI 소개; 없어도 템플릿 폴백 동작)
3. E2E: 여자·남자 테스트 계정으로 온보딩→띄우기→발견→답장→마음에들어요→매칭 전체 검증
4. capacitor server.url → floatie.pages.dev, 배포
5. main 머지

## 재사용 자산 (UI 매핑 결과)
- 컴포넌트: `BottleGlyph`(병 마스코트, drift/open), `SeaBanner`(파도 배너), `BottleDriftScene`(표류 장면), `EmptyState`, `StatusPill`, `StorageImg`(answers 버킷 signed URL)
- CSS/keyframes: `.bottle-sea-*`, `wave-flow`/`animate-wave-flow(-slow)`, `floatie-bob`, `floatie-ping`, buoyant shadows — styles.css에 존재
- 토큰: `--accent`/`--tide-mid`(아쿠아), `--warm*`(피치), `--font-display`=Jua. 신규 필요: `--parch*`(양피지 note), identity card, confirm modal, stepper, profile card
- 제거: `TAB_ICONS`+TabBar (`_authenticated.tsx`), `--tabbar-*` 토큰, send.tsx 하단 offset
- 사진 버킷: `answers` (비공개) 재사용 예정

## 진행 로그
- 2026-07-17: 코드베이스 매핑(UI 완료). 데이터층 대기 → Stage 1 착수 예정.

## 실행 결과 (2026-07-17)
- remote 마이그레이션 3개 적용 완료 (supabase db push)
- Edge Function generate-profile 배포 완료 (ANTHROPIC_API_KEY 미설정 → 템플릿 폴백)
- **E2E 14/14 통과** (여자·남자 계정: 온보딩→띄우기→발견→수락→답장→신원카드(비대칭)→마음에들어요→unlock→알림→매칭→티켓차감→스레드)
- 남은 것: ANTHROPIC_API_KEY 설정(사용자), main 머지, (선택) CF 재배포·capacitor server.url, E2E 테스트데이터 정리
