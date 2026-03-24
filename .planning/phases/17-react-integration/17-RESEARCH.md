# Phase 17: React Integration - Research

**Researched:** 2026-03-24
**Domain:** React/WebGPU wiring — GlassProvider connects WASM engine to JS GlassRenderer; GlassRegionHandle backed by TypeScript
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REACT-01 | GlassContext and GlassRegionHandle internals re-backed by JS GlassRenderer class | GlassRenderer.ts already exists (Phase 16); needs per-field setters + handle factory in GlassProvider |
| REACT-02 | Public React API unchanged — GlassPanel, GlassButton, GlassCard props identical to v2.0 | GlassPanel/GlassButton/GlassCard are zero-change components; useGlassRegion is also unchanged; only GlassProvider internals change |
| REACT-03 | All 16 shader parameters functional as typed React props through JS pipeline | GlassRegionState.ts defines all 16 fields; GlassRenderer needs field-level setters so GlassRegionHandle methods map through |
| REACT-04 | Accessibility features preserved (reduced-motion, reduced-transparency, WCAG contrast, dark/light mode) | useGlassRegion already applies a11y overrides via GlassRegionHandle; those handles just need real implementations |
</phase_requirements>

---

## Summary

Phase 17 is a wiring phase. Phases 15 and 16 built both sides of the bridge independently: Phase 15 thinned C++ to a call-driven background renderer with `renderBackground()` and `getSceneTextureHandle()`, and Phase 16 built a complete `GlassRenderer` TypeScript class with pipeline, uniform buffer, morph lerp, and `render()`. Phase 17 connects them inside `GlassProvider` and makes `GlassRegionHandle` a real object backed by `GlassRenderer`.

The work has three distinct sub-tasks: (1) add field-level setters to `GlassRenderer` so `GlassRegionHandle`'s 17 update methods have targets; (2) implement `registerRegion()` in `GlassProvider` to call `GlassRenderer.addRegion()` and return a live `GlassRegionHandle`; (3) replace the temporary `blitRef` / `blitToCanvas` path with a `GlassRenderer.render()` call wired to the real scene texture and canvas context. GLASS-05 (bind group invalidation on resize) must also be addressed in the `ResizeObserver` handler.

The public API (`GlassPanel`, `GlassButton`, `GlassCard`, `useGlassRegion`, all props) is frozen by REACT-02. No changes to those files are permitted. Accessibility logic in `useGlassRegion` is already correct — it just calls `GlassRegionHandle` methods, and once those methods have real implementations the a11y behaviour is automatically live.

**Primary recommendation:** Add a thin `updateTarget(field, value)` pattern to `GlassRegionState` to support field-level updates, then wire `GlassProvider` to instantiate `GlassRenderer` and return `GlassRegionHandle` objects that delegate to it.

---

## What Is Already Done (Do Not Rebuild)

| Component | State | Notes |
|-----------|-------|-------|
| `src/renderer/GlassRenderer.ts` | Complete | `init()`, `addRegion()`, `removeRegion()`, `setSceneTexture()`, `render()`, `destroy()` all exist |
| `src/renderer/GlassRegionState.ts` | Complete | `GlassUniforms`, `GlassRegionState`, `buildGlassUniformData()`, `morphLerp()` all exist |
| `src/renderer/glass.wgsl` | Complete | Full shader matching C++ `glass.wgsl.h` verbatim, DPR-aware |
| `src/renderer/__tests__/uniforms.test.ts` | Complete | All 28 float field offset assertions pass |
| `src/context/GlassContext.ts` | Frozen | `GlassRegionHandle` interface with 17 update methods — do not change |
| `src/hooks/useGlassRegion.ts` | Frozen | Maps all 16 props + a11y overrides through `GlassRegionHandle` — do not change |
| `src/components/GlassPanel.tsx` | Frozen | Uses `useGlassRegion` — do not change |
| `src/components/GlassButton.tsx` | Frozen | Uses `useGlassRegion` — do not change |
| `src/components/GlassCard.tsx` | Frozen | Uses `useGlassRegion` — do not change |
| `src/wasm/loader.ts` | Complete | `getSceneTexture()` helper and `initEngine(device)` already correct |
| Phase 15 blit scaffolding | Remove | `createBlitResources`, `blitToCanvas`, `BLIT_WGSL`, `BlitResources` interface all deleted in Phase 17 |

---

## What Phase 17 Must Build

