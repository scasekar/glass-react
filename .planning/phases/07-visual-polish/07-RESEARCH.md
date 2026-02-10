# Phase 7: Visual Polish - Research

**Researched:** 2026-02-10
**Domain:** WGSL shader effects (chromatic aberration, specular highlights, rim lighting, refraction modes), GPU-driven uniform interpolation for morphing transitions
**Confidence:** HIGH

## Summary

Phase 7 enhances existing glass shader effects and adds new visual capabilities. The critical discovery from codebase analysis is that **three of five requirements (GLASS-06, GLASS-07, GLASS-08) are already partially implemented in the shader** but not yet exposed to the React API layer. The current `glass.wgsl.h` shader already includes: per-channel UV scaling for chromatic aberration (with `aberration` uniform hardcoded to 3.0), directional Fresnel specular highlights with cool/warm color split from an upper-left light source, and a sharp rim glow at glass boundaries using `exp(-dist*dist/3.0)`. However, none of these effects have adjustable React props -- they are either hardcoded in the shader or baked into the C++ defaults with no Embind setter exposed to JavaScript.

The two genuinely new features are: (1) GLASS-09, multiple refraction modes, which requires adding a mode uniform that selects between "standard" (current SDF-based lens compression) and "prominent" (stronger displacement + wider blur + enhanced specular) behaviors in the shader; and (2) GLASS-10, morphing transitions, which requires CPU-side uniform interpolation in C++ so that parameter changes (rect, blur, opacity, refraction, aberration) animate smoothly rather than snapping instantly.

**Primary recommendation:** This phase splits into two natural plans: (Plan 1) Expose existing shader effects as adjustable parameters through the full C++ -> Embind -> TypeScript -> React prop pipeline, plus add refraction modes via a mode uniform; (Plan 2) Implement morphing transitions via C++ lerp-based uniform interpolation with configurable duration, plus React hover/active state handling.

## Standard Stack

### Core

No new libraries needed. Phase 7 is entirely shader modifications + C++ engine extensions + React prop additions using the existing stack.

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| WGSL | WebGPU spec | Shader language for enhanced glass effects | Already in use, only shader language for WebGPU |
| GlassUniforms struct | Existing | Uniform buffer for per-region parameters | Extend with new fields (mode, rim intensity, specular intensity) |
| Embind | Emscripten 4.0.16 | C++ to JS function binding | Already in use for all engine API |
| React props + useGlassRegion | React 19 | Expose parameters to component consumers | Existing pattern from Phase 5/6 |

### Supporting

| Component | Purpose | When to Use |
|-----------|---------|-------------|
| `mix()` WGSL builtin | Blend between refraction modes | Mode interpolation in shader |
| `smoothstep()` WGSL builtin | Edge-aware effect modulation | Already used for SDF masking |
| `exp()` WGSL builtin | Rim glow falloff | Already used in current shader |
| `emscripten_get_now()` | High-resolution timer for lerp | Already used in main loop delta time |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CPU-side lerp for morphing | Shader-side animated uniforms via time uniform | CPU lerp is simpler, doesn't require time uniform in glass shader, and allows React to control animation duration. Shader-side would need a target+current+speed triple per parameter. |
| Single mode uniform (int) | Separate shader pipelines per mode | Mode uniform with branching in shader is simpler, avoids pipeline switching overhead, and WGSL supports `select()` for branchless mode selection |
| Extending `setRegionParams` signature | New dedicated setter functions | New setters (e.g., `setRegionAberration`, `setRegionMode`) are cleaner than ever-growing parameter lists, and follow the principle of adding without breaking |
| 25-tap single-pass blur (current) | Dual-Kawase multi-pass blur | Dual-Kawase scales logarithmically and can achieve much larger blur radii. However, it requires multiple intermediate textures and render passes per glass region. The current 25-tap is sufficient for Phase 7; Kawase is a future optimization if larger blur is needed. |

## Architecture Patterns

### Current vs. Phase 7 Architecture

The render architecture does NOT change. Phase 7 modifies:
1. The `GlassUniforms` struct (add fields)
2. The `glass.wgsl.h` shader (enhance existing effects, add mode branching)
3. The C++ engine (add setters, add lerp interpolation)
4. The Embind bindings (expose new setters)
5. The TypeScript types + React props (expose to consumers)

