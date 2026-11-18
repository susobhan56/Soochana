"""Put the ORGI state projection into datasets/state_demographics.json.

    python tools/apply_orgi_state.py

Source: Population Projections for India and States 2011-2036, Report of the
Technical Group on Population Projections, National Commission on Population,
Ministry of Health and Family Welfare (July 2020), Odisha: Table 17 (population
characteristics) and Table 18 (population by age and sex). The age table is
already held in datasets/unfpa_district_projections.json under state.projection.

Rewrites, in place:
  population_trends   the rows for 2021, 2026, 2031 and 2036
  pyramids            2021, 2026, 2031 and 2036 (17 five-year bands each)

1901-2011 stay as the Census of India counted them. Then run
tools/build_hero_data.py and learn/tools/build_learn_data.py.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
YEARS = ('2021', '2026', '2031', '2036')


def path(name):
    return os.path.join(ROOT, 'datasets', name)


with open(path('unfpa_district_projections.json'), encoding='utf-8') as f:
    orgi = json.load(f)['state']['projection']
with open(path('state_demographics.json'), encoding='utf-8') as f:
    state = json.load(f)

# the population series is the first run of rising years in the list
rows, by_year = [], {}
for r in state['population_trends']:
    if rows and r['year'] <= rows[-1]['year']:
        break
    rows.append(r)
    by_year[r['year']] = r

prev = by_year[2011]
for y in YEARS:
    t, r = orgi[y]['total'], by_year[int(y)]
    r['male'], r['female'] = t['male'], t['female']
    r['total'] = t['male'] + t['female']
    r['sex_ratio'] = 1000 * t['female'] / t['male']
    # same convention as the census rows: average yearly change, % of the start
    r['annual_growth_rate'] = (r['total'] - prev['total']) / prev['total'] / (r['year'] - prev['year']) * 100
    prev = r

    bands = [{'age': a['age'], 'male': a['male'], 'female': a['female'], 'total': a['male'] + a['female']}
             for a in orgi[y]['ages']]
    assert len(bands) == 17 and bands[0]['age'] == '0-4' and bands[-1]['age'] == '80+', y
    state['pyramids'][y] = bands
    print(y, r['total'], round(r['sex_ratio']), round(r['annual_growth_rate'], 2),
          sum(b['total'] for b in bands))

with open(path('state_demographics.json'), 'w', encoding='utf-8') as f:
    json.dump(state, f, ensure_ascii=False, indent=2)
    f.write('\n')
