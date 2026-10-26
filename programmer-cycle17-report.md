# Programmer cycle 17 report — delivery-v17 (2026-10-26, Asia/Tashkent)

**Задача:** Visual Round8 residual vs TARGET-user-2026-10-25-2144.png (фокус: dining still bright + terrace cool chroma; living не давить).
**Top-3 residual gaps:** dining-still-bright (primary), terrace-cool-chroma, living-protect — правки только в `scene.js` (selective dining lights/stone/pendant + terrace material/fills; без глобального dimming).
**Measurable:** living 111.29→109.66 (−1.64), dining 134.14→127.52 (−6.62), terrace 104.69→104.46 (−0.22); terrace R−B 25.9→28.0; sum |err| 36.65→31.89 toward TARGET ≈118.5.
**Smoke:** `smoke-delivery-v17.json`, ordinary mode (NO `?smoke=1`) — все 16 P1 PASS; kitchen spawn 290,810.
**visualRound8:** IMPROVED_OPEN_RESIDUAL. **phoneReady:** OPEN. **hardwareFps:** OPEN.
**Screens:** `screens-delivery-v17/` (compare-round8-* + before/after + P1 proofs, round8-metrics.txt).
**selfAccept:** false. Ждёт аудита Проверки. v18 не начат; shared/baselines не трогали.
**Не ломали:** mapWalk/aliases, floor OFF, doors, curtains/art/tv/lamp, scroll375, thrash/spawn (все PASS в ordinary).
