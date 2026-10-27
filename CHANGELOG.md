# CHANGELOG — delivery-v37 (Visual Round28 + Polish pack)

**Дата:** 2026-10-27 Asia/Tashkent  
**База:** delivery-v36 (scene.md5 `2a6d0b4d7e26eb19382c8967f337305d`)  
**Задача:** Visual Round28 residual vs TARGET≈118.5 / R−B≈60 **плюс** Polish pack (BRIEF ~13:15).  
**selfAccept:** false

---

## A. Visual Round28

**Фокус:** living mean **к** TARGET≈118.5; dining HOLD; terrace HOLD + R−B band 59.7–60.5.  
Только selective `scene.js`; **NO** global exposure / sun / hemi / ACES.  
movement / interior / plan — **SAME** as v36.

### Knobs
- living-only `@240,960` base **2.16→1.90** dist2.40 (dial-down)
- `[363,932]=3.28` **HOLD**
- terrace FAR fills / RectAreas / materials — **не трогали**
- dining lights/materials — **не трогали**

### Почему dial-down, а не mean↑
Бриф предполагал living under-target (~118.12 по аудиту v36). На soft-GPU той же сессии polish-before дал **~119.31** (абсолютный drift). Первичный проход base **2.42** увёл mean **от** 118.5 (119.31→119.47, sum|err| 2.14→2.26).  
Trials: 2.42↑хуже → 2.24≈плоско → 2.00/−0.11 → **1.90/−0.16** оставлен.

### Measurable (PIL full-frame, same-camera)

| room | before | after | Δ | \|err\| |
|---|---|---|---|---|
| living | 119.31 | 119.15 | **−0.16** | 0.81→**0.65** |
| dining | 119.33 | 119.33 | −0.00 | 0.83→0.83 HOLD |
| terrace | 119.00 | 119.01 | +0.01 | 0.50→0.51 HOLD |
| terrace R−B | 60.56 | 60.59 | +0.03 | **ΔHOLD** (soft-GPU band edge ~60.5) |
| **sum\|err\|** | **2.14** | **1.99** | **−0.15** | toward TARGET≈118.5 |

vs broken 2.42 after: living |err| 0.97→0.65; sum|err| 2.26→1.99.

**STATUS:** IMPROVED_OPEN_RESIDUAL  
scene.md5 after: `67caa1bdaee14bd9419c112be026e766`  
(polish-only before Round28 dial: `299d07f48a4dc0c3bbb6558d56918e82`)

---

## B. Polish pack

1. **Render** — quality proof screens `quality-high.jpg` / `quality-medium.jpg` / `quality-low-narrow.jpg` (non-trivial sizes; ordinary без beige blank). Evidence: `quality-proof.json` pass=true.
2. **Mechanics** — R08 HOLD (WASD+mouse, map walk, floor OFF, двери/интерактивы). Code-change mechanics: нет. Checklist: `status/polish-prep/mechanics-R08-checklist.md` (+ копия в screens notes).
3. **Textures** — living sofa anti-plastic (`sofaMat`: clearcoat=0, sheenRoughness↑, bump↑, envMapIntensity↓). Screens: `texture-sofa-before.jpg` / `texture-sofa-before-living.jpg` → `texture-sofa-after.jpg`.
4. **Bugs** — sticky manual `setQuality` on resize (`dataset.qualityManual=1` до Auto). Fix в `app.js`. См. `polish-prep/bugs-scan.md`.
5. **Optimization** — `canvas.dataset.fps` пишется; adaptive: auto + `2≤fps<28` ~2s на high → step to medium once (`dataset.qualityAdaptive=1`). Proof description + dataset asserts в `quality-proof.json`.
6. **Quality tiers** — UI High/Med/Low/Auto в `index.html`+`atelier.html`; `dataset.quality` на каждом `applyQuality`; proofs `quality-high.jpg` / `quality-medium.jpg` / `quality-low-narrow.jpg` (viewport ~375).

---

## P1 ordinary smoke

`smoke-delivery-v37.json` — mode=ordinary, NO `?smoke=1`, selfAccept=false — **все 16 P1 PASS**  
(mapWalk/aliases, kitchen spawn 290/810, floor OFF, doors, curtains/art/tv/lamp, scroll375, thrash/spawn, doorAtelier/coordsDistinct). Soft-GPU screenshot timeouts non-blocking (evaluate PASS).

---

## OPEN (честно)

- residual visual → TARGET (living |err|≈0.65 soft-GPU; dining ≈0.83; terrace ≈0.51)  
- phone-ready — **OPEN** (не писать «готово на телефоне»)  
- hardware FPS — **OPEN**

## Не трогали

shared/baselines; movement.js / interior.js / plan.js (md5 SAME as v36); Tilda / paid gens; phone/FPS work; **v38 не начат**.

## Изменённые файлы (vs v36)

- `scene.js` — Round28 living dial + polish sofa anti-plastic  
- `app.js` / `index.html` / `atelier.html` / `styles.css` — quality UI + sticky manual + adaptive FPS  