### 1. Field-Level Setters on GlassRenderer

`GlassRegionHandle` exposes 17 update methods. `GlassRenderer` currently only has `addRegion()`, `removeRegion()`, `getRegion()`. It needs setter methods that mutate the `target` uniforms on the `GlassRegionState` so morph lerp picks up the change next frame.

**Pattern:** Each setter writes to `region.target.*` (never `region.current.*`). The `render()` loop already reads `region.target` via `morphLerp()` and applies exponential decay.

Methods required (map from `GlassRegionHandle` interface to `GlassUniforms` fields):

| GlassRegionHandle method | GlassUniforms target field |
|--------------------------|---------------------------|
| `updateRect(x, y, w, h)` | `rect.{x,y,w,h}` — but rect is set from DOM in render(); write to both current AND target |
| `updateParams(cornerRadius, blur, opacity, refraction)` | `cornerRadius`, `blurIntensity`, `opacity`, `refractionStrength` |
| `updateTint(r, g, b)` | `tint.{r,g,b}` |
| `updateAberration(intensity)` | `aberration` |
| `updateSpecular(intensity)` | `specularIntensity` |
| `updateRim(intensity)` | `rimIntensity` |
| `updateMode(mode)` | `mode` |
| `updateMorphSpeed(speed)` | `morphSpeed` (on `GlassRegionState`, not `GlassUniforms`) |
| `updateContrast(value)` | `contrast` |
| `updateSaturation(value)` | `saturation` |
| `updateBlurRadius(value)` | `blurRadius` |
| `updateFresnelIOR(value)` | `fresnelIOR` |
| `updateFresnelExponent(value)` | `fresnelExponent` |
| `updateEnvReflectionStrength(value)` | `envReflectionStrength` |
| `updateGlareAngle(intensity)` | `glareAngle` |

Note: `updateRect` is provided by `GlassRegionHandle` but `GlassRenderer.render()` already reads the live `getBoundingClientRect()` every frame. The `updateRect` method on the handle should be a no-op or write the rect as a hint — the live DOM position always wins per frame. Document this clearly.

**Implementation style:** Direct public methods on `GlassRenderer`, not a generic `updateField` dispatcher. This matches the existing code style (explicit, typed, auditable).

### 2. GlassRegionHandle Factory in GlassProvider

`registerRegion(element)` must call `GlassRenderer.addRegion(element)` and return a `GlassRegionHandle` object:

```typescript
// Conceptual shape — actual implementation in GlassProvider
const id = rendererRef.current!.addRegion(element);
const handle: GlassRegionHandle = {
  id,
  updateRect: (x, y, w, h) => { /* no-op: render() reads DOM live */ },
  updateParams: (cr, blur, op, refr) => rendererRef.current?.setRegionParams(id, cr, blur, op, refr),
  updateTint: (r, g, b) => rendererRef.current?.setRegionTint(id, r, g, b),
  // ... one line per method
  remove: () => rendererRef.current?.removeRegion(id),
};
return handle;
```

The `rendererRef.current?.` optional chain guards against the handle being called after `GlassProvider` unmounts.

### 3. Replace Blit Pass with GlassRenderer.render()

In `GlassProvider`, the render loop currently:
```
engine.update(dt)
engine.renderBackground()
blitToCanvas(blit, sceneTexture)  // REMOVE
```

Phase 17 replaces the blit with:
```
engine.update(dt)
engine.renderBackground()
glassRenderer.render(canvasContext, canvas.width, canvas.height, dt, devicePixelRatio)
```

`canvasContext` must be the `GPUCanvasContext` obtained from `canvas.getContext('webgpu')`. This context must be configured once (not every frame). The `GlassRenderer.render()` signature already accepts it.

### 4. Canvas Context Ownership

**Critical decision (unresolved from Phase 15):** Phase 15's temporary blit already calls `canvas.getContext('webgpu')` inside `createBlitResources()`. When the blit is removed, the canvas context reference must transfer to `GlassRenderer` or be held in `GlassProvider` and passed to `renderer.render()` each frame.

**Recommended approach:** Keep canvas context in `GlassProvider` (in a `useRef<GPUCanvasContext | null>`). Configure it once when `ready` becomes true:
```typescript
const context = canvas.getContext('webgpu')!;
context.configure({ device, format: navigator.gpu.getPreferredCanvasFormat(), alphaMode: 'opaque' });
canvasContextRef.current = context;
```
Pass the reference into `renderer.render(canvasContext, ...)` each frame. This keeps `GlassRenderer` stateless with respect to the surface (it does not own the context, only renders to it).

