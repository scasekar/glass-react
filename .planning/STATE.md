# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-10)

**Core value:** Glass components that look and feel like Apple's Liquid Glass -- refraction of a dynamic background through UI elements must be visually convincing at 60FPS.
**Current focus:** Phase 5 complete. Ready to plan Phase 6.

## Current Position

Phase: 5 of 8 complete (React Component API)
Plan: 2 of 2 complete
Status: Phase complete -- verified
Last activity: 2026-02-10 -- Phase 05 execution complete, verified by human + automated checks

Progress: [######....] 62%

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: ~3.3 min
- Total execution time: ~0.5 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-engine-foundation | 2 | ~10 min | ~5 min |
| 02-background-rendering | 2 | ~8 min | ~4 min |
| 03-gpu-texture-bridge | 2/2 | ~5 min | ~2.5 min |
| 04-glass-shader-core | 2/2 | ~18 min | ~9 min |
| 05-react-component-api | 2/2 | ~6.5 min | ~3.2 min |

**Recent Trend:**
- Last 5 plans: 04-01, 04-02, 05-01, 05-02
- Trend: Accelerating (05-02 in 2.5 min)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 8-phase structure following strict dependency chain (WASM -> engine -> bridge -> shaders -> components -> polish -> package)
- [Roadmap]: Phase 1 must validate GPU device sharing before committing to architecture (critical risk)
- [Roadmap]: Phases 6 and 7 can run in parallel after Phase 5; Phase 8 depends on both
- [02-01]: Render directly to surface for Phase 2 (defer offscreen texture to Phase 3)
- [02-01]: Use explicit BindGroupLayout instead of auto layout for future extensibility
- [02-01]: Store adapter globally for surface capabilities query in OnDeviceAcquired
- [02-01]: Expose engine via getEngine() free function (not Embind constructor)
- [02-02]: No visible UI text when running -- the noise background IS the visual confirmation
- [02-02]: Engine lifetime managed by C++ global pointer, JS only accesses via getEngine()
- [02-02]: ResizeObserver uses device-pixel-content-box for DPR correctness
- [03-01]: Keep all rendering in C++ (no JS-side GPU pipelines needed)
- [03-01]: Use same surfaceFormat for offscreen texture to avoid format conversion
- [03-01]: Renamed pipeline members to noise-prefixed for clarity (noisePipeline, noiseBindGroup, etc.)
- [03-01]: Linear filtering sampler with ClampToEdge for blit pass
- [03-02]: destroyEngine as free function (not class method) matching getEngine pattern
- [03-02]: React useRef to hold module reference for cleanup access
- [03-02]: RAII handles GPU cleanup -- C++ destructor releases wgpu:: wrapper objects automatically
- [04-01]: Glass pass replaces blit pass (not a third pass) -- shader outputs passthrough outside glass region
- [04-01]: No blend state on glass pipeline -- shader does internal compositing via mix()
- [04-01]: 9-tap blur with compile-time constant loop bounds for WGSL uniform control flow compliance
- [05-01]: Use wgpu::Limits (not SupportedLimits) for emdawnwebgpu device limit queries
- [05-01]: Passthrough fallback with rectW=0 when no regions active (mask=0 everywhere, pure background)
- [05-01]: Remove old single-region API entirely (no backward compatibility wrapper)
- [05-02]: GlassProvider owns the canvas element (removed from index.html)
- [05-02]: useMergedRef as shared utility for internal + external ref merging
- [05-02]: GlassButton cornerRadius default 16px (smaller than panel's 24px)

### Pending Todos

None yet.

### Blockers/Concerns

- (RESOLVED) Phase 3 research flag: React + WebGPU lifecycle integration patterns are non-standard -- solved with destroyEngine() + useEffect cleanup
- Phase 7 research flag: Chromatic aberration and rim lighting shader techniques need investigation

## Session Continuity

Last session: 2026-02-10
Stopped at: Phase 5 complete. Next: plan Phase 6.
Resume file: None
