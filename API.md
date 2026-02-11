# LiquidGlass React API Reference

Real-time glass refraction effects for React, powered by WebGPU and WASM.

## Quick Start

```bash
npm install liquidglass-react
```

```tsx
import { GlassProvider, GlassPanel } from 'liquidglass-react';

function App() {
  return (
    <GlassProvider>
      <GlassPanel blur={0.6} cornerRadius={28} style={{ width: 320, padding: 32 }}>
        <h2>Hello Glass</h2>
        <p>This text sits on a frosted glass surface.</p>
      </GlassPanel>
    </GlassProvider>
  );
}
```

## Components

### GlassProvider

Required wrapper component that initializes the WebGPU engine and manages the glass rendering pipeline. Must wrap all glass components.

- Creates a full-viewport `<canvas>` element automatically (fixed position, z-index -1)
- Manages engine lifecycle (init, resize, cleanup)
- Tracks all glass regions via `requestAnimationFrame` position sync
- Automatically detects OS accessibility preferences (reduced motion, reduced transparency, color scheme)
- **Only one `<GlassProvider>` per page** (hardcoded canvas ID constraint)

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `children` | `React.ReactNode` | Child components to render |

**Usage:**

```tsx
import { GlassProvider } from 'liquidglass-react';

function App() {
  return (
    <GlassProvider>
      {/* All glass components go here */}
    </GlassProvider>
  );
}
```

### GlassPanel

A glass-effect container that renders as a `<div>`. Accepts all shared glass style props plus standard div attributes.

