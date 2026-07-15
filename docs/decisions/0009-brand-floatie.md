# ADR 0009 — Brand name: 플로티 (Floatie)

- Status: Accepted
- Date: 2026-07-15

## Context

Working names included bottlenote, 쪽지, 표류. Product needs a light, cute tone (not serious Korean literary words), 2–3 syllables, aligned with sea-drift waiting UX.

## Decision

- **KR display name:** 플로티
- **EN / mascot / store secondary:** Floatie
- **Rejected:** bottlenote (translation feel), 표류 (too serious), 둥실-only (weak product description)

## Consequences

- UI, manifest, Capacitor `appName`, store copy use 플로티
- Code SSOT: `src/lib/brand.ts`
- Repo folder remains `sumgyeol`; `appId` migration to `app.floatie.*` deferred until store submit
- Legacy 숨결/쪽지 user-facing strings removed
