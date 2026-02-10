# Phase 5: React Component API - Research

**Researched:** 2026-02-10
**Domain:** React component architecture, multi-region GPU rendering, DOM-to-GPU synchronization
**Confidence:** HIGH

## Summary

Phase 5 transforms the single-region glass engine into a multi-component React library. The current engine renders exactly one glass rectangle with one set of uniforms. The core challenge is threefold: (1) the C++ engine must support an arbitrary number of glass regions, each with independent parameters, (2) React components must track their DOM positions and relay normalized coordinates to the GPU, and (3) this DOM-to-GPU synchronization must happen every frame without layout thrashing.

The recommended architecture uses a **dynamic uniform buffer with offset-based draw calls** in C++ (one draw call per glass region, same pipeline, different uniform offset), a **React Context provider** that owns the WASM module and engine lifecycle, and **individual glass components** that register/unregister themselves with the engine and use `getBoundingClientRect` in a batched `requestAnimationFrame` loop to track their positions.

**Primary recommendation:** Use dynamic uniform buffers for multi-region rendering, React Context for engine lifecycle, and a single rAF-batched position sync loop rather than per-component observers.

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.0.0 | Component framework | Already installed, React 19 simplifies Context and ref patterns |
| react-dom | ^19.0.0 | DOM rendering | Already installed |
| TypeScript | ^5.7.0 | Type safety + JSDoc | Already installed |

### Supporting (no new dependencies needed)
| API | Built-in | Purpose | When to Use |
|-----|----------|---------|-------------|
| `createContext` / `useContext` | React 19 | Engine lifecycle sharing | GlassProvider + all glass components |
| `useLayoutEffect` | React 19 | DOM measurement after render | Initial position measurement |
| `useRef` | React 19 | DOM element references | Glass component DOM nodes |
| `getBoundingClientRect` | Browser API | Position tracking | Converting DOM positions to normalized UV coords |
| `ResizeObserver` | Browser API | Canvas resize handling | Already used in App.tsx |
| `requestAnimationFrame` | Browser API | Position sync batching | Batch all component position reads per frame |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Dynamic uniform buffer offsets | Storage buffer + instanced draw | Storage buffer is simpler WGSL but dynamic offsets reuse existing pipeline pattern; storage buffer would require pipeline changes |
| rAF-batched position polling | Per-component ResizeObserver | ResizeObserver does not track position (only size), still need getBoundingClientRect for position; rAF batching avoids layout thrashing |
| Per-component draw calls | Single instanced draw | Instancing requires shader changes and storage buffers; per-component draw calls with dynamic offsets require zero shader changes to the existing fullscreen triangle approach |

**Installation:**
```bash
# No new packages needed -- everything uses React 19 built-ins and browser APIs
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── main.tsx                    # Entry point (existing)
├── App.tsx                     # Demo app (refactored to use GlassProvider)
├── wasm/
│   └── loader.ts               # WASM loading (existing, extended)
├── components/
│   ├── GlassProvider.tsx        # Context provider: owns engine lifecycle
│   ├── GlassPanel.tsx           # Generic glass container (<div> wrapper)
│   ├── GlassButton.tsx          # Glass button (<button> wrapper)
│   ├── GlassCard.tsx            # Glass card (semantic <article> wrapper)
│   └── types.ts                 # Shared prop types + JSDoc
├── hooks/
│   ├── useGlassEngine.ts        # Internal: access engine from context
│   └── useGlassRegion.ts        # Internal: register region + sync position
└── context/
    └── GlassContext.ts           # Context definition (separate from provider)
```

### Pattern 1: GlassProvider Context Architecture

**What:** A React Context provider that initializes the WASM engine, manages its lifecycle, and exposes a registration API for glass components.

**When to use:** Wrap the entire app (or the subtree that needs glass effects).

**Design:**
```typescript
// context/GlassContext.ts
import { createContext } from 'react';

interface GlassRegionHandle {
  id: number;
  updateRect(x: number, y: number, w: number, h: number): void;
  updateParams(cornerRadius: number, blur: number, opacity: number, refraction: number): void;
  updateTint(r: number, g: number, b: number): void;
  remove(): void;
}

interface GlassContextValue {
  registerRegion(): GlassRegionHandle | null;
  canvasRect: DOMRect | null;  // Canvas position for coordinate conversion
  ready: boolean;
}

export const GlassContext = createContext<GlassContextValue | null>(null);
```

