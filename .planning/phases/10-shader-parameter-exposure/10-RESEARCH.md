# Phase 10: Shader Parameter Exposure - Research

**Researched:** 2026-02-25
**Domain:** React prop API design + WGSL uniform struct extension + C++ Embind bindings
**Confidence:** HIGH

## Summary

Phase 10 is almost entirely a React/TypeScript layer problem. The C++ engine already has the `setRegionContrast`, `setRegionSaturation`, `setRegionBlurRadius`, `setRegionFresnelIOR`, etc. functions needed — they just do not exist yet. The work has two equally important halves: (1) extend the C++ `GlassUniforms` struct and `BackgroundEngine` with new fields and setter methods, rebuild WASM, and update the TypeScript `EngineModule` interface; and (2) add the new props to `GlassStyleProps`, thread them through `useGlassRegion`, and expose improved Apple-calibrated defaults.

The existing pattern is already well established: `GlassStyleProps` → `useGlassRegion` → `GlassRegionHandle.updateX()` → `engine.setRegionX(id, val)`. Every new shader parameter follows this same four-layer chain. The lerpUniforms function in the C++ engine already handles lerping all `GlassUniforms` fields, so new fields added there automatically get morph animation at no extra cost — as long as they are included in `lerpUniforms`.

The primary technical challenge is extending the `GlassUniforms` C++ struct without violating WGSL/WebGPU alignment rules. The struct must be a multiple of 16 bytes and every `f32` field must be placed such that the struct stays properly aligned. The current struct is 80 bytes (5 × vec4f); any extension must maintain 16-byte-aligned total size.

**Primary recommendation:** Follow the exact existing four-layer pattern. Add new fields to `GlassUniforms` in a new 16-byte-aligned block, wire them through Embind, update the TS interface, then extend `GlassStyleProps` and `useGlassRegion`. No new libraries needed — this is purely additive extension of existing infrastructure.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Flat props on components, not a grouped `shader={}` object
- All 7 shader props are optional — zero-config produces a complete glass effect
- All glass components (GlassPanel, GlassButton, GlassCard) expose the same set of shader props
- No component-specific subsets — consistent API surface across all components
- Out-of-range values are silently clamped to valid ranges (no warnings, no errors)
- Default values should be an **improved baseline** that leans toward authentic Apple Liquid Glass appearance, not just reproducing v1.0 hardcoded values
- Subtler reflections, natural Fresnel, refined blur — push closer to what real Apple glass looks like

### Claude's Discretion
- Prop naming conventions — choose names that read well in JSX and align with existing codebase patterns (the 7 requirement names are a starting point, can simplify where it improves DX)
- Whether defaults should be theme-aware (different in light vs dark mode) — decide based on how Apple handles it and what the shader can support cleanly
- TypeScript type design (literal number types, branded types, plain number)
- JSDoc documentation depth and format
- Valid range boundaries for each parameter

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SHDR-01 | User can control contrast, saturation, and blurRadius via React props on glass components | `contrast` and `saturation` are currently hardcoded in the WGSL shader (lines 131-133: `mix(vec3f(luminance), aberratedColor, 1.4)` for saturation, `mix(vec3f(0.5), saturated, 0.85)` for contrast). `blurRadius` maps to `blurIntensity` uniform × 30.0 in the shader. All three need new uniform fields and setter methods following the existing four-layer pattern. |
| SHDR-02 | All existing glass shader uniforms are exposed as documented, typed React props with sensible defaults | `GlassStyleProps` already exposes `blur`, `opacity`, `cornerRadius`, `tint`, `refraction`, `aberration`, `specular`, `rim`, `refractionMode`, `morphSpeed`. This requirement adds the 3 new SHDR-01 props plus 4 new Fresnel/env/glare props. JSDoc + TypeScript type coverage on all is needed. |
| SHDR-03 | Glass shader supports Fresnel IOR and exponent parameters for edge reflection | The WGSL shader currently has a simple fixed Fresnel/specular model using `dot(normDir, vec2f(-0.707, -0.707))`. New `fresnelIOR` and `fresnelExponent` uniforms replace the hardcoded edge reflection model. IOR ~1.5 is physical glass; exponent controls fall-off curve. |
| SHDR-04 | Glass shader supports environment reflection strength parameter | `envReflectionStrength` controls the overall intensity of the environment/ambient reflection layer (currently rolled into `specularIntensity`). A dedicated uniform decouples environmental from directional specular, enabling finer user control. |
| SHDR-05 | Glass shader supports glare direction angle parameter | `glareDirection` is an angle (in degrees or radians) that replaces the hardcoded `vec2f(-0.707, -0.707)` light direction in the shader. Changing it rotates the directional specular highlight around the glass surface. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ~5.x (project uses) | Typed props, JSDoc | Already in project; types.ts is the prop contract |
| WGSL (inline C string) | WebGPU spec | Shader uniform struct extension | Existing pattern: glass.wgsl.h header |
| Emscripten Embind | project WASM build | Expose C++ methods to JS | Already used for all existing setRegionX methods |
| React | 18/19 | Component props, useEffect | Existing component architecture |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | — | — | No new libraries needed. All work is additive extension of existing infrastructure. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain `number` TypeScript types | Branded/opaque types | Branded types add friction for users setting literal values; plain number is consistent with all existing props |
| Grouped `shader={}` prop object | Flat props (chosen) | Locked decision: flat props are consistent with existing API |
| Separate C++ setter per field | Batch setter function | Individual setters match the existing pattern exactly and compose cleanly with the lerp system |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure
No new directories needed. Changes are additive to existing files:

