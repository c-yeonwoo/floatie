# ADR 0008 — 신고 검토 후 영구 제명 + 휴대폰 본인인증

- Status: Accepted
- Date: 2026-07-15

## Context

익명 미션이라도 설렘형(사실상 라이트 데이팅)이므로 악성 유저·미성년·다계정 리스크가 있다.

## Decision

1. **신고**: delivery/user 대상 → `reports` 큐(`pending`)
2. **관리자**(`/admin/reports`): 기각 또는 **영구 제명** (`profiles.status=banned`)
3. **본인인증**: 휴대폰 OTP 필수 게이트 (번호 비공개). 운영 SMS는 후속, 개발은 `dev_otp_enabled`

## Consequences

- 콜드스타트에 인증 마찰 증가 (의도: 품질)
- PASS 등 통신사 인증으로 교체 여지 확보
