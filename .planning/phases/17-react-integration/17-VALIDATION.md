---
phase: 17
slug: react-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) + Playwright (existing) |
| **Config file** | vitest.config.ts, playwright.config.ts |
| **Quick run command** | `npx vitest run && npx tsc --noEmit` |
| **Full suite command** | `npx vitest run && npx playwright test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx vitest run && npx playwright test`
- **Before `/gsd:verify-work`:** Full suite + Playwright screenshot against live background
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | REACT-01 | build | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 17-01-02 | 01 | 1 | REACT-02, REACT-03 | build+visual | `npx tsc --noEmit && npx playwright test` | ✅ | ⬜ pending |
| 17-02-01 | 02 | 2 | REACT-04 | build | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 17-02-02 | 02 | 2 | REACT-01..04 | visual | Playwright screenshot with live background | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. vitest and Playwright already installed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Glass visual quality over wallpaper | REACT-01 | Perceptual quality | Playwright screenshot + visual review |
| Reduced-motion a11y | REACT-04 | OS-level preference | Toggle in browser DevTools |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity maintained
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