### 5. GlassRenderer Initialization Timing

`GlassRenderer.init()` is async (due to `createRenderPipelineAsync`). The init sequence in `GlassProvider` must be:

```
1. navigator.gpu.requestAdapter/requestDevice  -> GPUDevice
2. initEngine(device)                          -> EngineModule (WASM ready)
3. new GlassRenderer(); await renderer.init(device, preferredFormat)
4. getSceneTexture(module)                     -> GPUTexture
5. renderer.setSceneTexture(sceneTexture)      -> bind group ready
6. configure GPUCanvasContext
7. setReady(true)                              -> React components can register regions
```

All steps in a single async IIFE in `useEffect`. The `rendererRef` and `canvasContextRef` must be populated before `setReady(true)` or `registerRegion` will be called with null refs.

### 6. GLASS-05: Resize Bind Group Refresh

After `engine.resize(w, h)`, C++ recreates the offscreen texture. The bind group in `GlassRenderer` is now stale — it holds a view of the destroyed texture. This is the GLASS-05 requirement.

In `GlassProvider`'s `ResizeObserver` handler, after `engine.resize(w, h)`:
```typescript
const newTexture = getSceneTexture(moduleRef.current!);
if (newTexture) rendererRef.current?.setSceneTexture(newTexture);
```

`setSceneTexture()` already calls `device.createBindGroup()` with the new texture view (implemented in Phase 16). No pipeline recreation needed.

---

## Architecture Patterns

### Recommended GlassProvider Structure (After Phase 17)

```
GlassProvider
  refs:
    moduleRef          -> EngineModule (WASM)
    deviceRef          -> GPUDevice
    rendererRef        -> GlassRenderer
    canvasContextRef   -> GPUCanvasContext
    canvasRef          -> HTMLCanvasElement

  effects:
    [1] init()         -> async: device + engine + renderer + sceneTexture + setReady(true)
    [2] render loop    -> rAF: engine.update → engine.renderBackground → renderer.render
    [3] resize         -> ResizeObserver: canvas resize → engine.resize → getSceneTexture → setSceneTexture
    [4] prefs sync     -> engine.setPaused(reducedMotion)
    [5] wallpaper      -> loadAndUploadWallpaper on ready
    [6] backgroundMode -> setBackgroundMode on prop change

  registerRegion:
    -> rendererRef.current.addRegion(element)
    -> return GlassRegionHandle closure over id

  contextValue:
    registerRegion, unregisterRegion, ready, preferences
```

### Render Loop Order (C8 compliance)

Single rAF callback — order is mandatory:
1. `engine.update(dt)` — advances noise/animation time
2. `engine.renderBackground()` — C++ submits background to GPU
3. `renderer.render(ctx, w, h, dt, dpr)` — JS submits glass pass to GPU

C++ must submit before JS reads the scene texture. The single-threaded rAF guarantees sequential submission ordering. Never split these into separate rAF callbacks.

### GlassRegionHandle — Closure Pattern

```typescript
// Source: GlassContext.ts interface contract
function makeHandle(id: number, renderer: GlassRenderer): GlassRegionHandle {
  return {
    id,
    updateRect: (_x, _y, _w, _h) => { /* DOM position read live in render() */ },
    updateParams: (cr, blur, op, refr) =>
      renderer.setRegionParams(id, cr, blur, op, refr),
    updateTint: (r, g, b) =>
      renderer.setRegionTint(id, r, g, b),
    // ... remaining setters
    remove: () => renderer.removeRegion(id),
  };
}
```

The closure captures `id` and `renderer` reference. Uses optional chain (`renderer?.method`) if renderer could be null after unmount — but since `remove()` should be called before GlassProvider tears down, this is a safety guard only.

### State Management — No React State for Uniforms

Shader parameters must NEVER be stored in React state (`useState`). They are stored in `GlassRegionState.target` inside `GlassRenderer`. Updates go directly from `handle.updateXxx()` → `renderer.setRegionXxx()` → mutation of `region.target`. React re-renders do NOT trigger uniform buffer writes — the rAF loop handles that unconditionally.

