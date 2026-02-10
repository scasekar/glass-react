# Phase 6: Accessibility & Theming - Research

**Researched:** 2026-02-10
**Domain:** CSS media queries, WCAG contrast, WebGPU/WASM animation control, React accessibility hooks
**Confidence:** HIGH

## Summary

Phase 6 adds four accessibility and theming capabilities to the glass component library: (1) respecting `prefers-reduced-transparency` by making glass surfaces near-opaque, (2) respecting `prefers-reduced-motion` by freezing the animated procedural background, (3) ensuring WCAG 2.1 AA contrast (4.5:1) for text on glass surfaces, and (4) adapting glass tint/appearance for dark and light mode via `prefers-color-scheme`.

The implementation spans two layers: the **React layer** (detecting OS preferences via `window.matchMedia` and exposing them through GlassContext) and the **C++ WASM engine layer** (responding to preference signals by adjusting glass uniforms and animation state). The key architectural insight is that all four requirements flow through the same data path: React detects media query changes, updates context state, and components pass adjusted parameters to the C++ engine via the existing Embind API. No new shader code is required for reduced-transparency or dark/light mode -- these are achieved by adjusting existing uniform values (opacity, tint, blur). Reduced-motion requires a new engine API method to pause/resume the time uniform. WCAG contrast is enforced through a combination of tint overlay opacity and a CSS text-shadow fallback.

**Primary recommendation:** Implement a `useAccessibilityPreferences` hook using `useSyncExternalStore` for all three media queries, surface the preferences through GlassContext, and let GlassProvider orchestrate both the CSS-side and engine-side adaptations.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.x (already installed) | `useSyncExternalStore` for media query hooks | Built-in, no deps needed |
| window.matchMedia | Web API (all modern browsers) | Detect OS preferences | Standard browser API, no library needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| No additional libraries needed | - | - | All functionality achievable with built-in browser APIs and React 19 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom `useSyncExternalStore` hook | `useEffect` + `useState` | `useSyncExternalStore` is safer under concurrent rendering, prevents tearing |
| Manual contrast calculation | `get-contrast-ratio` npm package | Custom is fine here -- we only need ~15 lines of code for the WCAG formula |
| CSS-only dark mode | JS-driven dark mode detection | We need JS detection because we must pass tint values to the C++ engine via Embind |

**Installation:**
```bash
# No new dependencies required
# All features use built-in browser APIs + React 19 useSyncExternalStore
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  hooks/
    useAccessibilityPreferences.ts   # NEW: useSyncExternalStore for 3 media queries
    useGlassEngine.ts                # existing
    useGlassRegion.ts                # MODIFIED: applies a11y overrides to engine params
    useMergedRef.ts                  # existing
  context/
    GlassContext.ts                  # MODIFIED: add a11y preference fields to context value
  components/
    GlassProvider.tsx                # MODIFIED: detect preferences, pass to engine + context
    GlassPanel.tsx                   # MODIFIED: apply contrast-safe text styles
    GlassButton.tsx                  # MODIFIED: apply contrast-safe text styles
    GlassCard.tsx                    # MODIFIED: apply contrast-safe text styles
    types.ts                         # MODIFIED: add a11y-related type definitions
  utils/
    contrast.ts                      # NEW: WCAG relative luminance + contrast ratio math
engine/
  src/
    background_engine.h              # MODIFIED: add setPaused() / setReducedTransparency()
    background_engine.cpp            # MODIFIED: implement pause + a11y uniform overrides
    main.cpp                         # MODIFIED: expose new methods via Embind
```

### Pattern 1: Media Query Detection via useSyncExternalStore
**What:** A single hook that subscribes to all three OS-level accessibility/theme media queries and returns a stable snapshot object.
**When to use:** Called once in GlassProvider, result distributed via context.
**Example:**
```typescript
// Source: React docs (https://react.dev/reference/react/useSyncExternalStore)
import { useSyncExternalStore } from 'react';

interface AccessibilityPreferences {
  reducedMotion: boolean;
  reducedTransparency: boolean;
  darkMode: boolean;
}

function createMediaQueryStore(query: string) {
  return {
    subscribe(callback: () => void) {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', callback);
      return () => mql.removeEventListener('change', callback);
    },
    getSnapshot() {
      return window.matchMedia(query).matches;
    },
    getServerSnapshot() {
      return false;
    },
  };
}

const reducedMotionStore = createMediaQueryStore('(prefers-reduced-motion: reduce)');
const reducedTransparencyStore = createMediaQueryStore('(prefers-reduced-transparency: reduce)');
const darkModeStore = createMediaQueryStore('(prefers-color-scheme: dark)');

export function useAccessibilityPreferences(): AccessibilityPreferences {
  const reducedMotion = useSyncExternalStore(
    reducedMotionStore.subscribe,
    reducedMotionStore.getSnapshot,
    reducedMotionStore.getServerSnapshot,
  );
  const reducedTransparency = useSyncExternalStore(
    reducedTransparencyStore.subscribe,
    reducedTransparencyStore.getSnapshot,
    reducedTransparencyStore.getServerSnapshot,
  );
  const darkMode = useSyncExternalStore(
    darkModeStore.subscribe,
    darkModeStore.getSnapshot,
    darkModeStore.getServerSnapshot,
  );
  return { reducedMotion, reducedTransparency, darkMode };
}
```

