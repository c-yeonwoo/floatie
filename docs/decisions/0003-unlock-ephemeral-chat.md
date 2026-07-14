# ADR 0003 — Unlock 후: 인앱 일회성 채팅

- Status: Accepted
- Date: 2026-07-14

## Context

Unlock 보상을 외부 연락 즉시 교환으로 두면 안전 추적·설렘 버퍼가 약하다. 영구 메신저로 가면 제품이 채팅앱이 된다.

## Decision

Unlock 후 기본은 **인앱 텍스트 스레드**, soft expiry **7일**(양측 무응답 시). 외부 연락처 공개는 **양측 동의** 시에만.

## Consequences

- MVP에 채팅 최소 구현이 필요 (폴링 허용).
- “연락처만 주고 끝” UX는 Phase에서 옵션으로 둘 수 있으나 기본값은 인앱.