```
engine/src/
  shaders/
    glass.wgsl.h           # MODIFIED: enhanced effects, mode uniform, lerp targets
  background_engine.h      # MODIFIED: new uniforms fields, lerp state, new setters
  background_engine.cpp    # MODIFIED: lerp logic in update(), new setter implementations
  main.cpp                 # MODIFIED: new Embind bindings
src/
  components/types.ts      # MODIFIED: new GlassStyleProps fields
  hooks/useGlassRegion.ts  # MODIFIED: pass new props to engine
  context/GlassContext.ts  # MODIFIED: new handle methods
  wasm/loader.ts           # MODIFIED: new engine interface methods
  components/GlassProvider.tsx  # MODIFIED: expose new handle methods
  components/GlassPanel.tsx     # MODIFIED: accept new props
  components/GlassButton.tsx    # MODIFIED: accept new props, hover/active states
  components/GlassCard.tsx      # MODIFIED: accept new props
  App.tsx                       # MODIFIED: demo new effects
```

### Pattern 1: Exposing Existing Shader Effects as Props

**What:** The shader already has chromatic aberration, specular, and rim lighting, but the parameters are hardcoded. The pattern is: (a) add the parameter to GlassUniforms if not already there, (b) add a C++ setter, (c) add Embind binding, (d) add to TypeScript interface, (e) add React prop.

**Current state of each effect:**

| Effect | In Shader? | In C++ Uniforms? | Has C++ Setter? | Has Embind? | Has TS Type? | Has React Prop? |
|--------|-----------|------------------|-----------------|-------------|-------------|-----------------|
| Chromatic aberration | Yes (lines 73-113) | Yes (`aberration` field) | No (hardcoded 3.0) | No | No | No |
| Specular highlights | Yes (lines 125-148) | No (hardcoded in shader) | No | No | No | No |
| Rim lighting | Yes (line 146) | No (hardcoded in shader) | No | No | No | No |
| Refraction mode | Partial (one mode) | No | No | No | No | No |

**Pipeline for each new parameter:**
```
GlassUniforms (C++ struct) -> WGSL struct -> C++ setter -> Embind -> TS interface -> React prop -> useGlassRegion
```

### Pattern 2: Refraction Mode via Uniform Integer

**What:** Add a `mode` field to GlassUniforms (0 = standard, 1 = prominent). The shader uses this to select between two refraction behaviors.

**Standard mode (current behavior):**
- `refractionStrength`: default 0.15
- `blurIntensity` drives 25-tap blur at `intensity * 8.0` texel radius
- Specular highlights at current intensity levels
- Subtle chromatic aberration

**Prominent mode (enhanced):**
- Stronger lens displacement: `refractionStrength` multiplied by ~1.8
- Enhanced specular: brighter cool/warm highlights (multiply by ~1.5)
- Wider rim glow: use `exp(-dist * dist / 6.0)` instead of `/3.0`
- More pronounced chromatic aberration: multiply aberration by ~1.5

**Implementation approach:** Use `select()` or arithmetic blending based on the mode uniform rather than `if/else` branches. This avoids WGSL divergent control flow issues and is more GPU-friendly.

```wgsl
// Mode-dependent multipliers (0 = standard, 1 = prominent)
let modeF = f32(glass.mode);
let refractionMul = mix(1.0, 1.8, modeF);
let specularMul = mix(1.0, 1.5, modeF);
let rimSpread = mix(3.0, 6.0, modeF);
let aberrationMul = mix(1.0, 1.5, modeF);
```

### Pattern 3: CPU-Side Lerp for Morphing Transitions

**What:** When any glass parameter changes (rect position/size, blur, opacity, refraction, aberration, specular, rim), the engine doesn't snap to the new value. Instead, it stores target values and lerps the current uniforms toward the targets each frame.

**Why CPU-side, not shader-side:**
1. The shader already runs per-pixel. Adding per-pixel time-based interpolation would require a time uniform AND previous-frame state, complicating the shader significantly.
2. CPU lerp happens once per region per frame (trivial cost) and produces a smooth uniform value that the shader consumes as-is.
3. React can control the duration via a prop, and the C++ engine implements the interpolation.

**Data structure:**
```cpp
struct GlassRegion {
    GlassUniforms current{};   // What the shader reads this frame
    GlassUniforms target{};    // Where parameters are heading
    float morphSpeed = 8.0f;   // Lerp speed (higher = faster). 0 = instant.
    bool active = false;
};
```

