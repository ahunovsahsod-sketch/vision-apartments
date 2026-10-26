# Asset needs — delivery-v4

Бесплатно/уже в репо: oak/stone/fabric/plaster WebP (1k+4k), HDRI daylight-sky-2k, GLTF dining_chair_02 / throw_pillows_01 / potted_plant_02 (CC0), **cannon-es 0.20.0** (MIT, vendor-local).

## Open (visual fidelity vs TARGET — без платных gens)
1. Linen sofa denser albedo + true displacement
2. Jute/rug weave 2k–4k
3. Sheer curtain opacity/fold map
4. TV wall unit GLTF ближе TARGET
5. Outdoor olives / bushes фотореалистичнее
6. **KTX2** варианты 1k/2k/4k — `toktx`/`basisu` **нет на машине сборки**; оставили WebP + LOD (1k при width≤900, 4k только wide high). Нужен offline convert в следующем цикле при наличии CLI.
7. Официальная сверка площадей 134,7 vs 143,7 / public 176,8
8. Verified contacts before publish

Платные генерации / Tilda / внешние платные API — **запрещены**.

## Round5 residual (OPEN — free only)
9. Dining window plate/sheer still washed vs TARGET (~154 vs ~118) — needs denser sheer + darker dining oak albedo (free WebP ok; no paid gens).
10. Terrace HDR amber chroma (R−B ~24 vs TARGET ~60) — warmer free HDRI or graded sky plate; без paid.

## Round6 residual (OPEN, no purchase)
- Terrace cool chroma (R−B≈26 vs TARGET≈60): warmer free sun/materials applied; HDR sky still cool — ASSET-NEEDS only, no paid gens.
- Dining still bright (|err|≈26.7): selective window crush helped; residual OPEN.

## Round7 residual (OPEN, no purchase)
- Dining still bright (|err|≈15.7 after selective crush from ≈26.7): denser sheer / darker dining oak albedo (free WebP ok).
- Terrace cool chroma (R−B≈26 vs TARGET≈60): warmer free HDRI or graded sky; без paid gens.
- Living slightly under TARGET (|err|≈7.2): FOV/layout differ; avoid global exposure bump that re-washes dining.

## Round8 residual (OPEN, no purchase)
- Dining still bright (|err|≈9.0 after selective crush from ≈15.7): denser sheer / darker dining oak albedo (free WebP ok).
- Terrace cool chroma (R−B≈28 vs TARGET≈60): warmer free HDRI or graded sky; material `#ffb050` helped slightly; без paid gens.
- Living slightly under TARGET (|err|≈8.8): FOV/layout differ; avoid global exposure bump that re-washes dining.