**Props:** All [GlassStyleProps](#shared-props-glassstyleprops) plus:

| Prop | Type | Description |
|------|------|-------------|
| `children` | `React.ReactNode` | Content to render inside the panel |
| `className` | `string` | CSS class name |
| `style` | `React.CSSProperties` | Inline styles |
| `ref` | `React.Ref<HTMLDivElement>` | Forwarded ref to the underlying div |

**Usage:**

```tsx
import { GlassPanel } from 'liquidglass-react';

<GlassPanel
  blur={0.6}
  opacity={0.08}
  cornerRadius={28}
  tint={[0.8, 0.85, 1.0]}
  style={{ width: 340, padding: 32, textAlign: 'center' }}
>
  <h2>Glass Panel</h2>
  <p>A frosted glass container with contrast-safe text.</p>
</GlassPanel>
```

### GlassButton

A glass-effect button with built-in hover and active morph transitions. Renders as a `<button>`.

**Built-in morph states:**
- **Hover:** specular 1.8x, rim 2.0x, aberration 1.5x, blur 0.8x
- **Active/pressed:** blur 0.3x (a "closer to surface" feel)

These multipliers are applied to the prop values (or their defaults) and animate smoothly via the morph system.

**Props:** All [GlassStyleProps](#shared-props-glassstyleprops) plus:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `React.ReactNode` | | Button content |
| `className` | `string` | | CSS class name |
| `style` | `React.CSSProperties` | | Inline styles |
| `ref` | `React.Ref<HTMLButtonElement>` | | Forwarded ref |
| `onClick` | `React.MouseEventHandler` | | Click handler |
| `disabled` | `boolean` | `false` | Disables button and hover effects |
| `type` | `'button' \| 'submit' \| 'reset'` | `'button'` | HTML button type |

Note: `cornerRadius` defaults to `16` for GlassButton (smaller than the panel/card default of 24).

**Usage:**

```tsx
import { GlassButton } from 'liquidglass-react';

<GlassButton
  blur={0.5}
  cornerRadius={16}
  refractionMode="prominent"
  onClick={() => console.log('clicked')}
  style={{ padding: '14px 36px', fontSize: '1rem' }}
>
  Click Me
</GlassButton>
```

### GlassCard

A glass-effect card that renders as an `<article>`. Semantically appropriate for content cards, blog posts, or feature sections.

**Props:** All [GlassStyleProps](#shared-props-glassstyleprops) plus:

| Prop | Type | Description |
|------|------|-------------|
| `children` | `React.ReactNode` | Card content |
| `className` | `string` | CSS class name |
| `style` | `React.CSSProperties` | Inline styles |
| `ref` | `React.Ref<HTMLElement>` | Forwarded ref to the underlying article |

**Usage:**

```tsx
import { GlassCard } from 'liquidglass-react';

<GlassCard
  blur={0.7}
  cornerRadius={20}
  tint={[0.8, 0.85, 1.0]}
  aberration={4}
  specular={0.3}
  rim={0.2}
  style={{ width: 340, padding: 24 }}
>
  <h3>Feature Card</h3>
  <p>Content with glass refraction behind it.</p>
</GlassCard>
```

## Shared Props (GlassStyleProps)

All glass components accept these visual style props:

| Prop | Type | Default | Range | Description |
|------|------|---------|-------|-------------|
| `blur` | `number` | `0.5` | 0 -- 1 | Blur intensity. 0 = sharp refraction, 1 = maximum frosted glass. |
| `opacity` | `number` | `0.05` | 0 -- 1 | Opacity of the tint overlay. 0 = fully transparent, 1 = fully tinted. |
| `cornerRadius` | `number` | `24` | 0 -- 50+ | Corner radius in CSS pixels. GlassButton defaults to 16. |
| `tint` | `GlassColor` | `[1, 1, 1]` | [0,1] per channel | Tint color as [R, G, B]. White by default; adapts to dark/light mode when not explicitly set. |
| `refraction` | `number` | `0.15` | 0 -- 0.3 | Refraction strength at glass edges. 0 = no lens effect, 0.3 = strong lens. |
| `aberration` | `number` | `3` | 0 -- 10 | Chromatic aberration intensity in pixels. Creates RGB color fringing at edges. |
| `specular` | `number` | `0.2` | 0 -- 1 | Specular highlight intensity. A bright spot simulating light reflection. |
| `rim` | `number` | `0.15` | 0 -- 1 | Rim lighting intensity. A glow effect at the edges of the glass. |
| `refractionMode` | `'standard' \| 'prominent'` | `'standard'` | | Refraction mode. Prominent applies enhanced multipliers: refraction 1.8x, specular 1.5x, rim spread 2x, aberration 1.5x. |
| `morphSpeed` | `number` | `8` | 0 -- 20 | Morph transition speed. 0 = instant snap, 8 = smooth ~0.4s transitions. Uses exponential decay interpolation for frame-rate independence. |

## Types

All types are exported from the package root:

```tsx
import type {
  GlassStyleProps,
  GlassPanelProps,
  GlassButtonProps,
  GlassCardProps,
  GlassColor,
  AccessibilityPreferences,
  GlassContextValue,
  GlassRegionHandle,
} from 'liquidglass-react';
```

### GlassStyleProps

Shared visual style props accepted by all glass components. See [Shared Props](#shared-props-glassstyleprops) table above.

### GlassPanelProps

Extends `GlassStyleProps` with `children`, `className`, `style`, and `ref` (typed to `HTMLDivElement`).

### GlassButtonProps

Extends `GlassStyleProps` with `children`, `className`, `style`, `ref` (typed to `HTMLButtonElement`), `onClick`, `disabled`, and `type`.

### GlassCardProps

Extends `GlassStyleProps` with `children`, `className`, `style`, and `ref` (typed to `HTMLElement`).

### GlassColor

```typescript
type GlassColor = [r: number, g: number, b: number];
```

RGB color tuple with each channel in the `[0, 1]` range.

### AccessibilityPreferences

```typescript
interface AccessibilityPreferences {
  reducedMotion: boolean;
  reducedTransparency: boolean;
  darkMode: boolean;
}
```

OS-level accessibility and theme preferences detected via `matchMedia`.

### GlassContextValue (Advanced)

```typescript
interface GlassContextValue {
  registerRegion(element: HTMLElement): GlassRegionHandle | null;
  unregisterRegion(id: number): void;
  ready: boolean;
  preferences: AccessibilityPreferences;
}
```

The value provided by `GlassProvider` via React context. Available through `useGlassEngine()`.

### GlassRegionHandle (Advanced)

```typescript
interface GlassRegionHandle {
  id: number;
  updateRect(x: number, y: number, w: number, h: number): void;
  updateParams(cornerRadius: number, blur: number, opacity: number, refraction: number): void;
  updateTint(r: number, g: number, b: number): void;
  updateAberration(intensity: number): void;
  updateSpecular(intensity: number): void;
  updateRim(intensity: number): void;
  updateMode(mode: number): void;
  updateMorphSpeed(speed: number): void;
  remove(): void;
}
```

Low-level handle for directly controlling a glass region. Returned by `registerRegion()`. Most users should use the component API instead.

## Hooks

### useGlassEngine()

```typescript
function useGlassEngine(): GlassContextValue;
```

Returns the glass engine context. Must be called within a `<GlassProvider>`.

Throws an error if used outside of a provider.

**Usage:**

```tsx
import { useGlassEngine } from 'liquidglass-react';

function StatusIndicator() {
  const { ready, preferences } = useGlassEngine();

  if (!ready) return <p>Loading WebGPU engine...</p>;

  return (
    <p>
      Engine ready. Dark mode: {preferences.darkMode ? 'on' : 'off'}.
      Reduced motion: {preferences.reducedMotion ? 'on' : 'off'}.
    </p>
  );
}
```

For advanced use cases, `registerRegion` and `unregisterRegion` provide direct control over glass regions without using the built-in components.

## Accessibility

Glass components automatically adapt to OS-level accessibility preferences:

**prefers-reduced-motion: reduce**
The procedural background animation freezes (time uniform stops advancing). Morph transitions between parameter changes continue to work so users still see state changes, but the continuously-animated background stops.

**prefers-reduced-transparency: reduce**
Components render near-opaque, reducing the glass transparency effect for users who find transparent surfaces difficult to read.

**prefers-color-scheme: dark / light**
When no explicit `tint` prop is provided, the tint color adapts automatically to the OS color scheme. Text color and text-shadow also adapt: white text with dark shadow in dark mode, dark text with light shadow in light mode, ensuring WCAG 2.1 AA contrast compliance.

**WCAG 2.1 AA contrast**
All glass components apply text-shadow to maintain readable text over the transparent glass surface. The shadow color and intensity adapt to dark/light mode automatically.

## Requirements

- **Browser:** WebGPU-capable browser (Chrome 113+, Edge 113+, Safari 18+)
- **React:** 18 or 19
- **Environment:** Client-side only (no SSR)

## Limitations

- **Single GlassProvider per page.** The WebGPU canvas uses a hardcoded element ID. Multiple providers will conflict.
- **No SSR support.** The WASM engine and WebGPU require browser APIs. Components will not render during server-side rendering.
- **No non-WebGPU fallback.** If the browser does not support WebGPU, the glass effect will not render. The engine initialization check (`navigator.gpu`) will fail silently, and components render as transparent containers.
- **Maximum 16 glass regions.** The engine supports up to 16 simultaneous glass regions on screen.
