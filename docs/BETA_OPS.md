# 비공개 베타 운영 체크리스트

> 2026-07-18 · 초대 20–50명 권장 · 스토어 미제출

---

## 1. 환경

- [ ] 원격 DB 마이그레이션 최신 (`supabase db push` / Dashboard)  
  - 포함: interview love_view · analytics_events · push hook  
- [ ] Edge: `generate-profile` · `dispatch-push` 배포  
- [ ] **OTP:** 베타는 `app_config.dev_otp_enabled = true` 허용 가능.  
  - QA 계정만 쓰는지 문서화. 외부 초대 시 SMS 연동 또는 안내 문구 필수.  
- [ ] (선택) `FCM_SERVER_KEY` — 없으면 in-app 알림만

---

## 2. E2E (여 / 남 2계정)

1. 여: 온보딩 → 플로티 띄우기 → 표류 카피 확인  
2. 남: 발견 모달 = **닉 없음 · 나이대·지역** → 패스 / 열기  
3. 남: 수락 → 병 **타이머 뱃지** → 답장  
4. 여: 답장 glow → 마음에 들어요 → unlock 카드  
5. 티켓 매칭 → 채팅 1통 → `analytics_events`에 send/reply/unlock/match/msg_first  
6. 신고·차단·탈퇴 각 1회  
7. 레거시 URL `/send` `/outbox` `/delivery/1` → `/home` 리다이렉트

---

## 3. 성비 · 초대

- 목표: 여:남 ≈ 1:1 ~ 1:1.5 (남이 많아도 여 발신이 병목)  
- 같은 타임존에 온보딩 배치해 빈 바다 최소화  
- 남에게 “도착 알림” CTA 안내

---

## 4. 모더레이션

- `/admin/reports` 담당 1명 · 응답 SLA 24h (베타)  
- 불쾌 답장·연락처 압박은 즉시 제명 검토

---

## 5. 성공 지표 (2주)

| 지표 | 보는 법 |
|------|---------|
| unlock | `analytics_events` name=`unlock` |
| 답장률 | open_accept vs reply |
| D1 | 접속 로그 / touch_last_active (수동) |
| 빈바다 | empty_sea_view · 유저 피드백 |

KPI를 “매칭 수”만으로 보지 말 것.
