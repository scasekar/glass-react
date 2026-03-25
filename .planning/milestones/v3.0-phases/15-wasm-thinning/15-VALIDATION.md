---
phase: 15
slug: wasm-thinning
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification (WASM build + visual check + binary size) |
| **Config file** | engine/CMakeLists.txt |
| **Quick run command** | `cd engine && mkdir -p build && cd build && emcmake cmake .. && emmake make -j$(nproc) 2>&1 | tail -5` |
| **Full suite command** | `npm run build && npm run dev` (visual verification) |
| **Estimated runtime** | ~30 seconds (WASM build) |

---

## Sampling Rate

- **After every task commit:** Run WASM build to verify compilation
- **After every plan wave:** Run full build + visual check (background renders without glass)
- **Before `/gsd:verify-work`:** Full build + dev server + visual inspection
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | DEV-03 | build | WASM compile succeeds | ✅ | ⬜ pending |
| 15-01-02 | 01 | 1 | DEV-04 | grep | No emscripten_set_main_loop in source | ✅ | ⬜ pending |
| 15-01-03 | 01 | 1 | DEV-05 | size | WASM binary smaller than v2.0 | ✅ | ⬜ pending |
| 15-02-01 | 02 | 1 | DEV-01 | build | JS device creation + WASM init succeeds | ✅ | ⬜ pending |
| 15-02-02 | 02 | 1 | DEV-02 | visual | Background renders with external device | ✅ | ⬜ pending |
| 15-02-03 | 02 | 1 | DEV-04 | visual | JS rAF drives rendering | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. WASM build system and dev server are in place.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Background renders correctly | DEV-03 | Visual quality check | Open dev server, verify noise/image background renders |
| Scene texture accessible from JS | DEV-04 | GPU object validation | Console log GPUTexture from getSceneTextureHandle() |
| No glass shader artifacts | DEV-03 | Visual absence check | Verify no glass overlay rendering |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
