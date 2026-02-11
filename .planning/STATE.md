# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-10)

**Core value:** Glass components that look and feel like Apple's Liquid Glass -- refraction of a dynamic background through UI elements must be visually convincing at 60FPS.
**Current focus:** All 8 phases complete. Milestone v1.0 ready for completion.

## Current Position

Phase: 8 of 8 (Library Packaging & Demo)
Plan: 2 of 2 complete
Status: Phase 08 complete — verified and approved
Last activity: 2026-02-10 -- Phase 08 verified, all phases complete

Progress: [##########] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 15
- Average duration: ~3.0 min
- Total execution time: ~0.75 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-engine-foundation | 2 | ~10 min | ~5 min |
| 02-background-rendering | 2 | ~8 min | ~4 min |
| 03-gpu-texture-bridge | 2/2 | ~5 min | ~2.5 min |
| 04-glass-shader-core | 2/2 | ~18 min | ~9 min |
| 05-react-component-api | 2/2 | ~6.5 min | ~3.2 min |
| 06-accessibility-theming | 2/2 | ~7 min | ~3.5 min |
| 07-visual-polish | 2/2 | ~6 min | ~3 min |
| 08-library-packaging-demo | 2/2 | ~5 min | ~2.5 min |

**Recent Trend:**
- Last 5 plans: 07-01, 07-02, 08-01, 08-02
- Trend: Stable (~2.5 min/plan)

*Updated after each plan completion*
| Phase 07-visual-polish P01 | 3 min | 2 tasks | 12 files |
| Phase 07-visual-polish P02 | 3 min | 2 tasks | 10 files |
| Phase 08-library-packaging-demo P01 | 2 min | 2 tasks | 6 files |
| Phase 08-library-packaging-demo P02 | 3 min | 2 tasks | 10 files |

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
- [06-01]: useSyncExternalStore for concurrent-safe media query detection (not useEffect+useState)
- [06-01]: Module-level store instances for stable subscribe references across components
- [06-01]: setPaused freezes time uniform only; render loop continues for DOM position tracking
- [06-01]: setReducedTransparency stored in C++ but not called from React -- adaptation in React side
- [Phase 06-02]: Dark/light mode tint defaults applied only when user has not provided explicit tint prop
- [Phase 06-02]: Text contrast via text-shadow (not background adjustment) to preserve glass transparency aesthetic
- [07-01]: Specular/rim defaults match previously hardcoded values (0.2/0.15) for zero visual regression
- [07-01]: Mode multipliers use continuous mix() with float uniform (not branching) for GPU-friendly mode switching
- [07-01]: Prominent mode: refraction 1.8x, specular 1.5x, rim spread 2x, aberration 1.5x
- [07-01]: Reduced-transparency zeroes all visual effects (aberration, specular, rim, mode=standard)
- [07-02]: Exponential decay lerp (1 - exp(-speed * dt)) for frame-rate independent morph transitions
- [07-02]: Morph runs even when paused (background freezes, morphing continues for reduced-motion)
- [07-02]: setRegionRect writes to both current and target (instant DOM tracking, no sliding lag)
- [07-02]: Accessibility transitions instant via temporary morphSpeed=0 before parameter changes
- [07-02]: GlassButton hover multipliers: specular 1.8x, rim 2x, aberration 1.5x, blur 0.8x; pressed blur 0.3x
- [08-01]: SINGLE_FILE=1 embeds WASM as base64 in engine.js (~674KB) eliminating separate .wasm file distribution
- [08-01]: Vite config uses command+mode conditional: build (default) = library, build --mode demo = app, dev = dev server
- [08-01]: React/ReactDOM moved to peerDependencies (^18 || ^19) with devDependencies for development
- [08-02]: Separate vite.demo.config.ts (not conditional mode in main vite.config.ts) for demo isolation
- [08-02]: Demo imports components from source directly (../src/components/) for HMR during development
- [08-02]: Inline styles only in demo controls (no CSS files) for zero-dependency demo components

### Pending Todos

None yet.

### Blockers/Concerns

- (RESOLVED) Phase 3 research flag: React + WebGPU lifecycle integration patterns are non-standard -- solved with destroyEngine() + useEffect cleanup
- (RESOLVED) Phase 7 research flag: Chromatic aberration and rim lighting shader techniques -- implemented as uniform-controlled parameters with mode-dependent multipliers

## Session Continuity

Last session: 2026-02-10
Stopped at: All phases complete — milestone v1.0 ready
Resume file: None