```
engine/src/
├── background_engine.h       # Extend GlassUniforms struct + declare new setters
├── background_engine.cpp     # Implement setters + update lerpUniforms + addGlassRegion defaults
├── shaders/glass.wgsl.h      # Add new uniform fields to WGSL GlassUniforms + use in shader
└── main.cpp                  # Register new Embind bindings in class<BackgroundEngine>

src/
├── wasm/loader.ts            # Add new methods to EngineModule.getEngine() return type
├── context/GlassContext.ts   # Add new updateX() methods to GlassRegionHandle interface
├── components/types.ts       # Add new props to GlassStyleProps
└── hooks/useGlassRegion.ts   # Thread new props to handle.updateX() calls
```

Components (GlassPanel, GlassButton, GlassCard) only need to destructure new props from their prop type — the `useGlassRegion` call signature already accepts the full `GlassStyleProps` object.

### Pattern 1: Adding a New Shader Parameter End-to-End

This is the single repeatable pattern for all 7 new props. One complete example for `contrast`:

**Step 1: C++ struct (background_engine.h)**
```cpp
// In GlassUniforms, add a new 16-byte block:
// Current struct is 80 bytes (5 × vec4f). Append a 6th block:
struct GlassUniforms {
    // ... existing fields (80 bytes) ...
    // --- New 16-byte block (offset 80) ---
    float contrast;               // offset 80: contrast multiplier (0.5–1.5, default 0.85)
    float saturation;             // offset 84: saturation multiplier (0.5–2.0, default 1.4)
    float fresnelIOR;             // offset 88: index of refraction (1.0–2.5, default 1.5)
    float fresnelExponent;        // offset 92: Fresnel fall-off exponent (1.0–8.0, default 5.0)
    // --- New 16-byte block (offset 96) ---
    float envReflectionStrength;  // offset 96
    float glareAngle;             // offset 100: radians, 0=top-left (default -π/4)
    float blurRadius;             // offset 104: physical blur radius in pixels (0–40, default 15.0)
    float _pad7;                  // offset 108: padding to 112 bytes (7 × 16)
};
// Total: 112 bytes (7 × vec4f aligned)
```

**Step 2: WGSL shader (glass.wgsl.h)**
```wgsl
struct GlassUniforms {
    // ... existing fields ...
    // New block at byte offset 80
    contrast: f32,               // offset 80
    saturation: f32,             // offset 84
    fresnelIOR: f32,             // offset 88
    fresnelExponent: f32,        // offset 92
    // New block at byte offset 96
    envReflectionStrength: f32,  // offset 96
    glareAngle: f32,             // offset 100
    blurRadius: f32,             // offset 104
    _pad7: f32,                  // offset 108
};
```