This is already the pattern in `useGlassRegion` (all updates happen in `useEffect` dependencies, not in render).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Uniform buffer writes | Custom GPUBuffer management | Already in `GlassRenderer.render()` via `device.queue.writeBuffer` with dynamic offsets |
| Morph lerp | Custom animation state machine | Already in `morphLerp()` in `GlassRegionState.ts` |
| Scene texture bridge | Manual texture copy / re-upload | `getSceneTexture(module)` in `loader.ts` uses `WebGPU.getJsObject()` — zero-copy |
| Bind group invalidation | Per-frame bind group recreation | `setSceneTexture()` already rebuilds bind group; call once after resize |
| Canvas context format | Hardcode `rgba8unorm` | `navigator.gpu.getPreferredCanvasFormat()` — already in GlassRenderer.init() |
| A11y parameter overrides | Duplicate a11y logic in GlassProvider | Already in `useGlassRegion` — nothing to add |

---

## Common Pitfalls

### Pitfall 1: setReady(true) Before GlassRenderer is Initialized

**What goes wrong:** `setReady(true)` fires before `renderer.init()` resolves. `registerRegion()` is called immediately by mounted `GlassPanel` components but `rendererRef.current` is null — `addRegion()` throws or returns undefined.

**How to avoid:** `setReady(true)` must be the LAST step in the init sequence, after both `await renderer.init()` and `renderer.setSceneTexture(sceneTexture)` complete.

**Warning sign:** `registerRegion` returns null silently (the existing stub behaviour) — verify it returns a real handle after Phase 17 by checking `handleRef.current !== null` in `useGlassRegion`.

### Pitfall 2: Missing Canvas Context Configuration

**What goes wrong:** `canvas.getContext('webgpu')` returns a context but `context.configure()` is not called before `renderer.render()`. `getCurrentTexture()` returns an error texture, causing a GPUValidationError.

**How to avoid:** Configure the canvas context explicitly before the first render:
```typescript
context.configure({ device, format: navigator.gpu.getPreferredCanvasFormat(), alphaMode: 'opaque' });
```
This was done inside `createBlitResources()` (now deleted). Ensure the configure call moves to the new init sequence in `GlassProvider`.

### Pitfall 3: Stale Scene Texture After Resize (GLASS-05)

**What goes wrong:** Window is resized. `engine.resize(w, h)` is called. C++ destroys and recreates the offscreen texture. `GlassRenderer` still holds a `GPUTextureView` of the old (now destroyed) texture in `perFrameBindGroup`. Sampling a destroyed texture view produces a black/corrupted background.

**How to avoid:** In `ResizeObserver` callback, after `engine.resize()`:
```typescript
const tex = getSceneTexture(moduleRef.current!);
if (tex) rendererRef.current?.setSceneTexture(tex);
```
`setSceneTexture()` creates a new `perFrameBindGroup` with a fresh view.

**Warning sign:** Background turns black immediately after any resize event.

### Pitfall 4: Blit Resources Not Cleaned Up

**What goes wrong:** `BlitResources` (pipeline, sampler, bindGroupLayout, context) are allocated in `blitRef`. When replacing the blit with `GlassRenderer`, these GPU resources are orphaned and leak until page reload.

**How to avoid:** The `useEffect` that creates blit resources returns a cleanup function (`return () => { blitRef.current = null; }`). When removing the blit effect entirely, ensure `GPURenderPipeline` and `GPUSampler` from the old blit are not referenced. Since these are JS-side objects, GC handles them once no references remain — but verify `blitRef.current` is set to null before the effect cleanup returns.

### Pitfall 5: updateRect No-Op Confusion

**What goes wrong:** `useGlassRegion` calls `handle.updateRect(x, y, w, h)` but the GlassRenderer reads `getBoundingClientRect()` live every frame regardless. If `updateRect` writes to `region.target.rect`, the morph lerp will fight the live DOM position, causing jitter.

**How to avoid:** `updateRect` on `GlassRegionHandle` should be a documented no-op in the JS implementation. `GlassRenderer.render()` is authoritative for rect — it reads the live DOM position directly and writes it to `region.current.rect` (bypassing lerp). Do NOT lerp the rect.

**Note:** `useGlassRegion` does NOT currently call `updateRect` — rect is inferred from the element by the renderer. But `GlassRegionHandle` has the method to satisfy the type contract. Implement it as an explicit no-op with a comment.

### Pitfall 6: GlassRenderer.init() Called Twice (React StrictMode)

