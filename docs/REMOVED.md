# Removed features

Do not reintroduce anything listed here without an explicit decision. Check this file before adding a feature back.

## Demo videos (removed Oct 14, 2026)
- Code removed: `<video>` playback in `ServiceVisual`, `categoryVideo` and `serviceVideo` in `src/lib/marketplace.ts`, and all callers (ServiceCard, MarketServiceDetail, MarketCategories, MarketHome).
- Asset removed: `public/home-deep-cleaning-demo.mp4`
- Still present, pending decision: `public/homepage-hero.mp4` (not referenced in src).
- Check before re-adding: `grep -rn "mp4\|<video\|serviceVideo\|categoryVideo" src`

## Homepage hero video (removed Oct 14, 2026)
- Asset removed: `public/homepage-hero.mp4`
- Blocked from re-adding via `.gitignore`.
- Demo clip `public/home-deep-cleaning-demo.mp4` also blocked via `.gitignore`.
- Note: both files still exist in git history from earlier commits.