**Update logic (per frame, per region):**
```cpp
void BackgroundEngine::update(float deltaTime) {
    // ... existing time update ...
    for (uint32_t i = 0; i < MAX_GLASS_REGIONS; i++) {
        if (!regions[i].active) continue;
        if (regions[i].morphSpeed <= 0.0f) {
            regions[i].current = regions[i].target;
        } else {
            float t = 1.0f - expf(-regions[i].morphSpeed * deltaTime);
            lerpUniforms(regions[i].current, regions[i].target, t);
        }
    }
}
```

**Why exponential decay (`1 - exp(-speed * dt)`) instead of linear lerp:**
- Frame-rate independent: same visual result at 30 FPS and 144 FPS
- No overshoot: asymptotically approaches target
- No duration tracking needed: no "animation start time" or "animation complete" state machine
- Natural feel: fast start, smooth deceleration (like spring-damper)

**Lerp function:**
```cpp
void lerpUniforms(GlassUniforms& current, const GlassUniforms& target, float t) {
    current.rectX = current.rectX + (target.rectX - current.rectX) * t;
    current.rectY = current.rectY + (target.rectY - current.rectY) * t;
    current.rectW = current.rectW + (target.rectW - current.rectW) * t;
    current.rectH = current.rectH + (target.rectH - current.rectH) * t;
    current.cornerRadius = current.cornerRadius + (target.cornerRadius - current.cornerRadius) * t;
    current.blurIntensity = current.blurIntensity + (target.blurIntensity - current.blurIntensity) * t;
    current.opacity = current.opacity + (target.opacity - current.opacity) * t;
    current.refractionStrength = current.refractionStrength + (target.refractionStrength - current.refractionStrength) * t;
    current.aberration = current.aberration + (target.aberration - current.aberration) * t;
    current.tintR = current.tintR + (target.tintR - current.tintR) * t;
    current.tintG = current.tintG + (target.tintG - current.tintG) * t;
    current.tintB = current.tintB + (target.tintB - current.tintB) * t;
    // specularIntensity, rimIntensity, mode also lerped for smooth transitions
}
```

### Pattern 4: React Hover/Active State Handling for Morphing

**What:** GlassButton (and optionally other components) detect hover and active (pressed) states via React event handlers and adjust glass parameters to trigger morphing.

**Implementation:**
```typescript
// In GlassButton:
const [hovered, setHovered] = useState(false);
const [pressed, setPressed] = useState(false);

// Derive effective parameters from state:
const effectiveBlur = pressed ? (blur ?? 0.5) * 0.3
                    : hovered ? (blur ?? 0.5) * 0.8
                    : blur ?? 0.5;
const effectiveRefraction = hovered ? (refraction ?? 0.15) * 1.3
                          : refraction ?? 0.15;
const effectiveAberration = hovered ? (aberration ?? 3.0) * 1.5
                          : aberration ?? 3.0;

// Pass to useGlassRegion -- engine lerps smoothly
useGlassRegion(internalRef, {
  blur: effectiveBlur,
  refraction: effectiveRefraction,
  aberration: effectiveAberration,
  // ...
});
```

The morphing animation happens automatically because the C++ engine lerps all parameter changes. React just sets new target values; the engine smoothly animates to them.

### Anti-Patterns to Avoid

- **CSS transitions on glass parameters:** The glass effect is GPU-rendered on a WebGPU canvas. CSS transitions only affect DOM properties. Never try to animate glass parameters via CSS -- always use the C++ lerp system.
- **Snapping the mode uniform:** Switching mode from 0 to 1 instantly would cause a visual pop. Instead, lerp the mode as a float (0.0 to 1.0) so the transition is smooth. The shader already uses `mix()` with the mode value.
- **Per-parameter animation state machines:** Don't track "is animating", "start time", "end time" per parameter. Exponential decay lerp is stateless -- it just approaches the target every frame. Much simpler.
- **Modifying render pass architecture:** Phase 7 does NOT add render passes. All enhancements happen within the existing glass fragment shader and C++ update loop. Do not add a separate blur pass, specular pass, or glow pass.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Frame-rate independent animation | Fixed-step lerp with duration tracking | Exponential decay: `1 - exp(-speed * dt)` | No state machine, no overshoot, frame-rate independent, trivial to implement |
| Chromatic aberration formula | New per-channel displacement algorithm | Existing shader code (lines 73-113 of glass.wgsl.h) | Already implements edge-only per-channel UV scaling with SDF-based displacement factor |
| Specular highlight formula | Phong or Cook-Torrance BRDF | Existing shader code (lines 125-148 of glass.wgsl.h) | Already implements directional Fresnel with cool/warm split; just needs intensity uniforms |
| SDF-based rim glow | Screen-space edge detection or morphological erosion | Existing `exp(-dist * dist / k)` formula (line 146) | Already works, just needs a controllable intensity uniform |
| Refraction mode switching | Multiple shader pipelines | Single shader with mode uniform and `mix()` | Avoids pipeline switching overhead, GPU branch divergence, and code duplication |