**What goes wrong:** React 19 StrictMode double-invokes effects in development. The `useEffect` that calls `renderer.init()` runs twice. The first `GlassRenderer` instance starts a rAF loop; the second instance starts another. Two pipelines compete for the same canvas context.

**How to avoid:** The existing `cancelled` guard pattern in `GlassProvider` already handles this:
```typescript
let cancelled = false;
// ... async init ...
if (cancelled) { renderer.destroy(); device.destroy(); return; }
```
Ensure `renderer.destroy()` is called on the cancelled path, and the `useEffect` cleanup calls `renderer.destroy()` followed by `device.destroy()` in that order (C1 handle lifetime rule).

---

## Code Examples

### Setter Methods to Add to GlassRenderer

```typescript
// Source: GlassRegionState.ts target field pattern
setRegionParams(id: number, cornerRadius: number, blur: number, opacity: number, refraction: number): void {
  const region = this.regions.get(id);
  if (!region) return;
  region.target.cornerRadius = cornerRadius;
  region.target.blurIntensity = blur;
  region.target.opacity = opacity;
  region.target.refractionStrength = refraction;
}

setRegionTint(id: number, r: number, g: number, b: number): void {
  const region = this.regions.get(id);
  if (!region) return;
  region.target.tint = { r, g, b };
}

setRegionMorphSpeed(id: number, speed: number): void {
  const region = this.regions.get(id);
  if (!region) return;
  region.morphSpeed = speed; // on GlassRegionState, not GlassUniforms
}

setRegionAberration(id: number, v: number): void { this.regions.get(id) && (this.regions.get(id)!.target.aberration = v); }
setRegionSpecular(id: number, v: number): void { this.regions.get(id) && (this.regions.get(id)!.target.specularIntensity = v); }
setRegionRim(id: number, v: number): void { this.regions.get(id) && (this.regions.get(id)!.target.rimIntensity = v); }
setRegionMode(id: number, v: number): void { this.regions.get(id) && (this.regions.get(id)!.target.mode = v); }
setRegionContrast(id: number, v: number): void { this.regions.get(id) && (this.regions.get(id)!.target.contrast = v); }
setRegionSaturation(id: number, v: number): void { this.regions.get(id) && (this.regions.get(id)!.target.saturation = v); }
setRegionBlurRadius(id: number, v: number): void { this.regions.get(id) && (this.regions.get(id)!.target.blurRadius = v); }
setRegionFresnelIOR(id: number, v: number): void { this.regions.get(id) && (this.regions.get(id)!.target.fresnelIOR = v); }
setRegionFresnelExponent(id: number, v: number): void { this.regions.get(id) && (this.regions.get(id)!.target.fresnelExponent = v); }
setRegionEnvReflectionStrength(id: number, v: number): void { this.regions.get(id) && (this.regions.get(id)!.target.envReflectionStrength = v); }
setRegionGlareAngle(id: number, v: number): void { this.regions.get(id) && (this.regions.get(id)!.target.glareAngle = v); }
```

### GlassProvider Init Sequence

```typescript
// Source: GlassProvider.tsx async init effect — Phase 17 target
(async () => {
  if (!navigator.gpu) { console.error('WebGPU not supported'); return; }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter || cancelled) return;
  const device = await adapter.requestDevice();
  if (cancelled) { device.destroy(); return; }

  const module = await initEngine(device);
  if (cancelled) { module.destroyEngine(); device.destroy(); return; }

  while (!module.getEngine()) {
    if (cancelled) { module.destroyEngine(); device.destroy(); return; }
    await new Promise(r => setTimeout(r, 50));
  }

  const format = navigator.gpu.getPreferredCanvasFormat();
  const renderer = new GlassRenderer();
  await renderer.init(device, format);
  if (cancelled) { renderer.destroy(); module.destroyEngine(); device.destroy(); return; }

  const sceneTexture = getSceneTexture(module);
  if (!sceneTexture) { renderer.destroy(); module.destroyEngine(); device.destroy(); return; }
  renderer.setSceneTexture(sceneTexture);

  // Configure canvas context ONCE
  const canvas = canvasRef.current!;
  const context = canvas.getContext('webgpu')!;
  context.configure({ device, format, alphaMode: 'opaque' });

  moduleRef.current = module;
  deviceRef.current = device;
  rendererRef.current = renderer;
  canvasContextRef.current = context;
  if (engineRef) engineRef.current = module;
  setReady(true);  // Last step: React components may now call registerRegion()
})();
```