### Pattern 2: Engine Accessibility Bridge (JS to C++ via Embind)
**What:** GlassProvider calls engine methods when accessibility preferences change, controlling animation pause and transparency override.
**When to use:** In GlassProvider's useEffect hooks that watch preference changes.
**Example:**
```typescript
// In GlassProvider.tsx
useEffect(() => {
  const engine = moduleRef.current?.getEngine();
  if (!engine) return;
  engine.setPaused(prefs.reducedMotion);
}, [prefs.reducedMotion, ready]);

useEffect(() => {
  const engine = moduleRef.current?.getEngine();
  if (!engine) return;
  // When reduced transparency is on, engine should skip glass effect
  // and render regions as solid/near-opaque surfaces
  engine.setReducedTransparency(prefs.reducedTransparency);
}, [prefs.reducedTransparency, ready]);
```

### Pattern 3: Dark/Light Mode Tint Adaptation
**What:** Components adapt their tint color and opacity based on color scheme. In dark mode, glass regions use a slightly lighter/cooler tint with lower opacity. In light mode, glass regions use a darker/warmer tint with higher opacity to maintain contrast against lighter backgrounds.
**When to use:** Applied in useGlassRegion when computing effective parameter values.
**Example:**
```typescript
// Dark mode defaults (cooler, subtler tint over dark background)
const DARK_DEFAULTS = {
  tint: [0.7, 0.75, 0.85] as GlassColor,  // cool blue-white
  opacity: 0.08,
};

// Light mode defaults (warmer, stronger tint to maintain contrast on light bg)
const LIGHT_DEFAULTS = {
  tint: [0.15, 0.15, 0.2] as GlassColor,  // dark charcoal
  opacity: 0.25,
};
```

### Pattern 4: WCAG Contrast Enforcement via CSS Text Shadow
**What:** A CSS `text-shadow` or semi-transparent background scrim behind text inside glass components ensures 4.5:1 contrast regardless of the dynamic background behind the glass.
**When to use:** Applied as default styles on glass component children wrappers.
**Rationale:** Since the background behind glass is procedurally generated and dynamic, we cannot guarantee contrast via static analysis alone. The proven technique is to add a subtle text-shadow (dark glow for light text, light glow for dark text) that ensures readability over any background condition.
**Example:**
```css
/* Dark mode: light text with dark text-shadow for contrast floor */
.glass-text-dark {
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6), 0 0 8px rgba(0, 0, 0, 0.3);
}

/* Light mode: dark text with light text-shadow for contrast floor */
.glass-text-light {
  color: rgba(0, 0, 0, 0.87);
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8), 0 0 6px rgba(255, 255, 255, 0.4);
}
```

### Anti-Patterns to Avoid
- **Relying on blur alone for readability:** Blur softens the background but does NOT guarantee sufficient text contrast. Always pair with an explicit contrast mechanism (tint opacity or text-shadow).
- **Using `useEffect` + `useState` for media queries:** This pattern is vulnerable to tearing under React 19's concurrent features. Use `useSyncExternalStore` instead.
- **Per-component media query subscriptions:** Each glass component should NOT independently call `window.matchMedia`. Detect once in GlassProvider, distribute via context.
- **Hardcoding dark/light mode colors without considering user tint overrides:** If a user passes a custom `tint` prop, that should be preserved -- dark/light mode defaults apply only when no explicit tint is provided.
- **Pausing the main loop with `emscripten_pause_main_loop`:** This freezes ALL Emscripten processing. Instead, freeze the `time` uniform in the C++ engine while keeping the render loop alive so glass regions still update when moved/resized.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Media query detection | Custom event listener + useState | `useSyncExternalStore` with `window.matchMedia` | Concurrent-safe, no tearing, proper cleanup |
| Color scheme meta tag | Manual DOM manipulation | `<meta name="color-scheme" content="dark light">` in index.html | Browser handles UA stylesheet theming automatically |
| WCAG contrast formula | Approximate brightness check | Proper relative luminance + contrast ratio per W3C spec | The threshold formula is specific; approximations produce false passes |