**Step 3: Shader logic — replace hardcoded values**
```wgsl
// BEFORE (hardcoded):
let blurRadius = glass.blurIntensity * 30.0;
let saturated = mix(vec3f(luminance), aberratedColor, 1.4);
let contrasted = mix(vec3f(0.5), saturated, 0.85);

// AFTER (from uniforms):
let blurRadiusPx = glass.blurRadius;  // direct pixel radius
let saturated = mix(vec3f(luminance), aberratedColor, glass.saturation);
let contrasted = mix(vec3f(0.5), saturated, glass.contrast);

// Fresnel-based specular using IOR + exponent:
let fresnelBase = 1.0 - clamp(dot(normDir, normalize(lightDir)), 0.0, 1.0);
let fresnelTerm = pow(fresnelBase, glass.fresnelExponent);
// Multiply by strength to control overall env reflection
let envRef = fresnelTerm * glass.envReflectionStrength;

// Glare direction from angle uniform:
let lightDir = vec2f(cos(glass.glareAngle), sin(glass.glareAngle));
```

**Step 4: C++ setters (background_engine.cpp)**
```cpp
void BackgroundEngine::setRegionContrast(int id, float contrast) {
    if (id < 0 || id >= static_cast<int>(MAX_GLASS_REGIONS)) return;
    regions[id].target.contrast = contrast;
}
// ... same pattern for each of the 7 new params
```

**Step 5: lerpUniforms update**
```cpp
void BackgroundEngine::lerpUniforms(GlassUniforms& current, const GlassUniforms& target, float t) {
    // ... existing lerps ...
    current.contrast += (target.contrast - current.contrast) * t;
    current.saturation += (target.saturation - current.saturation) * t;
    current.fresnelIOR += (target.fresnelIOR - current.fresnelIOR) * t;
    current.fresnelExponent += (target.fresnelExponent - current.fresnelExponent) * t;
    current.envReflectionStrength += (target.envReflectionStrength - current.envReflectionStrength) * t;
    current.glareAngle += (target.glareAngle - current.glareAngle) * t;
    current.blurRadius += (target.blurRadius - current.blurRadius) * t;
}
```

**Step 6: addGlassRegion defaults in background_engine.cpp**
```cpp
// Apple Liquid Glass-calibrated defaults:
defaults.contrast = 0.85f;            // backdrop-filter: contrast(85%)
defaults.saturation = 1.4f;           // backdrop-filter: saturate(140%)
defaults.fresnelIOR = 1.5f;           // physical glass IOR
defaults.fresnelExponent = 5.0f;      // natural edge fall-off
defaults.envReflectionStrength = 0.12f; // subtle ambient reflection
defaults.glareAngle = -0.785398f;     // -π/4 = upper-left (existing hardcoded direction)
defaults.blurRadius = 15.0f;          // calibrated from blurIntensity=0.5 × 30.0px
```

**Step 7: Embind registration (main.cpp)**
```cpp
emscripten::class_<BackgroundEngine>("BackgroundEngine")
    // ... existing bindings ...
    .function("setRegionContrast", &BackgroundEngine::setRegionContrast)
    .function("setRegionSaturation", &BackgroundEngine::setRegionSaturation)
    .function("setRegionFresnelIOR", &BackgroundEngine::setRegionFresnelIOR)
    .function("setRegionFresnelExponent", &BackgroundEngine::setRegionFresnelExponent)
    .function("setRegionEnvReflectionStrength", &BackgroundEngine::setRegionEnvReflectionStrength)
    .function("setRegionGlareAngle", &BackgroundEngine::setRegionGlareAngle)
    .function("setRegionBlurRadius", &BackgroundEngine::setRegionBlurRadius)
```