**Key insight:** Most of Phase 7 is plumbing (exposing existing effects to the API) and interpolation (smooth transitions). The shader already does the hard graphics work. The main new shader code is the mode-dependent multipliers (~10 lines).

## Common Pitfalls

### Pitfall 1: GlassUniforms Alignment Breakage When Adding Fields

**What goes wrong:** Adding new fields (specularIntensity, rimIntensity, mode) to GlassUniforms changes the struct size. If the new size exceeds the current 64-byte allocation, or if the WGSL struct layout doesn't match the C++ struct, rendering breaks with garbled values or GPU validation errors.

**Why it happens:** WGSL uniform structs follow strict alignment rules. Adding an f32 after the current `_pad2/pad3` fields changes offsets for subsequent fields. The C++ struct must match byte-for-byte.

**How to avoid:**
1. Add new fields AFTER the existing `_pad2, _pad3` padding (at offset 56+).
2. Ensure the total struct size stays a multiple of 16 bytes.
3. Current struct is 64 bytes. Adding 4 new f32 fields (specularIntensity, rimIntensity, mode, morphPad) brings it to 80 bytes, which is 5 x 16 = valid.
4. Update both the C++ struct AND the WGSL struct simultaneously.
5. The dynamic uniform buffer stride is already computed from `sizeof(GlassUniforms)`, so it auto-adjusts.

**Warning signs:** Glass regions appear at wrong positions, parameters have no effect, or WebGPU validation errors about buffer size.

### Pitfall 2: Lerp Target Not Initialized on Region Creation

**What goes wrong:** A newly created glass region has `current` set to defaults but `target` is all zeros. The first frame lerps toward zero, causing a flash-to-black.

**Why it happens:** The `GlassRegion` struct initializes `current` and `target` separately, and one might not get defaults.

**How to avoid:** In `addGlassRegion()`, set both `current` and `target` to the same default values. Every setter should update `target` only (not `current`), so the lerp system handles all transitions.

**Warning signs:** New glass regions flash black or transparent momentarily on creation.

### Pitfall 3: Lerp on Rect Position Causes Sliding Glass

**What goes wrong:** When a glass component moves (e.g., window scroll, layout reflow), the glass region visually "slides" to its new position instead of tracking instantly.

**Why it happens:** The rAF position sync loop in GlassProvider updates rect position every frame. If this goes through the lerp system, the glass lags behind the DOM element.

**How to avoid:** Rect position updates (`setRegionRect`) should bypass the lerp system and write directly to `current` AND `target`. Only style parameters (blur, opacity, refraction, aberration, specular, rim, tint, mode) should go through lerp. This matches user expectation: position tracks DOM instantly, visual effects morph smoothly.

**Warning signs:** Glass regions lag behind their DOM elements during scrolling or animation.

### Pitfall 4: Morphing During Reduced-Transparency Mode

**What goes wrong:** Enabling reduced-transparency causes glass to slowly morph from transparent to opaque, which defeats the accessibility purpose (user expects immediate visual change).

**Why it happens:** The accessibility adaptation in `useGlassRegion` sets new parameters (high opacity, zero blur), and the lerp system animates to them over ~300ms.

**How to avoid:** When reduced-transparency is toggled (or reduced-motion), set morphSpeed to 0 (instant) for that parameter change. Alternatively, accessibility preference changes always write directly to `current` and `target`, bypassing lerp.

**Warning signs:** Accessibility mode changes animate slowly instead of applying instantly.

