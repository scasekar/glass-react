# Stack Research

**Domain:** Apple Liquid Glass UI control library and showcase page
**Researched:** 2026-03-25
**Scope:** v4.0 milestone — NEW additions only. Existing validated stack (React 19, Vite 6.4, TypeScript, WebGPU/WASM pipeline, Playwright, inline styles) is unchanged and out of scope.
**Confidence:** HIGH (all versions npm-verified on 2026-03-25; patterns corroborated by official documentation)

---

## Existing Stack Context (Do Not Re-research)

The following is already in production and requires no changes for v4.0:

| Technology | Version | Status |
|------------|---------|--------|
| React | 19.2.4 | Peer dep, unchanged |
| Vite | 6.4.1 | Build + dev server, unchanged |
| TypeScript | 5.9.3 | Strict mode, unchanged |
| GlassRenderer (JS WebGPU) | in-repo | All glass effects, unchanged |
| GlassPanel / GlassButton / GlassCard | in-repo | Base components, extended in v4.0 |
| Inline styles only (no CSS files) | project convention | Styling approach, unchanged |
| Playwright | 1.58.2 | E2E testing, unchanged |
| Vitest | 4.1.1 | Unit tests, unchanged |

---

## New Additions Required for v4.0

### 1. Spring Animation — `motion` (formerly Framer Motion)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `motion` | ^12.38.0 | Spring physics animations, layout transitions, gesture state | Apple's controls are defined by spring physics. A toggle thumb that snaps with `stiffness: 500, damping: 30` is instantly recognizable as iOS. CSS `transition` cannot reproduce damped spring overshoot. Motion v12 is the rebranded `framer-motion` — same API, new package name and import path (`motion/react`). GPU-accelerated via WAAPI, 120fps capable, 30M+ monthly downloads. |

**Why spring physics are non-negotiable for Apple controls:**
- Toggle thumb: slides with spring, not linear ease. The slight overshoot before settle is a signature iOS micro-interaction.
- Segmented control indicator: glides between segments using `layoutId` layout animation — this is Motion's unique capability that React Spring and CSS transitions cannot replicate.
- Modal/sheet entry: spring scale from 0.95 to 1.0, not a timed ease-in-out.
- Popover: spring opacity + scale from anchor point.

**`layoutId` is the deciding factor over React Spring:** Motion's layout animations (`<motion.div layoutId="indicator" />`) allow the segmented control floating pill to physically morph between segments without the developer manually calculating positions. React Spring has no equivalent. This alone justifies the dependency.

**Why not `framer-motion` (old package):** Deprecated. `motion` is the replacement. Import path is `motion/react` instead of `framer-motion`.

**Why not CSS transitions:** No spring physics. No layout animations. `transition: all 0.3s ease` produces animations that feel generic, not iOS-native.

**Why not GreenSock (GSAP):** Not React-idiomatic, license restrictions on some features, no layout animations.

---

### 2. Headless Accessible Primitives — Radix UI

Interactive controls require WAI-ARIA roles, keyboard navigation, focus management, and screen reader announcements. Implementing these from scratch for each control violates the accessibility requirements established in v1.0 and is 2-3x the implementation work per component.

Radix UI provides unstyled, behavior-only primitives. Each primitive is a separate npm package — tree-shakeable. The `asChild` pattern allows any Radix component to render as a custom element (e.g., a `GlassPanel`-wrapped div) without breaking the ARIA behavior.

**Verified npm versions (2026-03-25):**

| Package | Version | ARIA Role / Behavior | Why This One |
|---------|---------|---------------------|--------------|
| `@radix-ui/react-switch` | ^1.2.6 | `role="switch"`, Space key toggle, `aria-checked` | WAI-ARIA Switch pattern; handles both controlled and uncontrolled state |
| `@radix-ui/react-slider` | ^1.3.6 | `role="slider"`, arrow key adjustment, `aria-valuenow/min/max` | Supports multi-thumb, step, range; keyboard increments follow ARIA spec |
| `@radix-ui/react-toggle-group` | ^1.1.11 | Roving `tabindex`, arrow key navigation between items, `aria-pressed` | Correct pattern for segmented controls: single or multiple selection, keyboard-accessible |
| `@radix-ui/react-dialog` | ^1.1.15 | Focus trap, Escape dismiss, scroll lock, `aria-modal`, portal | Modal sheets and alert dialogs; portals to `document.body` to escape z-index stacking context |
| `@radix-ui/react-popover` | ^1.1.15 | Anchor positioning, outside-click dismiss, Escape key, portal | Popovers anchored to glass buttons; handles flip/collision detection |
| `@radix-ui/react-tooltip` | ^1.2.8 | Hover+focus open, delay, `aria-describedby` | Glass tooltips with configurable delay; pairs with `aria-describedby` on trigger |
| `@radix-ui/react-select` | ^2.2.6 | Full keyboard nav, virtual focus, screen reader announcements | Glass dropdown pickers for color/option selection in showcase controls |