```typescript
// components/GlassProvider.tsx -- React 19 syntax (no .Provider)
function GlassProvider({ children }: { children: React.ReactNode }) {
  // ... init engine, track canvas rect, expose registration
  return (
    <GlassContext value={contextValue}>
      {children}
    </GlassContext>
  );
}
```

**Key insight (React 19):** Use `<GlassContext value={...}>` directly -- the `.Provider` pattern is deprecated in React 19. Source: [React docs](https://react.dev/reference/react/createContext)

### Pattern 2: Region Registration + Lifecycle

**What:** Each glass component registers a "region" with the engine on mount and removes it on unmount. The engine manages an array of glass regions.

**When to use:** Every GlassPanel/GlassButton/GlassCard component.

**Design:**
```typescript
// hooks/useGlassRegion.ts
function useGlassRegion(
  ref: React.RefObject<HTMLElement>,
  props: GlassStyleProps
) {
  const ctx = useContext(GlassContext);
  const handleRef = useRef<GlassRegionHandle | null>(null);

  // Register on mount, remove on unmount
  useEffect(() => {
    if (!ctx?.ready) return;
    const handle = ctx.registerRegion();
    handleRef.current = handle;
    return () => {
      handle?.remove();
      handleRef.current = null;
    };
  }, [ctx?.ready]);

  // Sync props to engine when they change
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    handle.updateParams(
      props.cornerRadius ?? 24,
      props.blur ?? 0.5,
      props.opacity ?? 0.05,
      props.refraction ?? 0.15
    );
    if (props.tint) {
      handle.updateTint(props.tint[0], props.tint[1], props.tint[2]);
    }
  }, [props.cornerRadius, props.blur, props.opacity, props.refraction, props.tint]);

  // Position sync is handled by the GlassProvider's rAF loop
  // (see Pattern 3 below)
}
```

### Pattern 3: Batched Position Synchronization

**What:** A single `requestAnimationFrame` loop in GlassProvider reads all registered component positions in one batch and pushes normalized coordinates to the engine. This avoids per-component layout thrashing.

**When to use:** Always -- this is the only safe way to sync DOM positions to GPU.

**Why not per-component observers:** `ResizeObserver` only tracks size, not position. `getBoundingClientRect` causes layout reads. Multiple independent reads cause layout thrashing. A single batched read per frame is optimal.

**Design:**
```typescript
// Inside GlassProvider
const regionsRef = useRef<Map<number, { element: HTMLElement; handle: GlassRegionHandle }>>();

useEffect(() => {
  let rafId: number;
  const syncPositions = () => {
    const canvasEl = document.getElementById('gpu-canvas');
    if (!canvasEl) { rafId = requestAnimationFrame(syncPositions); return; }
    const canvasRect = canvasEl.getBoundingClientRect();

    // Single batch read of all component positions
    for (const [, region] of regionsRef.current) {
      const rect = region.element.getBoundingClientRect();
      // Convert viewport pixels to normalized [0,1] UV coordinates relative to canvas
      const x = (rect.left - canvasRect.left) / canvasRect.width;
      const y = (rect.top - canvasRect.top) / canvasRect.height;
      const w = rect.width / canvasRect.width;
      const h = rect.height / canvasRect.height;
      region.handle.updateRect(x, y, w, h);
    }
    rafId = requestAnimationFrame(syncPositions);
  };
  rafId = requestAnimationFrame(syncPositions);
  return () => cancelAnimationFrame(rafId);
}, []);
```

### Pattern 4: Ref as Prop (React 19)

**What:** In React 19, `forwardRef` is deprecated. Components accept `ref` as a regular prop.

**When to use:** All glass components need to accept a `ref` prop so users can access the underlying DOM element.

**Design:**
```typescript
// React 19: ref is a regular prop, no forwardRef needed
interface GlassPanelProps extends GlassStyleProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  ref?: React.Ref<HTMLDivElement>;
}

function GlassPanel({ children, ref, ...props }: GlassPanelProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  // Merge refs: internal ref for position tracking, external ref for user
  // ...
  return <div ref={mergedRef} {...rest}>{children}</div>;
}
```

Source: [React 19 blog post](https://react.dev/blog/2024/12/05/react-19), [forwardRef docs](https://react.dev/reference/react/forwardRef)

### Anti-Patterns to Avoid
- **Per-component rAF loops:** Each glass component running its own requestAnimationFrame creates N independent loops instead of one batched loop. Causes layout thrashing with multiple getBoundingClientRect calls per frame.
- **useLayoutEffect for continuous position tracking:** useLayoutEffect blocks painting. Use it only for initial measurement, not continuous tracking. Use rAF for ongoing sync.
- **Storing engine module in React state:** The WASM module is a mutable external resource. Store in `useRef`, not `useState`. Putting it in state triggers unnecessary re-renders.
- **Creating bind groups per frame:** GPU bind group creation allocates memory. Use dynamic uniform buffer offsets to reuse a single bind group across all draw calls.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ref merging (internal + external) | Manual ref assignment logic | A small `useMergedRef` helper (15 lines) | Edge cases with callback refs, cleanup refs in React 19 |
| Position normalization | Inline math in each component | Centralized `normalizeRect(elementRect, canvasRect)` utility | DRY, testable, handles edge cases (canvas offset, DPR) |
| Engine region ID generation | Random IDs or UUID | Simple incrementing counter in provider | Deterministic, no dependencies, guaranteed unique within session |
| Component variant styling | Separate shader per component type | Same glass shader, different default props per component | GlassPanel/Button/Card differ only in HTML semantics and default params, not rendering |

**Key insight:** GlassPanel, GlassButton, and GlassCard are NOT different renderers. They are the same glass effect applied to different HTML elements (`<div>`, `<button>`, `<article>`) with different default style props. The shader is identical.

## Common Pitfalls

### Pitfall 1: Layout Thrashing from getBoundingClientRect
**What goes wrong:** Calling getBoundingClientRect on multiple elements in separate microtasks forces the browser to recalculate layout each time.
**Why it happens:** Each getBoundingClientRect triggers a synchronous reflow if the DOM is dirty.
**How to avoid:** Batch all reads into a single requestAnimationFrame callback. Read all positions first, then write all updates to the engine.
**Warning signs:** Janky scrolling, high "Layout" time in DevTools Performance panel.

### Pitfall 2: Dynamic Uniform Buffer Alignment
**What goes wrong:** GPU validation error when dynamic offset is not aligned to `minUniformBufferOffsetAlignment`.
**Why it happens:** GlassUniforms is 64 bytes, but the minimum alignment is typically 256 bytes (can be as low as 32). Each region's uniforms must start at an aligned offset.
**How to avoid:** Query `device.GetLimits()` at init time. Compute stride as `ceilToNextMultiple(sizeof(GlassUniforms), minUniformBufferOffsetAlignment)`. Allocate buffer as `stride * maxRegions`.
**Warning signs:** WebGPU validation error mentioning "offset alignment".

### Pitfall 3: Stale Region Handles After Unmount
**What goes wrong:** A glass component unmounts but its region handle still references freed memory or an invalid slot.
**Why it happens:** React's effect cleanup runs asynchronously. The engine may render a frame between unmount and cleanup.
**How to avoid:** Mark regions as "inactive" immediately in the remove() call. The engine skips inactive regions during rendering. Actual slot reclamation can happen lazily.
**Warning signs:** Visual glitches (ghost rectangles), or use-after-free in C++ (crash/UB).

### Pitfall 4: Canvas Coordinate System Mismatch
**What goes wrong:** Glass regions appear at wrong positions or are scaled incorrectly.
**Why it happens:** getBoundingClientRect returns CSS pixels. The canvas may have a different resolution due to `devicePixelRatio`. The existing engine uses normalized [0,1] UV coordinates.
**How to avoid:** Convert from CSS pixels to normalized coordinates using the canvas's CSS bounding rect (not canvas.width/height which are in device pixels). The formula: `normalizedX = (elementRect.left - canvasRect.left) / canvasRect.width`.
**Warning signs:** Glass regions offset or scaled by ~2x on Retina displays.

### Pitfall 5: Engine Not Ready When Components Mount
**What goes wrong:** Glass components try to register regions before the WASM engine has initialized.
**Why it happens:** WASM loading is async. Components may mount before `initEngine()` resolves.
**How to avoid:** The GlassProvider tracks a `ready` state. Components check `ready` before registering. Use an effect that re-runs when `ready` changes from false to true.
**Warning signs:** Null pointer access in C++, or silent failures where regions never register.

### Pitfall 6: Glass Uniform Buffer Too Small
**What goes wrong:** Adding more glass components than the buffer can hold causes out-of-bounds writes.
**Why it happens:** Fixed-size uniform buffer allocated for N regions, but app uses N+1.
**How to avoid:** Either (a) set a reasonable max (e.g., 16 or 32 regions) and warn when exceeded, or (b) reallocate the buffer when capacity is exceeded. Option (a) is simpler and sufficient for a UI library.
**Warning signs:** WebGPU validation errors about buffer size, or visual corruption.

## Code Examples

### C++ Multi-Region Engine Extension

The key change is moving from a single `GlassUniforms glassUniforms` to an array, and using dynamic uniform buffer offsets.

```cpp
// Source: Adapted from LearnWebGPU dynamic uniforms pattern
// https://eliemichel.github.io/LearnWebGPU/basic-3d-rendering/shader-uniforms/dynamic-uniforms.html

// In background_engine.h:
static constexpr uint32_t MAX_GLASS_REGIONS = 16;

struct GlassRegion {
    GlassUniforms uniforms{};
    bool active = false;
};

// New members:
uint32_t uniformStride = 0;           // Aligned stride between regions
wgpu::Buffer glassUniformBuffer;      // Sized for MAX_GLASS_REGIONS * uniformStride
GlassRegion regions[MAX_GLASS_REGIONS]{};

// In init():
wgpu::SupportedLimits limits;
device.GetLimits(&limits);
uniformStride = ceilToNextMultiple(
    (uint32_t)sizeof(GlassUniforms),
    (uint32_t)limits.limits.minUniformBufferOffsetAlignment
);
// Buffer size: stride * MAX_GLASS_REGIONS
wgpu::BufferDescriptor bufDesc{};
bufDesc.size = uniformStride * MAX_GLASS_REGIONS;
bufDesc.usage = wgpu::BufferUsage::CopyDst | wgpu::BufferUsage::Uniform;
glassUniformBuffer = device.CreateBuffer(&bufDesc);

// In render() -- glass pass:
for (uint32_t i = 0; i < MAX_GLASS_REGIONS; i++) {
    if (!regions[i].active) continue;
    // Upload this region's uniforms at its aligned offset
    regions[i].uniforms.resolutionX = static_cast<float>(width);
    regions[i].uniforms.resolutionY = static_cast<float>(height);
    device.GetQueue().WriteBuffer(
        glassUniformBuffer,
        i * uniformStride,
        &regions[i].uniforms,
        sizeof(GlassUniforms)
    );
    // Draw with dynamic offset
    uint32_t dynamicOffset = i * uniformStride;
    pass.SetBindGroup(0, glassBindGroup, 1, &dynamicOffset);
    pass.Draw(3);
}
```

### Embind API for Multi-Region Management

```cpp
// Source: Emscripten Embind documentation
// https://emscripten.org/docs/porting/connecting_cpp_and_javascript/embind.html

// New C++ API functions:
int addGlassRegion();         // Returns region ID (0-15), or -1 if full
void removeGlassRegion(int id);
void setRegionRect(int id, float x, float y, float w, float h);
void setRegionParams(int id, float cornerRadius, float blur, float opacity, float refraction);
void setRegionTint(int id, float r, float g, float b);

// Embind bindings:
EMSCRIPTEN_BINDINGS(background_engine) {
    emscripten::function("getEngine", &getEngine, emscripten::allow_raw_pointers());
    emscripten::function("destroyEngine", &destroyEngine);
    emscripten::class_<BackgroundEngine>("BackgroundEngine")
        .function("resize", &BackgroundEngine::resize)
        .function("addGlassRegion", &BackgroundEngine::addGlassRegion)
        .function("removeGlassRegion", &BackgroundEngine::removeGlassRegion)
        .function("setRegionRect", &BackgroundEngine::setRegionRect)
        .function("setRegionParams", &BackgroundEngine::setRegionParams)
        .function("setRegionTint", &BackgroundEngine::setRegionTint);
}
```

### Bind Group Layout with Dynamic Offset

```cpp
// Source: WebGPU spec + LearnWebGPU
// The ONLY change to the existing bind group layout:
entries[2].buffer.hasDynamicOffset = true;  // Was implicitly false

// The existing bind group creation stays the same.
// The existing glass shader stays the same -- it reads from var<uniform> as before.
// The only difference is that the offset is set dynamically per draw call.
```

### TypeScript Types with JSDoc

```typescript
// Source: Project requirements COMP-05

/** RGB color as a tuple of three numbers in [0, 1] range */
type GlassColor = [r: number, g: number, b: number];

/** Style props shared by all glass components */
interface GlassStyleProps {
  /** Blur intensity (0 = sharp, 1 = maximum frosted glass). Default: 0.5 */
  blur?: number;
  /** Opacity of the tint color (0 = transparent, 1 = fully tinted). Default: 0.05 */
  opacity?: number;
  /** Corner radius in CSS pixels. Default: 24 */
  cornerRadius?: number;
  /** Tint color as [R, G, B] in [0,1] range. Default: [1, 1, 1] (white) */
  tint?: GlassColor;
  /** Refraction strength at glass edges (0 = none, 0.3 = strong lens). Default: 0.15 */
  refraction?: number;
}

/** Props for the GlassPanel component */
interface GlassPanelProps extends GlassStyleProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  ref?: React.Ref<HTMLDivElement>;
}
```

### GlassProvider Implementation Skeleton

```typescript
// Source: React 19 Context API
// https://react.dev/reference/react/createContext

function GlassProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const moduleRef = useRef<EngineModule | null>(null);
  const regionsRef = useRef(new Map<number, RegisteredRegion>());
  const nextIdRef = useRef(0);

  // Initialize WASM engine
  useEffect(() => {
    let cancelled = false;
    initEngine().then(module => {
      if (cancelled) return;
      moduleRef.current = module;
      setReady(true);
    });
    return () => {
      cancelled = true;
      if (moduleRef.current) {
        moduleRef.current.destroyEngine();
        moduleRef.current = null;
      }
    };
  }, []);

  // rAF position sync loop
  useEffect(() => {
    if (!ready) return;
    let rafId: number;
    const sync = () => {
      // ... batch position reads (see Pattern 3 above)
      rafId = requestAnimationFrame(sync);
    };
    rafId = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(rafId);
  }, [ready]);

  const registerRegion = useCallback((): GlassRegionHandle | null => {
    const engine = moduleRef.current?.getEngine();
    if (!engine) return null;
    const id = engine.addGlassRegion();
    if (id < 0) return null;
    return {
      id,
      updateRect: (x, y, w, h) => engine.setRegionRect(id, x, y, w, h),
      updateParams: (cr, b, o, r) => engine.setRegionParams(id, cr, b, o, r),
      updateTint: (r, g, b) => engine.setRegionTint(id, r, g, b),
      remove: () => engine.removeGlassRegion(id),
    };
  }, [ready]);

  const contextValue = useMemo(() => ({
    registerRegion,
    ready,
  }), [registerRegion, ready]);

  return <GlassContext value={contextValue}>{children}</GlassContext>;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `<Context.Provider value={...}>` | `<Context value={...}>` | React 19 (Dec 2024) | `.Provider` deprecated, codemod available |
| `forwardRef(Component)` | `ref` as regular prop | React 19 (Dec 2024) | `forwardRef` deprecated, simpler component signatures |
| Per-object bind groups | Dynamic uniform buffer offsets | WebGPU spec stable | Significantly fewer GPU allocations for multi-object rendering |
| Single glass region (current) | Array of regions with dynamic offsets | This phase | Core engine architecture change |

**Deprecated/outdated:**
- `forwardRef`: Deprecated in React 19. Use `ref` as a regular prop instead.
- `Context.Provider`: Deprecated in React 19. Use `<Context value={...}>` directly.
- Single glass uniform buffer: Current engine design supports only one region. Must be replaced.

## Open Questions

1. **Maximum region count**
   - What we know: 16 regions should be more than sufficient for a UI library. Dynamic uniform buffer size = 256 * 16 = 4096 bytes, well within limits.
   - What's unclear: Should this be configurable via a prop on GlassProvider?
   - Recommendation: Hardcode to 16 for now. Add a `maxRegions` prop in Phase 8 if needed. 16 covers all reasonable UI scenarios.

2. **Glass component DOM structure**
   - What we know: Components need a real DOM element for position tracking. GlassPanel wraps a `<div>`, GlassButton wraps a `<button>`, GlassCard wraps an `<article>`.
   - What's unclear: Should the glass effect be visible as a CSS overlay on the element, or is it purely GPU-rendered on the canvas behind?
   - Recommendation: The glass effect renders on the fullscreen canvas (behind the DOM). The component's DOM element is positioned over it with `pointer-events: auto` and transparent/semi-transparent background. The canvas glass region visually aligns with the DOM element.

3. **Handling overlapping glass regions**
   - What we know: The current shader renders each region independently as a fullscreen triangle with SDF masking. Overlapping regions would overdraw.
   - What's unclear: Does the visual result of overlapping regions look acceptable, or do we need special compositing?
   - Recommendation: Accept overdraw for now. Overlapping glass regions will have a "double frosted" look which is actually physically plausible. Revisit in Phase 7 (Visual Polish) if needed.

4. **Old single-region API backward compatibility**
   - What we know: The current API has setGlassRect, setGlassParams, setGlassTint on BackgroundEngine.
   - What's unclear: Should we keep the old API alongside the new multi-region API?
   - Recommendation: Remove the old single-region API. Phase 4 was a stepping stone; Phase 5 replaces it entirely. No external consumers depend on the old API.

## Sources

### Primary (HIGH confidence)
- [React createContext docs](https://react.dev/reference/react/createContext) - React 19 Provider syntax, useContext API
- [React useLayoutEffect docs](https://react.dev/reference/react/useLayoutEffect) - When to use for DOM measurement
- [React 19 release blog](https://react.dev/blog/2024/12/05/react-19) - forwardRef deprecation, ref as prop, Context changes
- [Emscripten Embind docs](https://emscripten.org/docs/porting/connecting_cpp_and_javascript/embind.html) - value_object, register_vector, class bindings
- [LearnWebGPU: Dynamic Uniforms](https://eliemichel.github.io/LearnWebGPU/basic-3d-rendering/shader-uniforms/dynamic-uniforms.html) - Dynamic offset pattern with code examples
- [WebGPU Fundamentals: Storage Buffers](https://webgpufundamentals.org/webgpu/lessons/webgpu-storage-buffers.html) - Instanced rendering alternative

### Secondary (MEDIUM confidence)
- [Web3D Survey: minUniformBufferOffsetAlignment](https://web3dsurvey.com/webgpu/limits/minUniformBufferOffsetAlignment) - Typical alignment value is 256 bytes, minimum 32 across all platforms
- [MDN: getBoundingClientRect](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect) - Position tracking API
- [MDN: ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver) - Tracks size only, not position

### Tertiary (LOW confidence)
- None -- all findings verified against primary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - React 19 is already in use, no new dependencies needed. All patterns verified against official docs.
- Architecture: HIGH - Dynamic uniform buffer offsets are a well-documented WebGPU pattern. React Context is standard. Position sync via rAF is a known pattern.
- Pitfalls: HIGH - All pitfalls are derived from direct code analysis (alignment math, coordinate systems) and verified WebGPU documentation.
- Multi-region rendering: HIGH - The existing glass shader needs zero changes. Only the C++ host code and bind group layout need modification (hasDynamicOffset flag + draw loop).

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable -- React 19 and WebGPU are both released and stable)
