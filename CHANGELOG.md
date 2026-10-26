# delivery-v16 — Visual Round7 vs TARGET

**Дата:** 2026-10-26 (Asia/Tashkent)  
**База:** delivery-v15 (ПРИНЯТО)  
**TARGET:** `shared/upgrade-2026-10-25/TARGET-user-2026-10-25-2144.png` (mean ≈ 118.5)  
**selfAccept:** false

## Top-3 residual gaps (после Round6 / after-v15)

1. **dining-still-bright** (PRIMARY) — dining mean ≈ 145.2 vs TARGET ≈ 118.5 (|err|≈26.7).
2. **terrace-cool-chroma** — terrace R−B ≈ 26 vs TARGET ≈ 60; mean ≈ 104.6 slightly under.
3. **living-slight-under** — living mean ≈ 113.0 (|err|≈5.5); **не ломать** глобальным dimming.

## Fixes (только `scene.js`, selective)

- **Не трогали** ACES exposure `.752`, sun `#ff7420` `4.35`, hemi `.21`, `environmentIntensity` `.21` (protect living≈113)
- dining window dayLights (492,923 / 492,779) `userData.base` `.22` / `.28` (было `.35`/`.40`)
- dining-only fills: `382,784` `.48`; `100,925` `.62`; sofa-near `363,932` `1.0` protected; living fills `270/420` `1.05`
- dining pendant `1.75` (было `2.6`); dining table stone **clone** darker `#b8a888` (не shared stone)
- terrace tile warmer `#f8d0a0` (material-only chroma)
- jute / SSAO / bloom = Round6 (living rug + global AO не давили living)
- `applyTime` Round7 markers; selective bases unchanged globally

**Не трогали:** movement / interior interactives / door-physics / plan / mapWalk aliases / kitchen spawn 290/810 / snapIfStuck / soft-GPU catch-up path.

## Measurable improvement (same-camera, medium)

| view | before (v15) mean | after (v16) mean | Δ | \|err\|→TARGET 118.5 |
|------|-------------------|------------------|---|----------------------|
| living | 113.0 | 111.3 | −1.7 | 5.5 → 7.2 |
| dining | 145.2 | 134.1 | −11.1 | 26.7 → 15.7 |
| terrace | 104.6 | 104.7 | +0.0 | 13.8 → 13.8 |

**sum \|err\|:** 46.1 → **36.7** (measurable toward TARGET; dining −11.1 primary).  
Living |err| slight rise (+1.7) — within Round6 audit tolerance pattern (sum fell).  
Residual vs TARGET: **OPEN** (dining still bright; terrace cool chroma; FOV/layout).  
phone-ready / hardware FPS: **OPEN**.

## Ordinary P1 matrix (`smoke-delivery-v16.json`, без `?smoke=1`)

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
| `visualRound7` | IMPROVED_OPEN_RESIDUAL |

**Итог P1:** все 16 PASS · **selfAccept:** false · **verdictSelf:** P1_PASS_SELF_FALSE

Оговорки:
- doorAtelier: evaluate cycle `[0,90,0]` PASS; soft-GPU screenshot may soft-fail (не product fail).
- phoneReady: false / OPEN; hardwareFps: open.
- visualRound7 residual vs TARGET остаётся OPEN (measurable improvement зафиксирован).
- shared/baselines не трогали; v17 не начат.

## Артефакты

- `screens/round7-*-before|after.jpg`, `compare-round7-before-after.jpg`, `compare-round7-vs-target.jpg`, `compare-round7-{living,dining,terrace}.jpg`
- P1 proofs: `02-375`, `10-door-index`, `11-tv`, `12-lamp`, `13*-thrash`, `14-floor-off`, `15-mapwalk`, `16-curtains`, `17-art`, `01-door-atelier-open`
- `smoke-delivery-v16.json` — ordinary P1
- `programmer-cycle16-report.md`