### Render Loop (Phase 17)

```typescript
// Source: GlassProvider.tsx rAF effect — replaces blit
const loop = (now: number) => {
  const dt = lastTime === 0 ? 0 : Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  const module = moduleRef.current;
  const engine = module?.getEngine();
  const renderer = rendererRef.current;
  const ctx = canvasContextRef.current;
  const canvas = canvasRef.current;

  if (engine && renderer && ctx && canvas) {
    engine.update(dt);
    engine.renderBackground();   // C++ submits background — must precede glass pass
    renderer.render(ctx, canvas.width, canvas.height, dt, devicePixelRatio);
  }
  rafId = requestAnimationFrame(loop);
};
```

### ResizeObserver with GLASS-05 Scene Texture Refresh

```typescript
// Source: GlassProvider.tsx ResizeObserver — add setSceneTexture after resize
const observer = new ResizeObserver((entries) => {
  const engine = moduleRef.current?.getEngine();
  const renderer = rendererRef.current;
  if (!engine) return;
  for (const entry of entries) {
    const width = entry.devicePixelContentBoxSize?.[0].inlineSize
      ?? Math.round(entry.contentBoxSize[0].inlineSize * devicePixelRatio);
    const height = entry.devicePixelContentBoxSize?.[0].blockSize
      ?? Math.round(entry.contentBoxSize[0].blockSize * devicePixelRatio);
    const w = Math.max(1, Math.min(width, 4096));
    const h = Math.max(1, Math.min(height, 4096));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      engine.resize(w, h);
      // GLASS-05: C++ recreated offscreen texture — refresh renderer bind group
      const newTex = getSceneTexture(moduleRef.current!);
      if (newTex && renderer) renderer.setSceneTexture(newTex);
    }
  }
  engine.setDpr(devicePixelRatio);
});
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.1 |
| Config file | `vitest.config.ts` — `src/**/__tests__/**/*.test.ts`, environment: node |
| Quick run command | `npm test` |
| Full suite command | `npm test && npm run test:e2e` |
| E2E framework | Playwright ^1.58.2 |
| E2E config | `playwright.config.ts` (root) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REACT-01 | GlassRenderer setters mutate target uniforms correctly | unit | `npm test -- --reporter=verbose src/renderer/__tests__/` | Partial — uniforms.test.ts exists, setter tests need Wave 0 additions |
| REACT-01 | registerRegion returns a live GlassRegionHandle (not null) | unit | `npm test -- src/renderer/__tests__/` | No — Wave 0 |
| REACT-02 | GlassPanel, GlassButton, GlassCard props compile unchanged | type-check | `npx tsc --noEmit` | Yes (tsc already runs in CI) |
| REACT-03 | All 16 props flow through to GlassUniforms fields end-to-end | unit | `npm test -- src/renderer/__tests__/` | No — Wave 0 |
| REACT-04 | Reduced-transparency path zeros blur/refraction/effects | unit | `npm test -- src/renderer/__tests__/` | No — Wave 0 |
| REACT-04 | Reduced-motion pauses engine | smoke | `npm run test:e2e` | Partial — e2e spec exists |
| GLASS-05 | setSceneTexture creates new bind group (no crash after resize) | unit | `npm test -- src/renderer/__tests__/` | No — Wave 0 (needs mock GPUDevice) |
| Visual smoke | Glass renders visible (non-black) over background | e2e screenshot | `npm run test:e2e` | Partial — screenshot dir exists |

### Playwright Screenshot Verification

The `e2e/` directory already has `glass-renderer.spec.ts` and a `screenshots/` folder. Phase 17 must add or extend an E2E test that:
1. Loads the demo app
2. Waits for `ready` state (poll for non-black canvas or presence of glass element)
3. Takes a screenshot and compares against a baseline
4. Verifies the GlassPanel is visible (non-transparent background)

This is explicitly required per the phase description: "Include Playwright screenshot verification in plans, not just human checkpoints."

### Sampling Rate

- **Per task commit:** `npm test` (vitest unit tests, ~2s)
- **Per wave merge:** `npm test && npx tsc --noEmit`
- **Phase gate:** `npm test && npm run test:e2e` — both must pass green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/renderer/__tests__/region-setters.test.ts` — unit tests for all 14 `setRegionXxx` methods on `GlassRenderer` (verify target field mutation, guard against unknown id)
- [ ] `src/renderer/__tests__/handle-factory.test.ts` — verify `registerRegion` returns a non-null `GlassRegionHandle` with correct `id`, and that `handle.remove()` causes `renderer.regions` to no longer contain the id
- [ ] `e2e/glass-renderer.spec.ts` — extend with a screenshot assertion that glass renders visibly over background (non-black canvas after 2s render)
- [ ] Verify `vitest.config.ts` glob covers any new test filenames (currently `src/**/__tests__/**/*.test.ts` — already covers new files)

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| C++ embind calls for each region parameter | Direct TypeScript method calls on GlassRenderer | No WASM boundary crossing for glass params |
| C++ owns GPUDevice | JS owns GPUDevice, C++ receives handle | Established in Phase 15 |
| Temporary blit pass (BLIT_WGSL) | GlassRenderer.render() with full glass pipeline | Phase 17 completes the replacement |
| registerRegion returns null stub | registerRegion returns live GlassRegionHandle | Core deliverable of Phase 17 |

