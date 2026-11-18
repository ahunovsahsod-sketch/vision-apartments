# CHANGELOG — delivery-v39 (Visual Round30 + Polish)

**Дата:** 2026-10-27 Asia/Tashkent  
**База:** delivery-v38 (scene.md5 `6f7df3cec3e1bad69bc41e13bebd322d`)  
**Итог scene.md5:** `b551104887f099d831f7403b45e397c6`  
**Заморозка:** movement `b8ed45d3130633e4a7dfcfc24a534b0f` · interior `adfea2414dd7945008a0e282b83c8a3a` · plan `55974b68a5ace400800836efffd2940b` (SAME as v38)  
**selfAccept:** false · **v40:** не начат · phone/FPS: OPEN

## Visual Round30
- PRIMARY: dining mean → TARGET≈118.5 (dining-local env/LED/PL/GLTF only).
- living / terrace HOLD; terrace R−B band (session 59.42, band 59.7–60.5 — HOLD/near).
- NO global exposure / sun / hemi / ACES.
- **Capture stability:** forced `setQuality(medium)` + `qualityManual=1` + shadowMap=768; same-camera; reject quality≠medium (discard-low/blank/aggressive/quiet/raise-micro folders NOT used for claim).
- Soft-GPU session **under-target** (~114 vs older ~119): dial↑ direction correct; **не CLOSED**.
- Same-camera medium metrics:

| room | before mean | |err| | after mean | |err| | Δ |
|------|-------------|------|------------|------|---|
| living | 114.14 | 4.36 | 114.13 | 4.37 | ≈HOLD |
| dining | 114.50 | 4.00 | 114.60 | 3.90 | −0.10 |err| PRIMARY toward 118.5 |
| terrace | 118.19 | 0.31 | 118.19 | 0.31 | HOLD; R−B 59.42 |
| **sum\|err\|** | **8.67** | | **8.58** | | **Δ −0.09** |

- **STATUS: IMPROVED_OPEN_RESIDUAL**
- Screens: `round30-{living,dining,terrace}-{before,after,compare}.jpg` + `round30-metrics.txt` + `capture-meta-*-medium.json`

## User feedback 16:48 — HOLD
- Chairs face-table + doors closed-flush + texture depth (curtains/wall/floor) из v38 **не регрессированы**.

## Polish 1–6
1. **Render** — quality high/med/low (+low-narrow) screens; shadowMap 2048/768/256 visibly distinct; capture medium forced. PASS  
2. **Mechanics R08** — mapWalk / doors / thrash / spawn HOLD в ordinary smoke 16/16. PASS  
3. **Textures** — NEW угол: kitchen/bath **tile** bumpScale **0.008→0.018** (+ roughness +0.10); TV media oak normalScale 1.15 documented (не только curtains/wall). Screens: `texture-tile-*`, `texture-tvoak-*` (+compare). Live chrome before/after flaky → knob cards + living after photo; measurable knobs PASS.  
4. **Bugs** — NEW ≠ adaptive clear: `sun.shadow.map.dispose()` при смене mapSize tier; `dataset.shadowDisposed=1` даже если soft-GPU ещё не аллоцировал map. Proof: `bug-shadow-dispose.jpg` + `quality-proof.json`. PASS  
5. **Optimization** — shadowMap distinct **2048 / 768 / 256** measurable. PASS  
6. **Quality tiers** — UI accents (high green / low blue) + Auto title soft-GPU honesty. PASS  

## Smoke
- Ordinary **16/16 P1**, NO `?smoke=1`, selfAccept=false.  
- atelier door retest после soft-GPU TargetClosed (warp 318,855 → coordsDistinct PASS).  
- File: `smoke-delivery-v39.json`

## CHANGED files (md5 vs v38)
| file | v38 | v39 | |
|------|-----|-----|---|
| scene.js | 6f7df3cec3e1bad69bc41e13bebd322d | b551104887f099d831f7403b45e397c6 | CHANGED |
| app.js | 5357172c18394d281db34e52ba2fa234 | 972e8767d065319c23e01025292b2099 | CHANGED |
| styles.css | 6b7b5550dab199743df254a514104ca0 | d441b79972ac0bc5f483e56922c50217 | CHANGED |
| movement.js | b8ed45d3… | b8ed45d3… | SAME |
| interior.js | adfea241… | adfea241… | SAME |
| plan.js | 55974b68… | 55974b68… | SAME |

**Не «scene only»:** app.js (Auto title soft-GPU) + styles.css (quality accents) тоже CHANGED.

## Notes
- phone/FPS: OPEN (soft-GPU).  
- shared/baselines / Tilda / paid gens: не трогались.  
- v40: не начат.
