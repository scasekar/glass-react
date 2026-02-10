# Pitfalls Research: LiquidGlass-React-WASM

## P1: ASYNCIFY Binary Size Explosion

**Risk:** High
**Phase:** 1 (Engine Foundation)

Enabling `-sASYNCIFY=1` can increase WASM binary size by 80%+ (e.g., 10MB → 18MB). This bloats download and slows startup.

**Warning signs:** .wasm file > 5MB, slow initial load
**Prevention:**
- Use `ASYNCIFY_ONLY` to limit instrumented functions to only those that need it (adapter/device request)
- Use `emscripten_set_main_loop` for render loop instead of ASYNCIFY
- Consider JSPI (`-sASYNCIFY=2`) as alternative — but note it's 350x slower for JS→WASM calls
- Run `wasm-opt` to optimize binary size post-build
- Use streaming instantiation (`WebAssembly.instantiateStreaming`)

## P2: GPU Device Sharing Failure

**Risk:** Critical
**Phase:** 1-2 (Engine + Bridge)

If C++ and JS create separate GPUDevices, textures cannot be shared between them. This is a fundamental architecture failure with no workaround.

**Warning signs:** "GPUTexture is not valid" errors, black screen on glass components
**Prevention:**
- Establish device sharing pattern in Phase 1 — do not defer
- JS creates device, passes handle to C++ (Approach A from Architecture)
- Verify texture created by C++ is readable by JS render pass before building anything else
- Test with a simple "render solid color in C++, sample in JS" before adding complexity

## P3: WASM Signature Mismatch → GPU Crashes

**Risk:** High
**Phase:** 1 (Engine Foundation)

If JavaScript passes incorrect types (float instead of int, wrong pointer) to WASM functions that forward to WebGPU, the GPU driver receives invalid memory addresses, causing tab crashes with no useful error.

**Warning signs:** Tab crashes without console errors, GPU process killed
**Prevention:**
- Use strongly-typed Embind bindings, not raw extern "C"
- Validate all parameters at the JS/WASM boundary
- WebGPU validation is on by default — check console for detailed error messages
- Test incrementally: get each API call working before combining

## P4: Buffer/Texture Per-Frame Allocation

**Risk:** Medium
**Phase:** 2-3 (Bridge + Components)

Creating new GPUBuffers or GPUTextures every frame causes memory leaks and GC pressure. WebGPU cannot update a buffer currently in use by GPU.

**Warning signs:** Growing memory usage over time, frame drops after minutes
**Prevention:**
- Pre-allocate uniform buffers at init, reuse via `writeBuffer()`
- Use double/triple buffering for dynamic data
- Background texture: create once, resize only on canvas resize
- Static material properties: write to uniform buffer once at init, not per-frame

## P5: React Re-renders Disrupting GPU Pipeline

**Risk:** Medium
**Phase:** 2-3 (Bridge + Components)

React state changes can trigger component re-renders that destroy/recreate canvas elements or WebGPU contexts, breaking the render pipeline.

**Warning signs:** Canvas flickers, WebGPU context lost on state change
**Prevention:**
- Canvas element: use `useRef`, never let React control canvas DOM
- WebGPU context: initialize in `useEffect` with proper cleanup
- Render loop: run via `requestAnimationFrame` outside React's render cycle
- Separate GPU state from React state — GPU resources in refs, not state

## P6: Browser Compatibility Gaps

**Risk:** Medium
**Phase:** All

WebGPU ships in Chrome, Firefox 141+, Safari 26+. But implementations differ:
- Safari has Metal-imposed 256MB buffer limit
- Firefox on macOS requires Apple Silicon + macOS Tahoe
- Mobile: Chrome Android 12+, Firefox Android behind flag, Safari iOS 26+

**Warning signs:** Works in Chrome, breaks in Safari/Firefox
**Prevention:**
- Test in Chrome + Safari + Firefox from Phase 1
- Don't rely on Chrome-only WebGPU extensions
- Stick to core WebGPU spec features
- Document minimum browser versions clearly

## P7: Canvas Resize Handling

**Risk:** Low-Medium
**Phase:** 2 (Bridge)

Canvas resize requires recreating swap chain textures and resizing the background texture. If not handled, glass effect distorts or crashes.

**Warning signs:** Distorted glass on window resize, errors on fullscreen toggle
**Prevention:**
- ResizeObserver on canvas element
- Debounce resize to avoid texture thrashing
- C++ engine needs `resize(w, h)` API called from JS
- Recreate swap chain configuration on resize

## P8: WASM Module Loading Latency

**Risk:** Low-Medium
**Phase:** 1 (Engine Foundation)

Large WASM binaries take time to download, compile, and instantiate. Users see a blank screen.

**Warning signs:** > 2 second blank screen on initial load
**Prevention:**
- Use `WebAssembly.instantiateStreaming()` (1.8x faster than non-streaming)
- Show loading indicator while WASM initializes
- Optimize binary with `wasm-opt -O3`
- Consider code splitting if binary exceeds 5MB
- Set proper Content-Type and caching headers for .wasm files
