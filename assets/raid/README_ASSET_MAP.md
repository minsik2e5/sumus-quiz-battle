# SUMUS RAID ASSETS FOR CODEX

## Purpose
This ZIP is the organized asset drop for the current SUMUS RAID visual integration work.

## Included canonical assets
- Player: 8 states
- COMMON: 4 states
- ELITE: 5 states
- BOSS: 6 states
- Confirmed/usable FX: 11 states

Total canonical files copied: 34

## Folder structure
```text
assets/raid/
  player/
  common/
  elite/
  boss/
  fx/
_pending_review/
_reference/
manifest.json
```

## Important integration rules
1. Use the canonical filenames and folders in `assets/raid/`.
2. Keep the existing SVG/CSS fallback in the project.
3. Missing asset must never block gameplay.
4. Presentation/assets must not mutate RAID gameplay state.
5. RUN modules must remain untouched.
6. PNG may be converted to WebP during integration, but preserve transparency and aspect ratio.

## Not finalized yet
The following are intentionally NOT supplied as canonical final FX:
- raid-fx-revive
- raid-fx-word-tamed
- raid-fx-special
- raid-fx-combo-aura

Candidate/reference images are in `_pending_review/`.
Codex should keep fallbacks for these until final approved images are supplied.

## Review note
A few pose mappings were selected from the approved visual family rather than generated with an exact canonical filename.
See `manifest.json` for source filename and notes before converting/cropping.

## Missing runtime sources
- None