### Pitfall 5: Mode Uniform as Integer Causes Hard Switch

**What goes wrong:** If the mode is stored as an integer (0 or 1) and the shader reads it directly, switching modes causes an instant visual pop.

**Why it happens:** Integer uniforms can't be lerped. `lerp(0, 1, 0.5)` on an integer rounds to 0 or 1.

**How to avoid:** Store mode as a float (0.0 = standard, 1.0 = prominent). The lerp system interpolates it smoothly (0.0 -> 0.3 -> 0.6 -> 1.0). The shader uses `mix()` with this float to blend between mode behaviors.

**Warning signs:** Switching refraction mode causes a visual pop instead of smooth transition.

### Pitfall 6: Hover State Flicker on Fast Mouse Movement

**What goes wrong:** Moving the mouse quickly across glass buttons causes rapid hover/unhover events, resulting in stuttery morphing.

**Why it happens:** React's onMouseEnter/onMouseLeave fire rapidly. Each event sets new target parameters, and the lerp system starts a new interpolation before the previous one finishes.

**How to avoid:** This is actually fine with exponential decay lerp. Since exponential decay has no "start/stop" semantics, each new target smoothly redirects the interpolation. The existing approach naturally handles rapid target changes without any special debouncing.

**Warning signs:** This is a theoretical concern that exponential decay already solves. No action needed.

## Code Examples

### Extended GlassUniforms (C++ and WGSL)

```cpp
// C++ struct -- 80 bytes (5 x vec4f aligned)
struct GlassUniforms {
    // --- Existing fields (64 bytes, offsets 0-63) ---
    float rectX, rectY, rectW, rectH;           // offset 0-15 (vec4f)
    float cornerRadius;                          // offset 16
    float blurIntensity;                         // offset 20
    float opacity;                               // offset 24
    float refractionStrength;                    // offset 28
    float tintR, tintG, tintB;                   // offset 32-43
    float aberration;                            // offset 44
    float resolutionX, resolutionY;              // offset 48-55
    // --- New fields replacing old padding ---
    float specularIntensity;                     // offset 56 (was _pad2)
    float rimIntensity;                          // offset 60 (was _pad3)
    // --- New vec4f block ---
    float mode;                                  // offset 64 (0.0=standard, 1.0=prominent)
    float _pad4, _pad5, _pad6;                   // offset 68-79 (padding to 16-byte boundary)
};
// Total: 80 bytes (5 x vec4f aligned)
```

```wgsl
// WGSL matching struct
struct GlassUniforms {
    rect: vec4f,
    cornerRadius: f32,
    blurIntensity: f32,
    opacity: f32,
    refractionStrength: f32,
    tint: vec3f,
    aberration: f32,
    resolution: vec2f,
    specularIntensity: f32,
    rimIntensity: f32,
    mode: f32,
    _pad4: f32,
    _pad5: f32,
    _pad6: f32,
};
```

### Enhanced Glass Shader (Key Modifications)

```wgsl
// Mode-dependent multipliers
let modeF = glass.mode;  // 0.0 = standard, 1.0 = prominent
let refractionMul = mix(1.0, 1.8, modeF);
let specularMul = mix(1.0, 1.5, modeF);
let rimSpread = mix(3.0, 6.0, modeF);
let aberrationMul = mix(1.0, 1.5, modeF);

// Apply mode multiplier to refraction
let effectiveRefraction = glass.refractionStrength * refractionMul;
let rScale = mix(1.0 - effectiveRefraction - aberrationNorm * aberrationMul, 1.0, displacementFactor);
let gScale = mix(1.0 - effectiveRefraction, 1.0, displacementFactor);
let bScale = mix(1.0 - effectiveRefraction + aberrationNorm * aberrationMul, 1.0, displacementFactor);

// Enhanced specular with uniform-controlled intensity
let coolSpec = broadGlow * topLeftFactor * glass.specularIntensity * specularMul;
let warmSpec = broadGlow * (1.0 - topLeftFactor) * glass.specularIntensity * 0.5 * specularMul;

// Enhanced rim with uniform-controlled intensity and mode-dependent spread
let rimGlow = exp(-dist * dist / rimSpread) * glass.rimIntensity;
```

### Exponential Decay Lerp (C++)