**Step 8: TypeScript EngineModule (loader.ts)**
```typescript
setRegionContrast(id: number, contrast: number): void;
setRegionSaturation(id: number, saturation: number): void;
setRegionFresnelIOR(id: number, ior: number): void;
setRegionFresnelExponent(id: number, exponent: number): void;
setRegionEnvReflectionStrength(id: number, strength: number): void;
setRegionGlareAngle(id: number, angle: number): void;
setRegionBlurRadius(id: number, radius: number): void;
```

**Step 9: GlassRegionHandle (GlassContext.ts)**
```typescript
updateContrast(value: number): void;
updateSaturation(value: number): void;
updateFresnelIOR(value: number): void;
updateFresnelExponent(value: number): void;
updateEnvReflectionStrength(value: number): void;
updateGlareAngle(value: number): void;
updateBlurRadius(value: number): void;
```

**Step 10: GlassStyleProps (types.ts)**
```typescript
export interface GlassStyleProps {
  // ... existing props ...
  /**
   * Contrast adjustment applied to the background behind the glass (0.5–1.5).
   * Matches CSS backdrop-filter: contrast(). Default: 0.85 (Apple standard).
   */
  contrast?: number;
  /**
   * Saturation boost applied to the background behind the glass (0.5–2.0).
   * Matches CSS backdrop-filter: saturate(). Default: 1.4 (Apple standard).
   */
  saturation?: number;
  /**
   * Blur radius in CSS pixels applied to the background (0–40).
   * Default: 15. Higher values produce a more frosted appearance.
   */
  blurRadius?: number;
  /**
   * Fresnel index of refraction for edge reflection (1.0–2.5).
   * 1.5 is physical glass; higher values create more edge reflectivity. Default: 1.5.
   */
  fresnelIOR?: number;
  /**
   * Fresnel exponent controlling edge fall-off curve (1.0–8.0).
   * Higher = sharper, more concentrated edge reflection. Default: 5.0.
   */
  fresnelExponent?: number;
  /**
   * Environment reflection strength — intensity of ambient glass reflections (0–1).
   * Default: 0.12 (subtle, matching Apple's light-touch approach).
   */
  envReflectionStrength?: number;
  /**
   * Glare direction angle in degrees (0–360, or equivalently any number).
   * 0 = right, 90 = down, 180 = left, 270 = up. Default: 315 (upper-left, Apple standard).
   */
  glareDirection?: number;
}
```

**Step 11: useGlassRegion.ts — thread new props**
```typescript
// In the normal-mode branch:
handle.updateContrast(props.contrast ?? 0.85);
handle.updateSaturation(props.saturation ?? 1.4);
handle.updateBlurRadius(props.blurRadius ?? 15);
handle.updateFresnelIOR(props.fresnelIOR ?? 1.5);
handle.updateFresnelExponent(props.fresnelExponent ?? 5.0);
handle.updateEnvReflectionStrength(props.envReflectionStrength ?? 0.12);
// glareDirection prop is degrees; convert to radians for shader:
handle.updateGlareAngle((props.glareDirection ?? 315) * Math.PI / 180);

// In reduced-transparency branch: disable effects
handle.updateContrast(1.0);        // no contrast shift when accessibility mode
handle.updateSaturation(1.0);      // no saturation shift
handle.updateBlurRadius(0);
handle.updateFresnelIOR(1.0);
handle.updateFresnelExponent(1.0);
handle.updateEnvReflectionStrength(0);
handle.updateGlareAngle(0);

// Add new props to useEffect dependency array:
props.contrast,
props.saturation,
props.blurRadius,
props.fresnelIOR,
props.fresnelExponent,
props.envReflectionStrength,
props.glareDirection,
```

**Step 12: GlassProvider.tsx — wire handle methods**
```typescript
const handle: GlassRegionHandle = {
  // ... existing methods ...
  updateContrast: (v) => engine.setRegionContrast(id, v),
  updateSaturation: (v) => engine.setRegionSaturation(id, v),
  updateBlurRadius: (v) => engine.setRegionBlurRadius(id, v),
  updateFresnelIOR: (v) => engine.setRegionFresnelIOR(id, v),
  updateFresnelExponent: (v) => engine.setRegionFresnelExponent(id, v),
  updateEnvReflectionStrength: (v) => engine.setRegionEnvReflectionStrength(id, v),
  updateGlareAngle: (v) => engine.setRegionGlareAngle(id, v),
};
```

