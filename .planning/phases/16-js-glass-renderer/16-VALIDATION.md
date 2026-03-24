---
phase: 16
slug: js-glass-renderer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (Wave 0 installs) + Playwright (existing) |
| **Config file** | vitest.config.ts (Wave 0 creates) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run && npx tsx test-glass-render.ts` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run full suite + Playwright visual check
- **Before `/gsd:verify-work`:** Full suite must be green + screenshot verified
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | GLASS-01 | unit | `npx vitest run` (shader loads) | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | GLASS-03 | unit | `npx vitest run` (uniform layout) | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 1 | GLASS-02 | build | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 16-02-02 | 02 | 1 | GLASS-04 | visual | Playwright screenshot | ✅ | ⬜ pending |
| 16-02-03 | 02 | 1 | GLASS-05 | visual | Playwright resize test | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest` + `@vitest/coverage-v8` installed
- [ ] `vitest.config.ts` created
- [ ] `src/renderer/__tests__/uniforms.test.ts` — uniform buffer layout tests
- [ ] `src/renderer/__tests__/shader.test.ts` — shader string loads correctly

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Glass visual quality | GLASS-01 | Perceptual quality of refraction/blur | Playwright screenshot + visual inspection |
| Multi-region rendering | GLASS-02 | Multiple regions visible simultaneously | Playwright screenshot with test harness |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
