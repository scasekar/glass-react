---
phase: 18-visual-validation
plan: 02
subsystem: pipeline
tags: [tuning, coordinate-descent, visual-parity, presets, ios-reference]
---

## Performance

- **Duration:** 8 min (including tuning runs)

## Accomplishments
- Fixed capture mode: removed text "5" from GlassButton (matches iOS Color.clear)
- Fixed morphSpeed=0 instant snap bug in morphLerp (was no-op, now snaps immediately)
- Updated pipeline config to target demo server (port 5174) with capture mode
- Re-tuned Clear Light preset: 0.40% → 0.35% mismatch (better than v2.0's 0.40%)
- Re-tuned Clear Dark preset: 0.85% → 0.69% mismatch (better than v2.0's 0.85%)
- Updated presets.ts with v3.0 tuned values

## Task Commits
- `7bd8278`: fix(18): fix capture mode shape + morphSpeed=0 instant snap + pipeline port
- `118bd87`: fix(18): re-tune presets against iOS ground truth (0.35% light, 0.69% dark)

## Deviations
- Initial 18-01 scores were ~16% due to shape mismatch (square vs circle) — fixed by removing text content and fixing morphSpeed=0
- Pipeline config port changed from 5173 to 5174 (demo server has capture mode, main server doesn't)

## Decisions
- [18-02] morphSpeed=0 means instant snap, not "no animation" — critical for capture mode
- [18-02] Pipeline targets port 5174 (demo server with capture mode in demo/App.tsx)
- [18-02] v3.0 JS pipeline achieves better iOS parity than v2.0 C++ pipeline

## Self-Check: PASSED
- [x] Presets tuned against iOS Simulator ground truth
- [x] Light score (0.35%) ≤ v2.0 baseline (0.40%)
- [x] Dark score (0.69%) ≤ v2.0 baseline (0.85%)
- [x] Automated diff pipeline functional