### Pattern 2: Prop Naming — Degrees vs Radians

The prop is named `glareDirection` (degrees, 0-360) at the React API level. The conversion to radians happens in `useGlassRegion.ts` before passing to the engine. This keeps the JSX API human-readable while the shader works in radians. The conversion is: `angle * Math.PI / 180`.

### Pattern 3: The blur/blurRadius Relationship

The existing `blur` prop (0–1 normalized) maps to `blurIntensity * 30.0` pixels in the shader. The new `blurRadius` prop (pixels, 0–40) is a direct pixel value going into a new `blurRadius` uniform, replacing the `blurIntensity * 30.0` computation. Both props can coexist: `blurRadius` when set takes direct precedence; if unset, the existing `blur` prop still drives `blurIntensity` and the shader uses `glass.blurRadius` for sampling. Simplest implementation: populate `blurRadius` uniform from `props.blurRadius ?? (props.blur ?? 0.5) * 30.0` — this makes `blurRadius` override `blur` naturally.

### Anti-Patterns to Avoid
- **Do NOT add new uniform fields in the middle of the existing struct.** WGSL reads fields by byte offset. Inserting mid-struct shifts all subsequent field offsets, breaking existing rendering silently. Always append new fields at the end in new 16-byte-aligned blocks.
- **Do NOT forget to update `lerpUniforms`.** New fields in `GlassUniforms` that are not added to `lerpUniforms` will not animate through the morph system — they will snap instantly instead of transitioning smoothly. This is the most likely regression.
- **Do NOT forget to update `addGlassRegion` defaults.** New fields in the struct are zero-initialized by default in C++. A zeroed `contrast` would make the glass completely black. All new fields need explicit default values in `addGlassRegion`.
- **Do NOT use `blurIntensity` and `blurRadius` as two separate code paths.** The shader should have one `blurRadius` field (in pixels). The JS-side `useGlassRegion` handles the mapping from the `blur` (normalized) prop to pixels when `blurRadius` is not set.
- **Do NOT skip clamping in the C++ setters for SHDR-01–05.** The user decision is silent clamping, not errors.
- **Do NOT rebuild the WASM binary inside TypeScript.** The binary is pre-built and committed. After C++ changes, run the Emscripten build (`emmake make` in `engine/`) and commit the new `.wasm`/`.js` output.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Lerp/morph animation for new fields | Custom animation system | Add to existing `lerpUniforms` | Already framerate-independent with exponential decay |
| WGSL struct offset calculation | Manual byte counting | Follow existing GlassUniforms pattern exactly; verify with struct size comment | Misalignment is silent, not an error |
| Degree-to-radian conversion | Complex angle library | `angle * Math.PI / 180` in useGlassRegion.ts | One line |
| TypeScript union types for angles | Special angle type | Plain `number` | Consistent with all existing props |

**Key insight:** The entire animation and GPU upload infrastructure already exists. Adding new fields is purely additive — the morph system, WebGPU buffer writes, and multi-region rendering all work automatically once the struct is extended correctly.

## Common Pitfalls

### Pitfall 1: Uniform Struct Alignment Violation
**What goes wrong:** New fields are added but the struct's total size is not a multiple of 16 bytes, or a field crosses a 16-byte boundary alignment. The WebGPU validation layer may not catch this immediately — the shader silently reads wrong bytes.
**Why it happens:** The WGSL spec requires `uniform` structs to have size that is a multiple of 16 bytes (the alignment of `vec4f`). Forgetting a trailing padding `f32` after an odd count of new fields breaks this.
**How to avoid:** Count new `f32` fields. If not a multiple of 4, add `_pad` fields to reach 4. The current struct is 80 bytes (20 `f32`s). Adding 7 new fields = 27 total, which is not a multiple of 4. Need to add 1 pad field → 28 `f32`s = 112 bytes (7 × 16).
**Warning signs:** Visual glitches or completely wrong glass rendering after adding fields, especially with no JS errors.

