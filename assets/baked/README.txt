OFFLINE BAKED INDIRECT LIGHTING

Generated locally from source-scene.json using official Blender 4.5.9 LTS / Cycles,
Apple Metal GPU, 64 samples. This is a real diffuse-indirect and ambient-occlusion
bake. Direct sun, lamps, reflections, moving props, doors and fabric stay real time.

High / Medium: manifest.json + scene.meshopt.bin.gz (11.75 MB)
Low: manifest-low.json + scene-low.meshopt.bin.gz (5.12 MB)
Both use local meshopt_decoder.mjs, version 1.3.0, MIT (license included).
The matching .bin files are fallbacks for browsers without DecompressionStream.
The loader checks actual gzip magic bytes, so HTTP Content-Encoding:gzip does not
cause accidental double decompression in an iframe or on a static host.

High: 335 separate receiver meshes, 609,497 vertices, 1,139,186 triangles.
Low: 335 separate receiver meshes, 213,788 vertices, 342,238 triangles.
Meshes remain separate for frustum / room culling. Bounds and semantic material
names are in the manifests. No layout change or independent room scaling occurs.

The lighting field has world-space, density-compensated spatial denoising,
separately for each receiver and dominant geometric normal: indirect light sigma
0.26 m, AO sigma 0.10 m. Albedo, texture normal maps and direct shadows are not
blurred. This prevents Monte Carlo samples from appearing as triangular patches.
The original vertex UVs are retained; the viewer may project material UVs in metres.

Low is attribute-aware index simplification, using existing High vertices only.
Topological borders and coordinate extrema are locked. Normals, daytime and evening
light and AO enter the error metric. Across 31,572 sampled triangle centroids,
maximum measured surface deviation was 0.74 mm for architecture and 3.29 mm across
all furniture. Bounds were identical to High. These are sample-based checks, not
an engineering error guarantee. The separate navigation / physics geometry is
unchanged. The codec's maximum coordinate quantization was below 0.25 mm.

The bake intentionally excludes movable chairs, plant leaves, the dynamic throw
blanket, and the old office cabinet/shelves replaced by a narrower design.
Old office geometry IDs: static_0260..static_0263. Dynamic throw: static_0312.
The viewer keeps their current models outside the replaced static receiver group.

Runtime integration:
  loadBakedLighting({group, materials: Map, quality: 'high'|'medium'|'low',
                    intensity: 1, aoIntensity: .55, onProgress})
  returns {applied, stats, setMix, setIntensity, setAOIntensity, dispose}.
  setMix(0) = day, setMix(1) = evening.
  onProgress phases: download / decode / ready.

The source fingerprint, bake parameters, spatial denoise configuration and codec
validation appear in manifest.json. bake-report.json describes the raw irradiance
statistics; denoise-report.json records the spatial field variation before/after.
LOD-VALIDATION.json records the sampled High-versus-Low comparison.
No software binaries or external services are required to view these assets.