```cpp
// In update(), after time advancement:
for (uint32_t i = 0; i < MAX_GLASS_REGIONS; i++) {
    if (!regions[i].active) continue;
    if (regions[i].morphSpeed <= 0.0f) {
        // Instant mode (for initialization and accessibility)
        regions[i].current = regions[i].target;
    } else {
        float t = 1.0f - expf(-regions[i].morphSpeed * deltaTime);
        lerpUniforms(regions[i].current, regions[i].target, t);
    }
}

// In render(), use regions[i].current (not target) for WriteBuffer
```

### New C++ API Methods

```cpp
// In BackgroundEngine:
void setRegionAberration(int id, float aberration);
void setRegionSpecular(int id, float intensity);
void setRegionRim(int id, float intensity);
void setRegionMode(int id, float mode);  // 0.0=standard, 1.0=prominent
void setRegionMorphSpeed(int id, float speed);  // 0=instant, 8=default

// In Embind:
.function("setRegionAberration", &BackgroundEngine::setRegionAberration)
.function("setRegionSpecular", &BackgroundEngine::setRegionSpecular)
.function("setRegionRim", &BackgroundEngine::setRegionRim)
.function("setRegionMode", &BackgroundEngine::setRegionMode)
.function("setRegionMorphSpeed", &BackgroundEngine::setRegionMorphSpeed)
```

### Extended React Props

```typescript
interface GlassStyleProps {
  // Existing
  blur?: number;
  opacity?: number;
  cornerRadius?: number;
  tint?: GlassColor;
  refraction?: number;
  // New in Phase 7
  aberration?: number;         // Chromatic aberration intensity (0-10). Default: 3
  specular?: number;           // Specular highlight intensity (0-1). Default: 0.2
  rim?: number;                // Rim lighting intensity (0-1). Default: 0.15
  refractionMode?: 'standard' | 'prominent';  // Default: 'standard'
  morphSpeed?: number;         // Morph transition speed (0=instant, 8=default). Default: 8
}
```

### GlassRegionHandle Extension

