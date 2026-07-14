# ADR 0005 — 스택: sumgyeol 골격 + Supabase + Capacitor

- Status: Accepted (supersedes bottlenote ADR “Expo + NestJS”)
- Date: 2026-07-14

## Context

익명 미션 앱을 빠르게 DB→모바일 테스트까지 가져가려면 그린필드(Expo+Nest)보다, 폐기 예정인 **숨결(sumgyeol)** 의 인프라를 비우고 재사용하는 편이 빠르다.

숨결에 이미 있는 것: Supabase Auth/DB/Storage, React+TanStack UI, Capacitor iOS/Android, 스토어 preflight.

## Decision

| 층 | 선택 |
|----|------|
| 레포 | `c-yeonwoo/sumgyeol` (본진). 폴더명·GitHub 이름 변경은 브랜드 확정 후 |
| DB/Auth/Storage | **Supabase** (기존 프로젝트 스키마 교체 또는 신규 프로젝트 — 구현 시 선택) |
| 앱 | 기존 **React + TanStack Start + Tailwind** 화면을 미션 루프로 교체 |
| 모바일 | **Capacitor** (기존 ios/android). 당분간 WebView→라이브 SSR URL 패턴 유지 가능 |
| API | Nest/별도 서버 **없음**. Supabase + 필요 시 TanStack server functions |
| 채팅 MVP | Supabase Realtime 또는 폴링 |

**가져갈 것:** auth, blocks/reports, image utils, UI kit, Capacitor·릴리스 스크립트  
**버릴 것:** 피드·팔로우·좋아요·댓글·AI 결·유사도·숨결/결 브랜드 카피

## Consequences

- 출시 속도↑, Lovable/SSR WebView 종속은 단기 수용
- 장기적으로 SPA 또는 Expo 이관은 루프 검증 후 검토
- 스토어 제출 전 `appId`/`appName`은 숨결(결)과 분리 필수
