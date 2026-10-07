# Tectonics — search data

The Tectonics story pages (`tectonics.html`, `tectonics-marriage.html`) read
Google Trends exports from this folder. If a file is missing, its trace on the
page says "No reading yet" and nothing is drawn. The pages never show made-up
numbers.

## Story 1, "Online, but unprotected?"

| File name (exactly) | Search group | Example terms |
|---|---|---|
| `s1-emergency-pills.csv` | Emergency pills | i-pill, unwanted 72, emergency pill |
| `s1-pregnancy-worries.csv` | Pregnancy worries | pregnancy test, period late |
| `s1-side-effects.csv` | Side effects | Copper-T side effects, pill side effects |
| `s1-delaying.csv` | Delaying a child | how to avoid pregnancy, gap between children |

## Story 2, "When does youth want to marry?"

| File name (exactly) | Search group | Example terms |
|---|---|---|
| `s2-matrimony.csv` | Finding a match | Odia matrimony, bride for marriage |
| `s2-love-court.csv` | Love and court marriage | love marriage, court marriage |
| `s2-legal-age.csv` | The legal age | marriage age for girls, child marriage |
| `s2-wedding-costs.csv` | Paying for a wedding | marriage loan, wedding cost |

The example terms are only a starting point. Replace them with the DIU team's
list of the words people in Odisha actually use, in Odia and in English.

## How to export a file

1. Open <https://trends.google.com/trends/explore>.
2. Enter up to five terms for one search group (use **+ Compare**).
3. Set the region to **India › Odisha**.
4. Set the time range to **custom: 1 Jan 2019 to today**.
5. Leave the category as **All categories** and the search type as **Web Search**.
6. Under **Interest over time**, use the download arrow. Google saves a file
   named `multiTimeline.csv`.
7. Rename it to the file name in the table above and put it in this folder.

All terms for one group go in **one** export, so their values share a scale.
The page adds the terms together and rescales the group to 0–100.

## Notes

- Google Trends values are relative: 100 is the busiest week in the export,
  not a count of searches. Compare the shape of a trace over time, not its
  height against another group.
- Low-volume terms show as `<1`; the page reads those as 0.5.
- Refresh the exports every few months and commit the new files. Keep the
  same terms so the traces stay comparable.