```typescript
interface GlassRegionHandle {
  id: number;
  updateRect(x: number, y: number, w: number, h: number): void;
  updateParams(cornerRadius: number, blur: number, opacity: number, refraction: number): void;
  updateTint(r: number, g: number, b: number): void;
  // New in Phase 7
  updateAberration(intensity: number): void;
  updateSpecular(intensity: number): void;
  updateRim(intensity: number): void;
  updateMode(mode: number): void;
  updateMorphSpeed(speed: number): void;
  remove(): void;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded aberration (3.0) | Adjustable via React prop | This phase | Users can tune chromatic aberration per component |
| Hardcoded specular (0.2 cool, 0.1 warm) | Adjustable intensity uniform | This phase | Users can make highlights brighter/dimmer |
| Hardcoded rim glow (0.15 * exp) | Adjustable intensity uniform | This phase | Users can emphasize or suppress rim |
| Single refraction mode | Standard + prominent modes | This phase | Two distinct visual styles |
| Instant parameter snapping | Exponential decay lerp | This phase | All parameter changes animate smoothly |

**Apple's Liquid Glass reference modes:**
- Apple's implementation uses "Regular" and "Clear" variants. Our "standard" and "prominent" are not identical but serve a similar purpose: standard is the everyday glass look, prominent is the attention-grabbing enhanced version. This mapping is at Claude's discretion since no CONTEXT.md constrains it.

## Open Questions

1. **Should lerp apply to ALL parameters or only visual ones?**
   - What we know: Rect position should NOT lerp (causes sliding). Visual params (blur, opacity, etc.) should lerp for morphing.
   - What's unclear: Should cornerRadius lerp? Visually it could look nice but might also look odd with rounded-corner morphing.
   - Recommendation: Lerp cornerRadius. It's a visual parameter and SDF handles fractional radii smoothly. If it looks bad, it can be excluded later.

2. **Default morph speed value**
   - What we know: Exponential decay with speed=8.0 means ~95% completion in ~0.4 seconds (3 time constants = 3/8 = 0.375s). This is snappy but visible.
   - What's unclear: Whether 8.0 feels right visually or needs tuning.
   - Recommendation: Default to 8.0. This is a prop, so users can tune it. 0 = instant (no morphing).

3. **Should mode be a prop enum or a numeric slider?**
   - What we know: Conceptually there are two discrete modes. But the shader interpolates via float.
   - What's unclear: Would intermediate values (mode=0.5) look good or just weird?
   - Recommendation: Expose as a string enum prop (`'standard' | 'prominent'`) at the React layer. Map to 0.0/1.0 internally. The lerp system handles smooth transitions. Don't expose the float to users.

4. **Blur quality at "prominent" mode**
   - What we know: The current 25-tap (5x5) blur has fixed kernel size. Prominent mode may want a wider blur radius.
   - What's unclear: Whether increasing the blur radius multiplier alone (e.g., `blurIntensity * 12.0` instead of `* 8.0`) produces sufficient frosting or just causes smearing.
   - Recommendation: Start with a larger radius multiplier in prominent mode. If insufficient, a future phase could add Dual-Kawase blur (multi-pass). For Phase 7, keep the single-pass architecture.

5. **Interaction with reduced-transparency mode**
   - What we know: Reduced-transparency sets near-opaque surfaces with zero blur and zero refraction. Morphing from normal to reduced-transparency should be instant (accessibility).
   - Recommendation: When `prefs.reducedTransparency` changes, temporarily set morphSpeed=0 (instant), apply parameters, then restore morphSpeed.

## Sources

### Primary (HIGH confidence)
- **Existing codebase** (`engine/src/shaders/glass.wgsl.h`) -- verified that chromatic aberration, specular highlights, and rim lighting are already implemented in the shader
- **Existing codebase** (`engine/src/background_engine.h/cpp`) -- verified GlassUniforms layout, existing API surface, and multi-region rendering architecture
- **WGSL Specification** (https://www.w3.org/TR/WGSL/) -- `mix()`, `smoothstep()`, `exp()`, `select()` builtins; uniform struct alignment rules
- **Inigo Quilez SDF reference** (https://iquilezles.org/articles/distfunctions2d/) -- sdRoundedBox formula (already in use)

### Secondary (MEDIUM confidence)
- **Chromatic Aberration technique** (https://maximmcnair.com/p/webgl-chromatic-aberration) -- per-channel UV offset with edge-based intensity using `length(uv - 0.5)`
- **Fresnel/Rim Lighting tutorial** (https://inspirnathan.com/posts/58-shadertoy-tutorial-part-12/) -- `pow(1.0 - dot(normal, -rd), exponent)` formula; adapted to 2D via SDF gradient
- **rdev/liquid-glass-react** (https://deepwiki.com/rdev/liquid-glass-react) -- refraction modes (standard, polar, prominent, shader); chromatic aberration via per-channel displacement; elastic animation via directional scaling
- **CSS-Tricks Apple Liquid Glass analysis** (https://css-tricks.com/getting-clarity-on-apples-liquid-glass/) -- Apple's three layers (highlight, shadow, illumination); Regular vs Clear variants
- **Dual Kawase Blur** (https://blog.frost.kiwi/dual-kawase/) -- efficient blur algorithm for future reference; logarithmic scaling; downsample+upsample passes. NOT needed for Phase 7 but relevant if blur quality needs improvement.
- **Exponential decay animation** (https://blog.febucci.com/2018/08/easing-functions/) -- frame-rate independent, no overshoot, asymptotic convergence

### Tertiary (LOW confidence)
- **Apple WWDC 2025 Liquid Glass** -- conceptual three-layer model (highlight, shadow, illumination); specific implementation details not publicly documented
- **liquidGL by naughtyduk** (https://github.com/naughtyduk/liquidGL) -- mentioned in competitive landscape; confirmed features (beveled edges, specular) but shader source not directly examined

## Metadata

**Confidence breakdown:**
- Exposing existing effects (GLASS-06, -07, -08): HIGH -- the shader code already works, this is pure plumbing through the API layers
- Refraction modes (GLASS-09): HIGH -- straightforward `mix()` with mode float; pattern well-understood from competitive analysis
- Morphing transitions (GLASS-10): HIGH -- exponential decay lerp is a standard game/animation technique; CPU-side implementation is trivial
- Struct alignment changes: HIGH -- well-documented in WebGPU spec; current pattern of explicit padding is proven
- Visual tuning (default values): MEDIUM -- parameter values (specular intensity, rim intensity, morph speed) need runtime visual validation; reasonable starting points identified

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable domain; WGSL spec finalized, existing shader techniques are well-established)