### Pitfall 2: Forgetting to Update lerpUniforms
**What goes wrong:** New uniform fields are added but not included in `lerpUniforms`. The fields immediately snap to target values instead of smoothly animating.
**Why it happens:** `lerpUniforms` is a manual list of field-by-field lerps. It does not automatically pick up new struct fields.
**How to avoid:** After adding any new field to `GlassUniforms`, immediately add the corresponding lerp line in `lerpUniforms`. Review `lerpUniforms` as a final checklist step.
**Warning signs:** Parameter changes cause instant visual jumps instead of smooth transitions when morphSpeed > 0.

### Pitfall 3: Forgetting addGlassRegion Defaults
**What goes wrong:** New struct fields default to 0 in C++ value initialization. Zero contrast produces a black glass region. Zero blurRadius produces no blur.
**Why it happens:** `addGlassRegion()` sets all `defaults.*` fields explicitly but new fields are easily missed.
**How to avoid:** Set all new defaults in `addGlassRegion()` to Apple-calibrated values (see below). Cross-reference with the WGSL shader to confirm what zero means visually for each field.
**Warning signs:** Glass renders with severe visual corruption on first render (all black, or flat white) until you set props explicitly.

### Pitfall 4: WASM Binary Not Rebuilt
**What goes wrong:** C++ changes are made but the WASM binary in `engine/build-web/` is not rebuilt. The running app uses the old binary without the new functions. TypeScript calls to `setRegionContrast` throw "is not a function" errors at runtime.
**Why it happens:** The WASM binary is pre-compiled and committed — JS/TS changes alone do not trigger a rebuild.
**How to avoid:** After any C++ change, run the Emscripten build before testing. Check the project's existing build script.
**Warning signs:** `TypeError: engine.setRegionContrast is not a function` in browser console.

### Pitfall 5: blur vs blurRadius Semantic Confusion
**What goes wrong:** Both `blur` (existing, 0-1 normalized) and `blurRadius` (new, pixels) exist. If not handled carefully, they could fight each other or the shader could have two blur uniform fields with confusing interaction.
**Why it happens:** The existing `blur` prop controls `blurIntensity` in the uniform struct. The new `blurRadius` is a pixel-space radius. They overlap semantically.
**How to avoid:** In `useGlassRegion`, compute the effective pixel radius as: `props.blurRadius ?? (props.blur ?? 0.5) * 30`. Use only the `blurRadius` uniform in the shader for the Gaussian sample spread. Keep `blurIntensity` in the struct for backward compatibility but the shader should reference only `blurRadius` for actual sampling.
**Warning signs:** Changing `blur` prop has no effect when `blurRadius` is also set, or vice versa.

### Pitfall 6: glareDirection Degrees/Radians Mismatch
**What goes wrong:** The prop accepts degrees (user-friendly) but the shader computes `cos(angle)` expecting radians. Passing degrees directly to the shader produces wrong glare direction.
**Why it happens:** Degrees are natural for JSX props (0-360); WGSL trig functions use radians.
**How to avoid:** Convert in `useGlassRegion.ts`: `handle.updateGlareAngle((props.glareDirection ?? 315) * Math.PI / 180)`. The shader receives radians. The internal field is named `glareAngle` to signal radians. The external prop is `glareDirection` in degrees.
**Warning signs:** Glare always appears in the wrong position regardless of prop value.

## Code Examples

Verified patterns from existing codebase:

### Existing setter pattern (background_engine.cpp)
```cpp
// Source: engine/src/background_engine.cpp:623-627
void BackgroundEngine::setRegionRim(int id, float intensity) {
    if (id < 0 || id >= static_cast<int>(MAX_GLASS_REGIONS)) return;
    regions[id].target.rimIntensity = intensity;
}
```

