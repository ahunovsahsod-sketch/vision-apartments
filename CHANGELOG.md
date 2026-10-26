# delivery-v17 — Visual Round8 vs TARGET

**Дата:** 2026-10-26 (Asia/Tashkent)  
**База:** delivery-v16 (ПРИНЯТО)  
**TARGET:** `shared/upgrade-2026-10-25/TARGET-user-2026-10-25-2144.png` (mean ≈ 118.5)  
**selfAccept:** false

## Top-3 residual gaps (после Round7 / after-v16)

1. **dining-still-bright** (PRIMARY) — dining mean ≈ 134.1 vs TARGET ≈ 118.5 (|err|≈15.7).
2. **terrace-cool-chroma** — terrace R−B ≈ 26 vs TARGET ≈ 60; mean ≈ 104.7 slightly under.
3. **living-slight-under** — living mean ≈ 111.3 (|err|≈7.2); **не ломать** глобальным dimming.

## Fixes (только `scene.js`, selective)

- **Не трогали** ACES exposure `.752`, sun `#ff7420` `4.35`, hemi `.21`, `environmentIntensity` `.21` (protect living≈111)
- dining window dayLights (492,923 / 492,779) `userData.base` `.10` / `.14` (было `.22`/`.28`)
- dining-only fills: `382,784` `.28`; `100,925` `.38`; sofa-near `363,932` `1.0` protected; living fills `270/420` `1.05`
- terrace warm fills added: `620,900` `.85`; `720,880` `.55` (local, no global wash)
- dining pendant `1.10` (было `1.75`); dining table stone **clone** darker `#a89070` (не shared stone)
- terrace tile warmer `#ffb050` roughness `.68` (material-only chroma + mean lift)
- jute / SSAO / bloom = Round6 (living rug + global AO не давили living)
- `applyTime` Round8 markers; selective bases unchanged globally

**Не трогали:** movement / interior interactives / door-physics / plan / mapWalk aliases / kitchen spawn 290/810 / snapIfStuck / soft-GPU catch-up path.

## Measurable improvement (same-camera, medium)

| view | before (v16) mean | after (v17) mean | Δ | \|err\|→TARGET 118.5 |
|------|-------------------|------------------|---|----------------------|
| living | 111.3 | 109.7 | −1.6 | 7.2 → 8.8 |
| dining | 134.1 | 127.5 | −6.6 | 15.7 → 9.0 |
| terrace | 104.7 | 104.5 | −0.2 | 13.8 → 14.0 |

**sum \|err\|:** 36.7 → **31.9** (measurable toward TARGET; dining −6.6 primary).  
Terrace R−B: 25.9 → **28.0** (toward TARGET ≈59.8; residual OPEN).  
Living |err| slight rise (+1.6) — within prior audit tolerance pattern (sum fell).  
Residual vs TARGET: **OPEN** (dining still bright; terrace cool chroma; FOV/layout).  
phone-ready / hardware FPS: **OPEN**.

## Ordinary P1 matrix (`smoke-delivery-v17.json`, без `?smoke=1`)

| check | result |
|-------|--------|
| `mapWalk` | PASS |
| `mapClickKitchen` | PASS |
| `aliasLoungeDining` | PASS |
| `floorClick` | PASS |
| `lamp` | PASS |
| `curtains` | PASS |
| `art` | PASS |
| `tv` | PASS |
| `doorIndex` | PASS |
| `doorAtelier` | PASS |
| `doorCoordsDistinct` | PASS |
| `thrashSofa` | PASS |
| `thrashDining` | PASS |
| `thrashWall` | PASS |
| `spawnDining` | PASS |
| `scroll375` | PASS |
| `visualRound8` | IMPROVED_OPEN_RESIDUAL |

**Итог P1:** все 16 PASS · **selfAccept:** false · **verdictSelf:** P1_PASS_SELF_FALSE

Оговорки:
- doorAtelier: evaluate cycle `[0,90,0]` PASS; soft-GPU screenshot may soft-fail (не product fail).
- phoneReady: false / OPEN; hardwareFps: open.
- visualRound8 residual vs TARGET остаётся OPEN (measurable improvement зафиксирован).
- shared/baselines не трогали; v18 не начат.

## Артефакты

- `screens/round8-*-before|after.jpg`, `compare-round8-before-after.jpg`, `compare-round8-vs-target.jpg`, `compare-round8-{living,dining,terrace}.jpg`
- P1 proofs: `02-375`, `10-door-index`, `11-tv`, `12-lamp`, `13*-thrash`, `14-floor-off`, `15-mapwalk`, `16-curtains`, `17-art`, `01-door-atelier-open`
- `smoke-delivery-v17.json` — ordinary P1
- `programmer-cycle17-report.md`