---

## Open Questions

1. **updateRect no-op vs. hint**
   - What we know: `GlassRenderer.render()` reads `getBoundingClientRect()` live every frame — authoritative
   - What's unclear: Should `handle.updateRect(x, y, w, h)` be a pure no-op, or should it write a hint to `region.target.rect` that gets overwritten by the live read?
   - Recommendation: Pure no-op with an explicit comment. The live DOM read is cheaper and more accurate than any hint. Writing to `target.rect` would cause morph lerp to fight the live position.

2. **GlassProvider canvas context unconfigure on unmount**
   - What we know: `context.configure()` is called once at init; `context.unconfigure()` exists in WebGPU spec
   - What's unclear: Whether not calling `unconfigure()` before `device.destroy()` causes validation errors
   - Recommendation: Call `context.unconfigure()` in the cleanup return of the init `useEffect`, before `device.destroy()`, after `renderer.destroy()` and `module.destroyEngine()`. This is belt-and-suspenders — the device destroy should handle it, but explicit cleanup matches the project pattern.

3. **canvasRef availability at init time**
   - What we know: `canvasRef` is attached to the `<canvas>` element rendered by `GlassProvider`; the `useEffect` for init has `[]` deps
   - What's unclear: In edge cases (e.g., React concurrent mode), is `canvasRef.current` guaranteed non-null when the init `useEffect` runs?
   - Recommendation: Guard `if (!canvasRef.current) return;` at the top of the async init IIFE, same as the current `if (!navigator.gpu)` guard. In practice, the canvas is a static child element so it is always mounted before effects run.

---

## Sources

### Primary (HIGH confidence)

- `/Users/asekar/code/glass-react/src/renderer/GlassRenderer.ts` — Phase 16 output; defines existing API surface and what methods are missing
- `/Users/asekar/code/glass-react/src/renderer/GlassRegionState.ts` — `GlassUniforms` field list; maps to `GlassRegionHandle` methods
- `/Users/asekar/code/glass-react/src/context/GlassContext.ts` — frozen `GlassRegionHandle` interface; authoritative list of 17 update methods
- `/Users/asekar/code/glass-react/src/hooks/useGlassRegion.ts` — caller of all 17 handle methods; defines which fields are used and with what defaults
- `/Users/asekar/code/glass-react/src/components/GlassProvider.tsx` — current state with blit pass and null `registerRegion` stub
- `/Users/asekar/code/glass-react/src/wasm/loader.ts` — `getSceneTexture()` already written; confirms bridge is complete
- `.planning/research/ARCHITECTURE.md` — Phase 3 wiring plan, data flows, cleanup order

### Secondary (MEDIUM confidence)

- `.planning/research/PITFALLS.md` — C1 (handle lifetime/cleanup order), C8 (render loop ordering) directly apply
- `.planning/research/SUMMARY.md` — canvas surface ownership gap flagged; confirmed resolved by `GPUCanvasContext` in `GlassProvider`

### Tertiary (LOW confidence)

- None — all significant findings have primary backing from codebase analysis

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages; all APIs already in use
- Architecture: HIGH — GlassRenderer API is fully known from Phase 16 source; wiring points are enumerated
- Pitfalls: HIGH — all pitfalls derive from Phase 15/16 code analysis + project-level pitfalls research

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable APIs; no fast-moving dependencies)