### Existing Embind binding pattern (main.cpp)
```cpp
// Source: engine/src/main.cpp:140-146
emscripten::class_<BackgroundEngine>("BackgroundEngine")
    .function("setRegionAberration", &BackgroundEngine::setRegionAberration)
    .function("setRegionSpecular", &BackgroundEngine::setRegionSpecular)
    .function("setRegionRim", &BackgroundEngine::setRegionRim)
```

### Existing handle wiring pattern (GlassProvider.tsx)
```typescript
// Source: src/components/GlassProvider.tsx:157-167
const handle: GlassRegionHandle = {
  id,
  updateRect: (x, y, w, h) => engine.setRegionRect(id, x, y, w, h),
  updateAberration: (intensity) => engine.setRegionAberration(id, intensity),
  updateSpecular: (intensity) => engine.setRegionSpecular(id, intensity),
  updateRim: (intensity) => engine.setRegionRim(id, intensity),
};
```

### Existing useGlassRegion prop-to-handle pattern (useGlassRegion.ts)
```typescript
// Source: src/hooks/useGlassRegion.ts:92-95
handle.updateAberration(props.aberration ?? 3);
handle.updateSpecular(props.specular ?? 0.2);
handle.updateRim(props.rim ?? 0.15);
handle.updateMode(props.refractionMode === 'prominent' ? 1.0 : 0.0);
```

### Existing lerp pattern (background_engine.cpp)
```cpp
// Source: engine/src/background_engine.cpp:409-422
void BackgroundEngine::lerpUniforms(GlassUniforms& current, const GlassUniforms& target, float t) {
    current.rimIntensity += (target.rimIntensity - current.rimIntensity) * t;
    current.mode += (target.mode - current.mode) * t;
}
```

### Existing hardcoded values to replace in glass.wgsl.h
```wgsl
// Source: engine/src/shaders/glass.wgsl.h:130-133
// THESE become uniform-driven:
let luminance = dot(aberratedColor, vec3f(0.299, 0.587, 0.114));
let saturated = mix(vec3f(luminance), aberratedColor, 1.4);    // 1.4 → glass.saturation
let contrasted = mix(vec3f(0.5), saturated, 0.85);             // 0.85 → glass.contrast

// Source: glass.wgsl.h:148-150
// THIS becomes uniform-driven:
let lightDot = dot(normDir, vec2f(-0.707, -0.707));  // → cos/sin of glass.glareAngle

// Source: glass.wgsl.h:100
// THIS becomes uniform-driven:
let blurRadius = glass.blurIntensity * 30.0;         // → glass.blurRadius directly
```

### Apple-calibrated default values (research-informed)
The current hardcoded shader values already match Apple's visual reference:
- `contrast = 0.85` — matches `backdrop-filter: contrast(85%)`
- `saturation = 1.4` — matches `backdrop-filter: saturate(140%)`
- `blurRadius = 15.0` — from `blurIntensity=0.5 × 30.0px`; Apple uses ~15-20px effective blur
- `fresnelIOR = 1.5` — physical glass index of refraction (air=1.0, glass=1.5)
- `fresnelExponent = 5.0` — natural Fresnel falloff for glass; higher = sharper rim edge
- `envReflectionStrength = 0.12` — subtle ambient glass reflection, not overpowering
- `glareDirection = 315` degrees (upper-left) — matches Apple's existing directional light assumption

For the SHDR-01/02 improved baseline direction: the existing defaults already encode the Apple CSS reference values (85%/140%). The improvement opportunity is in Fresnel (currently a simple geometric model), where `fresnelIOR=1.5` + `fresnelExponent=5.0` will produce more physically accurate edge behavior than the current `broadGlow * topLeftFactor` approach.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No exposed shader params | Blur/specular/rim/aberration props | v1.0 (Phase 5-7) | Users could tune common params |
| Hardcoded contrast/saturation | These are being exposed (Phase 10) | Now | Enables automated tuning loop (Phase 14) |
| No Fresnel model | Simple broadGlow × lightDot | v1.0 | Phase 10 replaces with IOR-based model |

## Open Questions

