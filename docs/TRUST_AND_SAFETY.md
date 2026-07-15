# Trust & Safety — 플로티 (Floatie)

## 원칙

1. Unlock 전 신원 최소화 (닉네임·얼굴 비공개)  
2. 미션 이용 전 **휴대폰 본인인증** 필수  
3. 패스는 쉽고, 차단·신고는 확실  
4. 신고 → **관리자 검토** → 필요 시 **영구 제명**  
5. 만 18+만  

## 본인인증

| 항목 | 내용 |
|------|------|
| 수단 (MVP) | 휴대폰 OTP (`request_phone_otp` / `confirm_phone_otp`) |
| 공개 | 번호는 상대에게 비공개. 매칭·중복가입 방지용 |
| 게이트 | 온보딩 후 `/verify` 미통과 시 미션 이용 불가 |
| 운영 | `app_config.dev_otp_enabled=true` 이면 개발용 코드 반환. **운영 전 false** + SMS(NCP SENS 등) 연동 |
| 고도화 | PASS/NICE/KCB 등 통신사 본인인증으로 교체 가능 |

관리자 지정:

```sql
update profiles set is_admin = true where id = '<uuid>';
update app_config set value = 'false' where key = 'dev_otp_enabled';
```

## 신고 · 제명

| 단계 | 내용 |
|------|------|
| 유저 | 배달/대화에서 신고 (사유 + 선택 상세) |
| 큐 | `reports.status = pending` |
| 관리자 | `/admin/reports` 에서 기각 또는 **영구 제명** |
| 제명 | `profiles.status = banned`, 진행 중 배달 종료, 앱 진입 시 `/banned` |

## 차단

- 상호 전달·채팅 불가, 쿨다운과 별개로 영구  

## 채팅 안전

- unlock 스레드만, 20통/7일 캡  
- 외부 연락은 양측 제안 시에만  

## 운영 목표

| 항목 | 목표 |
|------|------|
| 신고 첫 응대 | 24h |
| 명확 위반 | 영구 제명 |
