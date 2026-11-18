# Soochana promo video

An 82-second, 1920 × 1080 promotional video of the portal, built in code with
[Remotion](https://www.remotion.dev/). Every number and chart is drawn from the
portal's own data files, so the video matches the site.

## Scenes

The film runs from numbers to narrative to the bigger picture: what the data
shows, why it matters, and what it helps us plan for.

| Time | Scene | File |
|---|---|---|
| 0:00–0:08 | Live counter; dots form the district map, then ସୂଚନା | `src/scenes/Opening.tsx` |
| 0:08–0:13 | From numbers to narrative: a wall of district figures turns into 100 dots | `src/scenes/Narrative.tsx` |
| 0:13–0:22 | Odisha, told in 100 people: villages/towns, 1901–2036, fertility, longer lives | `src/scenes/People.tsx` |
| 0:22–0:43 | Mitali's life in seven moments (birth, age 5, 12, 21, 25, 32, 70): animated people, her age on a pill, the portal's theme GIF, one real figure and a small chart per stop, and a life ribbon along the bottom | `src/scenes/Themes.tsx`, `src/lib/people.tsx` |
| 0:43–0:49 | District Insight and Duel: Khordha vs Nabarangpur pyramids, 2011 → 2036 | `src/scenes/Districts.tsx` |
| 0:49–0:54 | NFHS-5 → NFHS-6: what improved and what needs care, the 37/15/36 tally | `src/scenes/Health.tsx` |
| 0:54–0:59 | Tectonics: the two plates, then the guess-first reveal | `src/scenes/Tectonics.tsx` |
| 0:59–1:04 | Assistant chat, and a Learn model fitting the 30 districts | `src/scenes/AssistantLearn.tsx` |
| 1:04–1:09 | And much more: the State Dossier's Flourish charts wiping in one by one, the guided tour and the Repository | `src/scenes/Repository.tsx` |
| 1:09–1:14 | The bigger picture: working age, fertility, life expectancy, and what each lets us plan | `src/scenes/Ahead.tsx` |
| 1:14–1:18 | End card: vision line, who it is for, "Find your district's story" with URL and QR code, partner logos | `src/scenes/EndCard.tsx` |
| 1:18–1:22 | Coming soon: live search signals, more Tectonics stories, the Storyteller, with the address and QR code | `src/scenes/ComingSoon.tsx` |

`src/Promo.tsx` strings them together and adds the brand mark and the module bar
along the bottom. Each scene is animated at its own length (`*_FRAMES`) and
`Promo.tsx` can play it a little faster to fit the minute (`keyed` / `dur`);
scenes read the frame through `useT()` so that speed applies.

## Commands

Run from this folder (Node 18+, Python 3).

```bash
npm install
npm run studio        # live preview in the browser, scrub the timeline
npm run render        # out/soochana-promo.mp4
```

After the portal's data changes:

```bash
python tools/build_data.py    # map dots and state population -> src/data/odisha.json
node tools/build_scenes.js    # every scene figure -> src/data/scenes.json
node tools/build_qr.js        # QR code for SITE -> public/qr.svg
```

After the portal's pages change, serve the portal at http://localhost:8777
(`python -m http.server 8777` in the portal folder) and recapture the screenshots:

```bash
node tools/capture.js           # -> public/shots/*.png (needs Google Chrome)
node tools/capture_flourish.js  # the dossier's Flourish charts -> public/flourish/*.png (needs internet)
```

## Before publishing

- The end card's address and QR code use `SITE` in `src/lib/theme.ts`. After changing it, run `node tools/build_qr.js`.
- Partner logos (`public/logos/`, copied from the portal's `images/`) need UNFPA's approval before release.
- Music: "Motivational Showreel" by MUSIC4VIDEO (`public/audio/music.mp3`), set in `src/Promo.tsx`.
  The video is 82 s so the track's own ending lands on the last frame; keep it at 82 s or less. Check
  MUSIC4VIDEO's licence terms (many free tracks ask for a credit in the description).
- The "Coming soon" items are in `NEXT` in `src/scenes/ComingSoon.tsx`. Confirm them with the team.
- Narration: see NARRATION.md.
- The opening counter uses the district projection file, as the portal's live
  counter does (about 4.73 crore in October 2026). The 100-people story uses the
  state series (4.63 crore in 2021, 5.15 crore by 2036), as the home page story does.