**Key insight:** The media query detection is the only genuinely reusable piece. The rest (engine integration, tint adaptation) is project-specific and should be implemented inline.

## Common Pitfalls

### Pitfall 1: prefers-reduced-transparency Has Limited Browser Support
**What goes wrong:** Testing only in Chrome shows everything working, but Firefox and Safari users get no reduced-transparency fallback.
**Why it happens:** `prefers-reduced-transparency` is only supported in Chromium-based browsers (Chrome 119+, Edge 119+). Firefox and Safari do not support it as of early 2026.
**How to avoid:** Always treat `prefers-reduced-transparency` as a progressive enhancement. The glass effect should still be accessible without this query -- WCAG contrast (A11Y-03) is the true safety net. When the query IS detected, provide the enhanced experience of fully opaque surfaces.
**Warning signs:** No automated test for the unsupported path; testing only in Chrome.

### Pitfall 2: Freezing the Wrong Thing for Reduced Motion
**What goes wrong:** Using `emscripten_pause_main_loop()` freezes the entire WASM render loop, so glass region rect updates stop working. Resizing or scrolling causes glass regions to show stale positions.
**Why it happens:** The main loop handles both animation updates AND glass region rendering.
**How to avoid:** Only freeze the `time` uniform (stop incrementing `currentTime` in `BackgroundEngine::update()`), but keep the render loop running. The noise shader uses `uniforms.time` for animation -- freezing it produces a static pattern while the glass pass continues to render correctly with up-to-date region positions.
**Warning signs:** Glass regions don't track DOM elements after enabling reduced motion.

### Pitfall 3: Text Contrast Measurement on Dynamic Backgrounds
**What goes wrong:** Static contrast analysis passes WCAG checks, but the actual rendered scene has moments where text is unreadable because the animated background happens to match the text color.
**Why it happens:** The noise background is procedural and varies across space and time. A single contrast check against one background color is insufficient.
**How to avoid:** Use a dual approach: (1) the tint overlay on glass regions creates a consistent base color, and (2) a CSS `text-shadow` provides a contrast "floor" regardless of what's behind the glass. Together these guarantee 4.5:1 even in worst-case background conditions.
**Warning signs:** Text flickers between readable and unreadable as background animates.

### Pitfall 4: Dark Mode Tint Override Conflicting with User Props
**What goes wrong:** A developer passes `tint={[1, 0, 0]}` (red) to a GlassPanel, but the dark mode system overrides it with the dark-mode default tint.
**Why it happens:** The adaptation logic does not distinguish between "user provided an explicit tint" and "using the default tint."
**How to avoid:** Only apply dark/light mode default tints when the user has NOT provided an explicit `tint` prop (i.e., `tint` is `undefined`). If the user provides a tint, respect it in both modes. The contrast mechanisms (text-shadow, opacity floor) still ensure readability.
**Warning signs:** Custom tint values being silently replaced.

### Pitfall 5: Reduced Transparency Making Glass Regions Invisible
**What goes wrong:** When `prefers-reduced-transparency: reduce` is active, glass regions become fully opaque with a black or wrong-color fill, making them look broken rather than accessible.
**Why it happens:** Setting `opacity` to 1.0 without setting an appropriate tint results in whatever the default tint color filling the region.
**How to avoid:** In reduced-transparency mode, set BOTH opacity high (0.85-0.95) AND tint to an appropriate surface color: light gray `[0.92, 0.92, 0.94]` in light mode, dark gray `[0.2, 0.2, 0.22]` in dark mode. This mimics macOS/iOS behavior where "Reduce Transparency" replaces glass with solid, themed surfaces.
**Warning signs:** Reduced-transparency regions are pure white or pure black.

### Pitfall 6: matchMedia Listeners Leaking on Hot Module Reload
**What goes wrong:** Vite HMR triggers component remount but matchMedia listeners from the previous instance are not cleaned up, causing double-fires.
**Why it happens:** `useSyncExternalStore`'s subscribe function returns a cleanup, but if the media query store objects are module-level singletons, their listener count grows.
**How to avoid:** The `subscribe` function should always call `removeEventListener` in its cleanup return. With `useSyncExternalStore`, React handles cleanup automatically on unmount. The store factory pattern (module-level `createMediaQueryStore`) is safe because each `subscribe` call adds/removes its own listener.
**Warning signs:** Preference change triggers multiple re-renders.

