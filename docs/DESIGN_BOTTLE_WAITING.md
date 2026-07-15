# 플로티 — 대기 화면 디자인 초안

> 상태: **초안 v0.2** · 브랜드 **플로티 (Floatie)** 확정 · full redesign 예정  
> 구현: `src/components/bottle-drift-scene.tsx`, `/waiting/$deliveryId`

---

## 1. 컨셉

여성이 미션을 보낸 직후 **결과 목록으로 바로 가지 않고**, Floatie(병)가 **바다 위를 둥실 떠다니는** 감정적 대기 화면을 거친다.

| 단계 | 화면 | 감정 |
|------|------|------|
| 발송 직후 | 표류 중 (drifting) | 설렘 · 불확실성 |
| 남성 수락 | 받았어요 (accepted) | 안도 · 12h 긴장 |
| 답장 도착 | replied | 기대 · 평가 |
| 12h 무응답 | expired | 아쉬움 → 재발송 제안 |

---

## 2. 비주얼 (draft)

- **하늘→바다** 그라데이션 (Serene gallery 베이지와 어울리는 muted teal)
- **CSS 파도** 2겹
- **유리병 + 종이 scroll** — 미션 본문 일부 노출
- **표류 애니메이션** — Floatie가 둥실거림

전역 UI는 Serene gallery. 바다·병 비주얼은 **대기·보내기**에 국소 적용.

---

## 3. 브랜드 표기

| 맥락 | 표기 |
|------|------|
| 앱 이름 (KR) | **플로티** |
| 스토어·마스코트 (EN) | **Floatie** |
| UI eyebrow | `Floatie` (uppercase tracking) |
| 구어 | “플로티에 보냈어” |

코드 SSOT: `src/lib/brand.ts`

---

## 4. 이후 redesign

- [ ] Floatie 병 캐릭터 일러스트
- [ ] 앱 아이콘·스플래시 (숨결 레거시 제거 완료 → 플로티)
- [ ] Ocean token set 전역 확장 여부
- [ ] Lottie 파도
