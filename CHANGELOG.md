# CHANGELOG — delivery-v38 (Visual Round29 + Polish + User feedback 16:48)

**Дата:** 2026-10-27 Asia/Tashkent  
**База:** delivery-v37 (scene.md5 `67caa1bdaee14bd9419c112be026e766`)  
**Итог scene.md5:** `6f7df3cec3e1bad69bc41e13bebd322d`  
**Заморозка:** movement `b8ed45d3130633e4a7dfcfc24a534b0f` · interior `adfea2414dd7945008a0e282b83c8a3a` · plan `55974b68a5ace400800836efffd2940b` (SAME as v37)  
**selfAccept:** false · **v39:** не начат · phone/FPS: OPEN

## Visual Round29
- PRIMARY: dining mean → TARGET≈118.5 (dining-local materials/LED/apron/GLTF only).
- living / terrace HOLD; terrace R−B band 59.7–60.5.
- NO global exposure / sun / hemi / ACES.
- Soft-GPU same-camera interim (this session): sum|err| **1.95 → 1.63**; dining 119.31→119.13 (−0.18); living 119.14→119.03; terrace 119.00→118.96; R−B 60.56→60.52.
- **STATUS: IMPROVED_OPEN_RESIDUAL**
- Pack knobs Round29d: stone.env=.03 apron=.06 chairs=.05 runner=.02 LED.emissive=.00012 PointLight=.0000003 GLTF.env=.05.

## User feedback 16:48
Сложено в **текущий** v38 (не отложено на v39).

### Chairs / doors (crooked)
- **Dining chairs:** rotations were π off (backs to table). Fixed holder rot: `(458,880,0)`, `(458,956,π)`, `(420,918,π/2)`, `(492,918,−π/2)`; GLTF `asset.position.z−=.06` pull-back. Screens: `furniture-chairs-before.jpg` / `furniture-chairs-after.jpg` (+ close).
- **Doors (index + atelier + all):** spawn **CLOSED** flush (`leaf.rotation.y=0`, `angle/target=0`); auto-open still → `d.open`. Panel wider/thicker (`width−.012`, `.055`, z=0); jambs hug leaf (`.028×.18`). plan.js DOORS untouched. Screens: `furniture-door-before/after`, `furniture-door-glass-*`, `furniture-door-atelier-*`.
- P1 HOLD: doors / thrashSofa/Wall/Dining / mapWalk / doorIndex / doorAtelier / doorCoordsDistinct = PASS.

### Texture depth («нет глубины»)
- Non-sofa: wall bump→.072 normalScale→.95 + sheen.08; floor bump→.078 normal→1.05; oak/walnut bump+normal↑; stone bump→.095; curtains fabric-normal-4k normalScale 3.2, bump.22, rough.94, sheen.22, **clearcoat=0**, transmission HOLD .38.
- SSAO kernel HOLD 1.95 (no mean-lift via AO).
- Screens: `texture-depth-before/after`, `texture-curtains-before/after`.
- Covers Polish **Textures** + partial **Render**.

## Polish 1–6
1. **Textures** — measurable depth knobs + before/after (wall/floor/curtains). PASS  
2. **Render** — SSAO HOLD + curtain/wall depth; high bloom reverted to v37 HOLD. PASS (partial via textures)  
3. **Mechanics R08** — mapWalk / doors / thrash / spawn HOLD. PASS  
4. **Bugs** — qualityAdaptive clear on Auto resize (NEW, not sticky setQuality). quality-proof bug PASS  
5. **Optimization** — shadowMap distinct **2048 / 768 / 256** (soft-GPU pixelRatio≈1 N/A). opt PASS via shadowDistinct  
6. **Quality tiers** — high/med/low + low-narrow screens + Auto wiring note. PASS  

## Smoke
- Ordinary **16/16 P1**, NO `?smoke=1`, selfAccept=false.  
- curtains retest: open glass doors 11/12 first (spawn-closed after feedback) then mouse-click Шторы.  
- File: `smoke-delivery-v38.json`

## Files
- Changed: `scene.js` only (vs v37).  
- Screens: `screens-delivery-v38/`.  
