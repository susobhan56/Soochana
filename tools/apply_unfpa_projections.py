"""Put the UNFPA district projections into the portal's district files.

    python tools/apply_unfpa_projections.py

Reads datasets/unfpa_district_projections.json (made by build_unfpa_projections.py)
and rewrites, in place:
  datasets/district_population_trends.json   2016-2036 by district
  datasets/district_age_pyramids.json        2021-2036 by district

  2021, 2026  UNFPA, as published.
  2031, 2036  UNFPA 2026 grown at the ORGI state growth rate for each sex, so the
              line has no break at 2026. The age shape is kept from the DIU
              Bayesian projection and scaled to the new totals.
  2016        Geometric midpoint of Census 2011 and UNFPA 2021, for each sex.
  75+         UNFPA stops at 75+; it is split into 75-79 and 80+ in the ratio the
              Bayesian projection gives for that district, year and sex.

Safe to run again: every step derives its targets from the UNFPA file and keeps
only ratios from the files it rewrites. Then run tools/build_hero_data.py and
learn/tools/build_learn_data.py.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEXES = ('male', 'female')
BANDS = ['0-4', '5-9', '10-14', '15-19', '20-24', '25-29', '30-34', '35-39', '40-44',
         '45-49', '50-54', '55-59', '60-64', '65-69', '70-74', '75-79', '80+']


def path(name):
    return os.path.join(ROOT, 'datasets', name)


def load(name):
    with open(path(name), encoding='utf-8') as f:
        return json.load(f)


def save(name, data):
    with open(path(name), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')


def scale_to(values, target):
    """Scale integers to sum exactly to target; the rounding remainder goes to the largest."""
    total = sum(values)
    out = [round(v * target / total) for v in values]
    out[out.index(max(out))] += target - sum(out)
    return out


unfpa = load('unfpa_district_projections.json')
trends = load('district_population_trends.json')
pyramids = load('district_age_pyramids.json')
state = unfpa['state']['projection']
growth = {(y0, y1, s): state[y1]['total'][s] / state[y0]['total'][s]
          for y0, y1 in (('2026', '2031'), ('2031', '2036')) for s in SEXES}

for d, src in unfpa['districts'].items():
    series, proj, pyr = trends[d], src['projection'], pyramids[d]

    # ── totals ──
    for y in ('2021', '2026'):
        series[y] = {s: src['series'][y][s] for s in SEXES}
    for y0, y1 in (('2026', '2031'), ('2031', '2036')):
        series[y1] = {s: round(series[y0][s] * growth[(y0, y1, s)]) for s in SEXES}
    series['2016'] = {s: round((series['2011'][s] * series['2021'][s]) ** 0.5) for s in SEXES}
    for y in ('2016', '2021', '2026', '2031', '2036'):
        series[y]['total'] = series[y]['male'] + series[y]['female']
    trends[d] = dict(sorted(series.items()))

    # ── age pyramids ──
    for y in ('2021', '2026'):
        ages = {a['age']: a for a in proj[y]['ages']}
        old = {b['age']: b for b in pyr[y]}
        rows = []
        for band in BANDS[:15]:
            lo, hi = map(int, band.split('-'))
            if hi <= 14:
                parts = [ages[str(i)] for i in range(lo, hi + 1)]
            else:
                parts = [ages[band]]
            rows.append({'age': band, **{s: sum(p[s] for p in parts) for s in SEXES}})
        for band in BANDS[15:]:
            rows.append({'age': band})
        for s in SEXES:
            share = old['75-79'][s] / (old['75-79'][s] + old['80+'][s])
            rows[15][s] = round(ages['75+'][s] * share)
            rows[16][s] = ages['75+'][s] - rows[15][s]
        for r in rows:
            r['total'] = r['male'] + r['female']
        pyr[y] = rows
    for y in ('2031', '2036'):
        old = pyr[y]
        assert [b['age'] for b in old] == BANDS, (d, y)
        cols = {s: scale_to([b[s] for b in old], series[y][s]) for s in SEXES}
        pyr[y] = [{'age': a, 'male': cols['male'][i], 'female': cols['female'][i],
                   'total': cols['male'][i] + cols['female'][i]} for i, a in enumerate(BANDS)]

    # 2021 and 2026 are as published, where the age bands and the totals were
    # rounded separately; the chained years match exactly.
    for y, slack in (('2021', 30), ('2026', 30), ('2031', 0), ('2036', 0)):
        for s in SEXES:
            assert abs(sum(b[s] for b in pyr[y]) - series[y][s]) <= slack, (d, y, s)

save('district_population_trends.json', trends)
save('district_age_pyramids.json', pyramids)
for y in ('2016', '2021', '2026', '2031', '2036'):
    print(y, sum(trends[d][y]['total'] for d in trends))