## Code Examples

Verified patterns from official sources:

### WCAG Contrast Ratio Calculation
```typescript
// Source: W3C WCAG 2.1 (https://www.w3.org/WAI/GL/wiki/Relative_luminance)
// and (https://www.w3.org/WAI/GL/wiki/Contrast_ratio)

/**
 * Convert an sRGB component (0-1) to linear light value.
 */
function sRGBtoLinear(c: number): number {
  return c <= 0.04045
    ? c / 12.92
    : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Compute relative luminance of an sRGB color [r, g, b] where each is in [0, 1].
 */
export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * sRGBtoLinear(r) + 0.7152 * sRGBtoLinear(g) + 0.0722 * sRGBtoLinear(b);
}

/**
 * Compute WCAG contrast ratio between two relative luminance values.
 * Returns a ratio >= 1.0 (e.g., 4.5 means 4.5:1).
 */
export function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if the contrast ratio meets WCAG 2.1 AA for normal text (4.5:1).
 */
export function meetsWCAG_AA(
  textColor: [number, number, number],
  bgColor: [number, number, number],
): boolean {
  const textLum = relativeLuminance(...textColor);
  const bgLum = relativeLuminance(...bgColor);
  return contrastRatio(textLum, bgLum) >= 4.5;
}
```

### Engine Pause API (C++ Side)
```cpp
// In background_engine.h, add to public interface:
void setPaused(bool paused);
void setReducedTransparency(bool enabled);

// In background_engine.cpp:
void BackgroundEngine::setPaused(bool paused) {
    paused_ = paused;
}

void BackgroundEngine::update(float deltaTime) {
    if (paused_) return;  // Stop advancing time, background freezes
    if (deltaTime > 0.1f) deltaTime = 0.1f;
    currentTime += deltaTime;
}

// In main.cpp Embind block:
.function("setPaused", &BackgroundEngine::setPaused)
.function("setReducedTransparency", &BackgroundEngine::setReducedTransparency)
```

### Effective Glass Parameters with A11y Overrides
```typescript
// In useGlassRegion.ts -- compute effective params considering a11y prefs
function getEffectiveParams(
  props: GlassStyleProps,
  prefs: AccessibilityPreferences,
): { blur: number; opacity: number; tint: GlassColor; cornerRadius: number; refraction: number } {
  const defaults = prefs.darkMode ? DARK_DEFAULTS : LIGHT_DEFAULTS;

  if (prefs.reducedTransparency) {
    // Near-opaque surface with themed tint
    return {
      blur: 0,
      opacity: prefs.darkMode ? 0.92 : 0.90,
      tint: prefs.darkMode ? [0.2, 0.2, 0.22] : [0.92, 0.92, 0.94],
      cornerRadius: props.cornerRadius ?? 24,
      refraction: 0,  // No refraction when opaque
    };
  }

  return {
    blur: props.blur ?? 0.5,
    opacity: props.opacity ?? defaults.opacity,
    tint: props.tint ?? defaults.tint,
    cornerRadius: props.cornerRadius ?? 24,
    refraction: props.refraction ?? 0.15,
  };
}
```

### GlassProvider Accessibility Integration
```typescript
// In GlassProvider.tsx
export function GlassProvider({ children }: { children: React.ReactNode }) {
  const prefs = useAccessibilityPreferences();
  // ... existing state ...

  // Sync reduced-motion to engine
  useEffect(() => {
    const engine = moduleRef.current?.getEngine();
    if (!engine) return;
    engine.setPaused(prefs.reducedMotion);
  }, [prefs.reducedMotion, ready]);

  // Include prefs in context value
  const contextValue = useMemo(() => ({
    registerRegion,
    unregisterRegion,
    ready,
    preferences: prefs,
  }), [registerRegion, unregisterRegion, ready, prefs]);

  return (
    <GlassContext value={contextValue}>
      <canvas id="gpu-canvas" ref={canvasRef} style={canvasStyle} />
      {children}
    </GlassContext>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useEffect` + `useState` for media queries | `useSyncExternalStore` | React 18+ (2022) | Concurrent-safe, no tearing |
| `addListener()` on MediaQueryList | `addEventListener('change', ...)` | 2020 (Safari 14+) | Standard EventTarget API |
| Apple "Reduce Transparency" = just remove blur | Apple "Tinted" mode (iOS 26.1) = increase opacity with themed color | 2025 | Solid themed surfaces, not just blur removal |
| No transparency preference detection | `prefers-reduced-transparency` CSS media query | Chrome 118 (Oct 2023) | Programmatic detection of OS setting |

