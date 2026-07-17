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
- **매칭=과금**: 현재 상호 OK시 `trg_mission_try_unlock`이 스레드 자동 생성. 새 스펙은 OK→프로필 오픈(스레드 X)→티켓 결제 시 `start_match` RPC로 스레드 생성. (Stage 7)
- **신원 선노출**: 남자가 열기 전 발신자 닉/나이/지역 노출. 현재 RLS는 unlock 후에만. delivered 상태에서 제한 필드 노출 RPC/뷰 필요. (Stage 6)
- **사진 peer 열람**: `answers` 버킷 signed URL — unlock 후 상대 사진 열람 정책 확인 필요. (Stage 6/7)

### Stage 2 — 디자인 토큰 & 공용 컴포넌트
- styles.css/@theme: parchment note, sea/waves, 아쿠아 프로필, identity card, confirm modal, stepper
- 컴포넌트: SeaScene, Bottle, ParchmentNote(모드), ConfirmModal, IdentityCard, ProfileCard
- 상태: ⬜

### Stage 3 — 온보딩 스텝퍼 + AI 생성
- `_authenticated.onboarding.tsx` 재작성 (스텝퍼)
- 사진 3장 업로드 → storage
- AI 소개 생성: Edge Function `generate-profile`(Claude haiku) or 템플릿 fallback
- 상태: ⬜

### Stage 4 — 여자 바다 홈 + 탭바 제거
- `_authenticated.tsx` 탭바 제거
- `home.tsx` → SeaScene(내 플로티 병) + FAB + mood + 아바타 메뉴
- 상태: ⬜

### Stage 5 — 쪽지 흐름 (compose/read/reply)
- ParchmentNote 실제 RPC 연결 (mission.ts): 띄우기/읽기/수락/답장/사진답변/포기(패널티)
- 상태: ⬜

### Stage 6 — 남자 바다 + 발견/수락
- 받은 플로티 병, 발견→신원카드(잠김)→열기→읽기→수락→답장, 프로필 잠금
- 상태: ⬜

### Stage 7 — 프로필 페이지 + 양방향 잠금해제 + 이력
- ProfileCard, 마음에 들어요→verdict→프로필, 매칭 CTA→thread, 남자 알림/잠금해제
- 플로티 이력 페이지 + 상태 pill + 쪽지 드릴다운
- 상태: ⬜

### Stage 8 — 티켓 상점 + 프로필 수정 + 정리
- 티켓 상점, 섹션 편집+재생성(2/day), 죽은 라우트 제거, 카피 정리, capacitor server.url, 배포
- 상태: ⬜

## 재사용 자산 (UI 매핑 결과)
- 컴포넌트: `BottleGlyph`(병 마스코트, drift/open), `SeaBanner`(파도 배너), `BottleDriftScene`(표류 장면), `EmptyState`, `StatusPill`, `StorageImg`(answers 버킷 signed URL)
- CSS/keyframes: `.bottle-sea-*`, `wave-flow`/`animate-wave-flow(-slow)`, `floatie-bob`, `floatie-ping`, buoyant shadows — styles.css에 존재
- 토큰: `--accent`/`--tide-mid`(아쿠아), `--warm*`(피치), `--font-display`=Jua. 신규 필요: `--parch*`(양피지 note), identity card, confirm modal, stepper, profile card
- 제거: `TAB_ICONS`+TabBar (`_authenticated.tsx`), `--tabbar-*` 토큰, send.tsx 하단 offset
- 사진 버킷: `answers` (비공개) 재사용 예정

## 진행 로그
- 2026-07-17: 코드베이스 매핑(UI 완료). 데이터층 대기 → Stage 1 착수 예정.
