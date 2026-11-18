# Soochana promo: voiceover script

An 82-second film told as one story. The narration follows **Mitali**, a girl
born today in a village in Odisha, from birth to old age, and shows how
understanding the numbers helps plan the future she deserves. Mitali is an
illustrative character, not a real person. She is marked on screen in the
100-people scene, and the themes scene follows her life in seven moments
(lines 04–10), each labelled with her age.

Eighteen short lines, each with its own window in the video. Record each line as
a separate file and the video places it on its frame.

## How to record

- Quiet room, phone or USB mic about a hand's width from the mouth, no music.
- One file per line, named `01.wav` … `18.wav` (MP3 also works; tell Claude).
  Leave about half a second of silence before and after.
- Warm, calm and confident: a friend explaining something hopeful, not an
  announcer. Slightly slower than normal speech.
- **Each line must fit its window** (the "max" column). Lines 04–10 are
  short beats of under 3 seconds each: say them simply, one breath each.
- Say "crore", "Soochana" (SOO-chuh-naa) and "Mitali" (MI-ta-lee) the Odia way.
- Tell it like a story about someone you care about: gentle at the start,
  rising a little through the middle, warm and certain at the end.

## The script

| # | Plays at | Max | On screen | Line |
|---|---|---|---|---|
| 01 | 0:00.4 | 8.1 s | Live counter, dots form the map, ସୂଚନା title | Today, in a village in Odisha, a girl named Mitali was born. One of four point seven crore. |
| 02 | 0:08.6 | 4.2 s | Wall of numbers turning into dots | She is a number. But numbers tell stories. |
| 03 | 0:13.0 | 10.1 s | 100 dots; Mitali's dot is ringed and named | If Odisha were a hundred people, Mitali is one of eighty-three in villages. Her family will be smaller, and her life longer. |
| 04 | 0:23.2 | 2.7 s | Day 1: her parents carry her to the hospital; waffle of 94 in 100 | Born safely, in a hospital. |
| 05 | 0:26.0 | 2.7 s | Age 5: a health worker visits the village; vaccination chart | She grows up healthy. |
| 06 | 0:28.8 | 2.7 s | Age 12: she walks to school; schooling chart | More school than her mother had. |
| 07 | 0:31.6 | 2.7 s | Age 21: the city grows around her, phone in hand; phone chart | In the city, the world opens up. |
| 08 | 0:34.4 | 2.7 s | Age 25: she walks to work, her own bank card; bank chart | Her own job, her own money. |
| 09 | 0:37.2 | 2.7 s | Age 32: she steps off the bus and walks home; migration chart | Like many, she comes home. |
| 10 | 0:40.0 | 3.0 s | Age 70: on a bench with her husband, granddaughter flying a kite; elders chart | And one day, she grows old here. |
| 11 | 0:43.0 | 5.8 s | District map, Khordha and Nabarangpur pyramids | Where she lives shapes her future. Each district has its own path. |
| 12 | 0:49.0 | 5.2 s | Health dots: better / little change / worse | Health data shows what is improving for her, and what still needs care. |
| 13 | 0:54.3 | 5.2 s | Two plates meet; women online, contraception | What she searches online may show change before any survey does. |
| 14 | 0:59.6 | 4.7 s | Assistant chat; model fitting the districts | Anyone can ask about her district, and get a sourced answer. |
| 15 | 1:04.5 | 4.2 s | Flourish charts, guided tour, repository | All of it, open to everyone. |
| 16 | 1:08.8 | 5.2 s | Map lights up like a sunrise, 2021 → 2036 | Understand the numbers, and we can plan the Odisha she deserves. |
| 17 | 1:14.1 | 3.7 s | End card, QR code, partners | Soochana. Find your story in the numbers. |
| 18 | 1:17.9 | 4.0 s | COMING SOON: live search signals, more Tectonics stories, the Storyteller | Her story's just beginning. More, coming soon. |

The same lines live in `src/data/narration.json`, which the video reads. Change
a line there and here together.

## Every figure in the script

- "four point seven crore": the live estimate the opening counter shows (district projections, Oct 2026).
- "eighty-three in villages": Census of India 2011.
- "family will be smaller, life longer": fertility falling to 1.8 (NFHS-5) and life expectancy 70.4 years (SRS 2020–24).
- "born safely, in a hospital": 94 of 100 births are institutional (NFHS-6).
- "grows up healthy": children fully vaccinated, 91% → 93% (NFHS-5 → NFHS-6).
- "more school than her mother had": women with 10+ years of school, 33% → 44%.
- "the world opens up": women with their own phone, 50% → 64%.
- "her own money": women with their own bank account, 87% → 91%.
- "like many, she comes home": returning Odias among people moving in, 24% → 67% (NSS 2007–08 → PLFS 2020–21).
- "grows old here": people aged 60+, 51 lakh (2021) → 82 lakh (2036).
- "Health data": NFHS-5 (2019–21) to NFHS-6 (2023–24).
- "Coming soon": live search signals and more Tectonics stories (in progress), and the Storyteller (built, switched off). Confirm with the team.
- "What she searches online": Tectonics compares Google search interest with surveys.

## Using a voice tool instead of a recording

If you generate the voice with a tool such as ElevenLabs, paste each line
separately and export one file per line with the names above. Clone or use a
person's voice only with that person's clear consent.

## Putting your voice in

1. Save the files as `public/audio/vo/01.wav` … `18.wav`.
2. Run `node tools/vo_durations.js final`. It measures each take and flags any
   that run past their window.
3. Run `npm run render`. The video switches to your voice and the music dips
   under each line.

Until then the video uses a guide voice made with Windows' built-in speech
(`powershell -File tools/guide_vo.ps1`, then `node tools/vo_durations.js guide`).