**Why Radix over Headless UI (`@headlessui/react`):**
Headless UI is a monolithic package. Radix is individual packages per primitive — installers only take what they use, keeping library bundle lean. Radix's `asChild` composition is also cleaner for "wrap in glass shell" pattern than Headless UI's render props.

**Why Radix over React Aria (Adobe):**
React Aria is hooks-only and requires significantly more wiring per component (useSwitch, useToggleState, etc. composed manually). Radix's component tree maps cleanly to GlassPanel wrappers. React Aria is the better choice when you need maximum DOM attribute control; Radix is better when you want a composable tree.

**Why not build from scratch:**
Focus trap alone (required for modals) involves tabbable element detection, portal rendering, scroll locking, and restoration — a known footgun. ARIA switch/slider keyboard patterns are precisely specified by W3C and easy to implement incorrectly. Radix has been battle-tested by millions of installs.

---

## Styling Approach — Extend Existing Pattern

The project already uses **inline styles exclusively** (no CSS files, no CSS modules, no utility classes). All new controls follow the same pattern.

**Why inline styles are correct for this library:**
- Glass controls are heavily prop-parameterized: corner radius, tint color, opacity, blur intensity — all driven by TypeScript props. CSS cannot bind to dynamic JS values without CSS custom properties gymnastics.
- No external stylesheet means zero specificity conflicts when consumers import the library into their own apps.
- All existing components (GlassPanel, GlassButton, GlassCard) use inline styles — consistency matters for the library's internal conventions.

**Apple HIG constants to add as TypeScript `const` objects:**

```typescript
// src/tokens.ts — Apple 8pt grid + exact iOS control dimensions
export const APPLE_SPACING = {
  xs: 4, sm: 8, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 48
} as const;

export const APPLE_RADII = {
  sm: 8, md: 14, lg: 20, xl: 28, pill: 9999
} as const;

export const APPLE_CONTROL_SIZES = {
  toggleWidth: 51, toggleHeight: 31,    // Exact iOS toggle dimensions
  sliderTrackHeight: 4,                 // iOS slider track height
  segmentedHeight: 32,                  // iOS segmented control height
} as const;
```

These are TypeScript constants, not CSS variables. This keeps the design system co-located with the components and typed.

**Typography — system font stack, no external font package:**

```typescript
// Applied via inline style on all text-bearing glass controls
fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif'
```