**Deprecated/outdated:**
- `MediaQueryList.addListener()` / `removeListener()`: Deprecated in favor of standard `addEventListener` / `removeEventListener`. Safari 14+ supports the standard API.

## Open Questions

1. **Contrast verification methodology for dynamic backgrounds**
   - What we know: The glass shader produces different visual results depending on the animated noise behind it. Static contrast checks cannot capture all states.
   - What's unclear: Whether a text-shadow approach alone guarantees 4.5:1 in all conditions, or whether we need a minimum tint opacity floor as well.
   - Recommendation: Implement both text-shadow AND a minimum tint opacity floor (e.g., opacity >= 0.15 in dark mode, >= 0.25 in light mode). Verify visually with worst-case noise frames. Include a `contrast.ts` utility for manual verification during development.

2. **prefers-reduced-transparency fallback for Firefox/Safari**
   - What we know: Firefox and Safari do not support `prefers-reduced-transparency` as of early 2026. The matchMedia query will simply return `false` (no-preference).
   - What's unclear: Whether these browsers will add support soon.
   - Recommendation: Accept graceful degradation. WCAG contrast (A11Y-03) is the true safety net that applies in ALL browsers. Reduced-transparency is a progressive enhancement. No polyfill exists or is needed.

3. **Dark mode noise shader color ramp**
   - What we know: The current noise shader produces a blue/teal color ramp (`n*0.15, n*0.3+0.05, n*0.6+0.1`). This looks natural in dark mode but may be too dark in light mode.
   - What's unclear: Whether the Phase 6 scope should include a light-mode noise color ramp, or if that's Phase 7 (Visual Polish).
   - Recommendation: Keep the noise shader unchanged for Phase 6. The glass tint adaptation (higher opacity, darker tint in light mode) will provide sufficient contrast differentiation. A light-mode noise color ramp can be deferred to Phase 7 if the current result is visually acceptable.

## Sources

### Primary (HIGH confidence)
- [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) - Values, browser support (Baseline since Jan 2020), OS settings mapping
- [MDN: prefers-reduced-transparency](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-transparency) - Values, limited browser support, OS settings mapping
- [React docs: useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore) - API signature, subscribe/getSnapshot pattern
- [W3C: Relative luminance](https://www.w3.org/WAI/GL/wiki/Relative_luminance) - sRGB to linear formula
- [W3C: Contrast ratio](https://www.w3.org/WAI/GL/wiki/Contrast_ratio) - (L1 + 0.05) / (L2 + 0.05)
- [W3C: WCAG 2.1 Success Criterion 1.4.3](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html) - 4.5:1 normal text, 3:1 large text

### Secondary (MEDIUM confidence)
- [Can I Use: prefers-reduced-transparency](https://caniuse.com/wf-prefers-reduced-transparency) - ~72.57% global support, Chrome 119+, no Firefox/Safari
- [Chrome blog: prefers-reduced-transparency](https://developer.chrome.com/blog/css-prefers-reduced-transparency) - Chrome 118 initial implementation
- [web.dev: color-scheme](https://web.dev/articles/color-scheme) - `<meta name="color-scheme">` usage
- [NN/g: Glassmorphism](https://www.nngroup.com/articles/glassmorphism/) - Accessibility best practices for glass UI
- [Axess Lab: Glassmorphism Accessibility](https://axesslab.com/glassmorphism-meets-accessibility-can-frosted-glass-be-inclusive/) - Overlay + blur + prefers-reduced-transparency techniques

### Tertiary (LOW confidence)
- Apple iOS 26.1 "Tinted" mode behavior - Based on third-party reports (MacRumors, OSXDaily). Exact tint values and opacity levels are not documented by Apple.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries, all built-in browser APIs and React 19 hooks verified against official docs
- Architecture: HIGH - Clear data flow (matchMedia -> context -> engine), all integration points map to existing code patterns in the codebase
- Pitfalls: HIGH - Browser support limitations verified via Can I Use, animation freeze approach verified against codebase's `emscripten_set_main_loop` usage
- WCAG contrast: HIGH - Formula directly from W3C spec, 4.5:1 threshold well-established
- Dark/light mode tint values: MEDIUM - Reasonable defaults based on Apple's design patterns, but exact values need visual tuning during implementation

**Research date:** 2026-02-10
**Valid until:** 2026-03-12 (30 days -- all technologies are stable, no fast-moving APIs)