1. **Should `blur` (existing) and `blurRadius` (new) coexist as separate props?**
   - What we know: `blur` (0–1) drives `blurIntensity` which multiplies by 30px in the shader. The new `blurRadius` is a pixel-space prop for SHDR-01.
   - What's unclear: If we expose `blurRadius` as a pixel prop, `blur` becomes a weaker alias. Users who have `blur={0.6}` today would not see a change unless the mapping is preserved.
   - Recommendation: Keep both. In `useGlassRegion`, compute effective radius: `props.blurRadius ?? (props.blur ?? 0.5) * 30`. The shader uses only one `blurRadius` uniform. This is backward compatible and lets Phase 14 (automated tuning) use the pixel-space `blurRadius` directly.

2. **Should new defaults differ between dark and light mode?**
   - What we know: `tint` and `opacity` currently use `DARK_DEFAULTS`/`LIGHT_DEFAULTS` in `useGlassRegion`. The new contrast/saturation/Fresnel params are background processing params, not color params.
   - What's unclear: Apple's own glass differs slightly between dark and light themes.
   - Recommendation: Use single defaults for `contrast`, `saturation`, `blurRadius`, `fresnelIOR`, `fresnelExponent`, `envReflectionStrength`, `glareDirection`. These are physical properties of the glass material, not theme-dependent. Theme variation is already handled by `tint`/`opacity`.

3. **Is the Fresnel model a complete replacement or an additive layer?**
   - What we know: The current specular model uses `broadGlow * topLeftFactor * specularIntensity`. The new `fresnelIOR`/`fresnelExponent` props introduce a physics-based edge calculation.
   - What's unclear: Should the new Fresnel term fully replace the existing `specularIntensity`-based model, or coexist?
   - Recommendation: Keep the existing `specularIntensity` prop for the directional highlight (it is already exposed and documented). The new `fresnelIOR`/`fresnelExponent` control the edge reflection calculation that feeds the Fresnel term. `envReflectionStrength` is a global multiplier on the Fresnel result. This gives users independent control over directional specular vs. edge-based Fresnel reflection.

## Validation Architecture

> Skipping — `workflow.nyquist_validation` is not set in .planning/config.json (no validation workflow key present).

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `engine/src/background_engine.h`, `background_engine.cpp`, `shaders/glass.wgsl.h`, `src/components/types.ts`, `src/hooks/useGlassRegion.ts`, `src/components/GlassProvider.tsx`, `src/context/GlassContext.ts`, `src/wasm/loader.ts`
- [WebGPU Memory Layout (webgpufundamentals.org)](https://webgpufundamentals.org/webgpu/lessons/webgpu-memory-layout.html) — WGSL struct alignment rules, 16-byte uniform size requirement

### Secondary (MEDIUM confidence)
- [MDN backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter) — contrast(85%) saturate(140%) reference values for Apple glass effect
- [Engineering Behind Apple's Liquid Glass UI (Medium)](https://medium.com/@manavkaushal756/engineering-behind-apple-liquid-glass-ui-fb51b1d599ad) — Fresnel effect description, edge reflectivity behavior at shallow angles
- [Liquid Glass iOS Effect Explanation (Medium)](https://medium.com/@aghajari/liquid-glass-ios-effect-explanation-dabadd6414ae) — Apple glass parameter description (behind paywall, not fully verified)
- IOR reference values: glass IOR=1.5, water=1.33, diamond=2.42 — physics constants, universally accepted

### Tertiary (LOW confidence)
- [LiquidGlassKit (GitHub)](https://github.com/DnV1eX/LiquidGlassKit) — iOS 26+ native glass advanced customization, may contain parameter insights

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all patterns verified directly in codebase
- Architecture: HIGH — additive extension of well-established 4-layer pattern
- Pitfalls: HIGH — alignment rules from official WebGPU docs; other pitfalls from direct pattern analysis
- Default values: MEDIUM — contrast/saturation from CSS reference (verified), Fresnel IOR from physics constants (universally accepted), exponent/strength are informed estimates calibrated to existing visual quality

**Research date:** 2026-02-25
**Valid until:** 2026-05-25 (stable domain — WebGPU API stable, patterns unlikely to change)