`-apple-system` resolves to SF Pro on macOS/iOS (Apple's native UI font). It falls back gracefully on Windows/Android. **Do NOT add Inter, Geist, or any web font package.** Apple devices render SF Pro natively via the system font stack — importing a web font would visually downgrade the experience on the exact devices being targeted.

SF Pro cannot be embedded as a web font (Apple's licensing explicitly prohibits redistribution). The system font stack is the correct and only legal approach.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Tailwind CSS | Requires consumers to install Tailwind; breaks library distribution model; inline styles already established and sufficient | Inline styles + TypeScript design tokens |
| styled-components / Emotion | Runtime style injection (CSS-in-JS) conflicts with WebGPU canvas z-stacking context; adds ~15-20KB to bundle; runtime overhead | Inline styles |
| `framer-motion` (old package) | Deprecated — no longer actively developed; `motion` is the drop-in replacement | `motion` ^12 |
| React Spring | No layout animations; cannot reproduce segmented control floating indicator morphing | `motion` ^12 with `layoutId` |
| GreenSock (GSAP) | Not React-idiomatic; commercial license for some features; no layout animations | `motion` ^12 |
| `@headlessui/react` | Monolithic package; less composable than Radix for the "wrap in glass shell" pattern | `@radix-ui/*` individual packages |
| shadcn/ui | Copy-paste model that generates files into the consumer's repo; requires Tailwind; antithetical to publishable library distribution | `@radix-ui/*` primitives directly |
| CSS `backdrop-filter: blur()` for glass effects | Already handled by the WebGPU GlassRenderer pipeline; adding CSS backdrop-filter creates a double-blur artifact on top of the GPU glass and degraded GPU performance | GlassRenderer pipeline only |
| External icon library (lucide-react, react-icons) | Adds 5-50KB for showcase-only icons; inline SVG components are sufficient and keep bundle lean | Inline SVG as TypeScript components |
| Any external font package (Inter, Geist, etc.) | Degrades Apple-native typography on macOS/iOS; SF Pro is already available via system font stack | `-apple-system` system font stack |

---

## Optional — Phase-Dependent Additions

Only install if the corresponding control is in v4.0 scope:

| Library | Version | Purpose | When to Add |
|---------|---------|---------|-------------|
| `@radix-ui/react-progress` | ^1.1.8 | Progress bar (ARIA progressbar role) | Only if progress indicators are in scope |
| `@radix-ui/react-scroll-area` | ^1.2.10 | Custom scrollbar with glass styling | Only if showcase page requires glass-styled scrollbars |

---

## Installation

```bash
# Animation — required for interactive controls
npm install motion

# Radix UI primitives — install only what you build
npm install @radix-ui/react-switch @radix-ui/react-slider @radix-ui/react-toggle-group
npm install @radix-ui/react-dialog @radix-ui/react-popover @radix-ui/react-tooltip
npm install @radix-ui/react-select
```

These are production dependencies (shipped with the library), not devDependencies. Consumers who import glass controls need these at runtime.

---

## Alternatives Considered

| Recommended | Alternative | When Alternative Is Better |
|-------------|-------------|---------------------------|
| `motion` ^12 | CSS transitions only | When controls are decorative-only with no spring physics requirement |
| `motion` ^12 | `react-spring` | Never for this project — layout animations are required |
| `@radix-ui/*` | React Aria hooks | When you need maximum per-attribute DOM control and can afford extra wiring per component |
| `@radix-ui/*` | Build from scratch | Never — ARIA compliance from scratch is 2-3x work per component |
| Inline styles | CSS Modules | When building a non-library app where scoped CSS performance matters more than prop-driven parameterization |
| System font stack | Hosted web font (Inter, etc.) | When targeting non-Apple platforms where SF Pro system font is not present |

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `motion` ^12.38.0 | React ^18 and ^19 | No breaking changes from framer-motion; import from `motion/react` not `framer-motion` |
| `@radix-ui/*` ^1.x / ^2.x | React ^18 and ^19 | All Radix packages support React 19 concurrent features; no forwardRef wrapping needed with React 19 |
| `motion` ^12 + `@radix-ui/react-dialog` | Compatible | Use `motion.div` as the inner content wrapper inside `Dialog.Content`; do not apply `motion` directly to Radix portal root |
| `motion` ^12 + Radix `asChild` | Compatible | `<Radix.Root asChild><motion.div>...</motion.div></Radix.Root>` — standard composition pattern |

---

## Sources

- npm registry (direct query, 2026-03-25) — `motion` 12.38.0, all `@radix-ui/*` versions — HIGH confidence
- [motion.dev/docs/react](https://motion.dev/docs/react) — Official Motion v12 React docs, import path `motion/react` — HIGH confidence
- [motion.dev/docs/react-upgrade-guide](https://motion.dev/docs/react-upgrade-guide) — framer-motion to motion migration, no API breaking changes — HIGH confidence
- [radix-ui.com/primitives/docs/components/switch](https://www.radix-ui.com/primitives/docs/components/switch) — WAI-ARIA switch role, keyboard behavior — HIGH confidence
- [radix-ui.com/primitives/docs/components/slider](https://www.radix-ui.com/primitives/docs/components/slider) — Range slider ARIA attributes — HIGH confidence
- [radix-ui.com/primitives/docs/components/toggle-group](https://www.radix-ui.com/primitives/docs/components/toggle-group) — Roving tabindex, segmented control pattern — HIGH confidence
- [radix-ui.com/primitives/docs/components/dialog](https://www.radix-ui.com/primitives/docs/components/dialog) — Focus trap, portal, scroll lock — HIGH confidence
- [caniuse.com/css-backdrop-filter](https://caniuse.com/css-backdrop-filter) — backdrop-filter Baseline 2024, all modern browsers — HIGH confidence (confirms CSS glass is technically possible but intentionally excluded)
- [developer.apple.com/fonts](https://developer.apple.com/fonts/) — SF Pro not licensed for web embedding — HIGH confidence
- [css-tricks.com/snippets/css/system-font-stack](https://css-tricks.com/snippets/css/system-font-stack/) — `-apple-system` resolves to SF Pro on Apple platforms — HIGH confidence
- WebSearch, multiple queries (2026-03-25) — Apple HIG iOS 26 control dimensions, Liquid Glass design patterns — MEDIUM confidence (no official Apple numerical spec found publicly; dimensions from community reference implementations)

---

*Stack research for: Apple Liquid Glass UI Control Library and Showcase Page (v4.0)*
*Researched: 2026-03-25*
