"""
Build learn/data/districts.json — the one table every Soochana Learn
explainer models on.

Reads only what the portal already ships:
  datasets/districts_detail.json        census + UDISE + land + infra stats
  datasets/district_mortality.json      NMR / IMR / U5MR (NFHS-4, NFHS-5), MMR
  datasets/district_life_expectancy.json
  datasets/district_fertility_trends.json
  datasets/district_population_trends.json
  datasets/district_age_pyramids.json
  excel/Health.xlsx                     NFHS-5 district fact sheets, nutrition, TFR
  excel/Migration and Urbanization.xlsx district urbanisation (Census 2011)

Run from the repo root:  python learn/tools/build_learn_data.py
Standard library only (no pandas / openpyxl needed).
"""
import json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.dirname(__file__))
import xlsx_reader as xl  # noqa: E402


def load(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        data = json.load(f)
    # The trend files spell Jajpur the Census way.
    if isinstance(data, dict) and 'Jajapur' in data:
        data['Jajpur'] = data.pop('Jajapur')
    return data


# Excel sheets spell some districts the Census way; the portal uses these.
ALIAS = {
    'anugul': 'Angul', 'balangir': 'Bolangir', 'baudh': 'Boudh', 'jajapur': 'Jajpur',
    'nabarangapur': 'Nabarangpur', 'jagatsinghpur': 'Jagatsinghapur', 'deogarh': 'Debagarh',
    'keonjhar': 'Kendujhar', 'kendujharh': 'Kendujhar', 'sonepur': 'Subarnapur', 'balasore': 'Baleshwar',
}

# Revenue Divisional Commissioner divisions (official grouping, 10 districts each).
DIVISION = {
    'Central': ['Baleshwar', 'Bhadrak', 'Cuttack', 'Jagatsinghapur', 'Jajpur', 'Kendrapara',
                'Khordha', 'Mayurbhanj', 'Nayagarh', 'Puri'],
    'Northern': ['Angul', 'Bargarh', 'Bolangir', 'Debagarh', 'Dhenkanal', 'Jharsuguda',
                 'Kendujhar', 'Sambalpur', 'Subarnapur', 'Sundargarh'],
    'Southern': ['Boudh', 'Gajapati', 'Ganjam', 'Kalahandi', 'Kandhamal', 'Koraput',
                 'Malkangiri', 'Nabarangpur', 'Nuapada', 'Rayagada'],
}
KBK = {'Bolangir', 'Subarnapur', 'Kalahandi', 'Nuapada', 'Koraput', 'Malkangiri',
       'Nabarangpur', 'Rayagada'}
COASTAL = {'Baleshwar', 'Bhadrak', 'Kendrapara', 'Jagatsinghapur', 'Puri', 'Ganjam'}


def canon(name, known):
    n = str(name).strip()
    key = n.lower()
    if key in ALIAS:
        return ALIAS[key]
    for k in known:
        if k.lower() == key:
            return k
    return None


def num(s):
    """'~14.1%' → 14.1, '1,79,609' → 179609, '12.74 Lakhs' → 12.74; None if absent."""
    if s is None:
        return None
    if isinstance(s, (int, float)):
        return float(s)
    m = re.search(r'-?[\d,]*\.?\d+', str(s))
    return float(m.group().replace(',', '')) if m else None


def raw_pairs(raw):
    out = {}
    for part in (raw or '').split('|'):
        if ':' in part:
            k, v = part.split(':', 1)
            out[k.strip()] = num(v)
    return out


def r1(x, d=1):
    return None if x is None else round(x, d)


detail = load('datasets/districts_detail.json')
mort = load('datasets/district_mortality.json')
life = load('datasets/district_life_expectancy.json')
tfr_tr = load('datasets/district_fertility_trends.json')
pop = load('datasets/district_population_trends.json')
pyr = load('datasets/district_age_pyramids.json')
NAMES = sorted(detail)

health = xl.read(os.path.join(ROOT, 'excel', 'Health.xlsx'))
migr = xl.read(os.path.join(ROOT, 'excel', 'Migration and Urbanization.xlsx'))


def sheet_by_district(rows, name_col):
    out = {}
    for r in rows:
        if len(r) > name_col and r[name_col]:
            c = canon(r[name_col], NAMES)
            if c:
                out[c] = r
    return out


urban = sheet_by_district(migr['District Wise Urbanization Rate'], 3)
nutri = sheet_by_district(health['Nutrition'], 1)
tfr4 = sheet_by_district(health['District-wise TFR'], 1)
nfhs5 = {}
for r in health['Other Health Indicators']:
    if len(r) > 4 and r[2] and str(r[4]).strip().startswith('NFHS 5') and 'Total' in str(r[4]):
        c = canon(r[2], NAMES)
        if c:
            nfhs5[c] = r


def share(rows, bands):
    tot = sum(x['total'] for x in rows)
    return 100 * sum(x['total'] for x in rows if x['age'] in bands) / tot


OLD = {'60-64', '65-69', '70-74', '75-79', '80+'}
YOUNG = {'0-4', '5-9', '10-14'}

districts = []
for n in NAMES:
    d = detail[n]
    bs, hs = d['basic_stats'], d['health_stats']
    ed, geo, inf = (raw_pairs(d[k]['raw']) for k in ('education_stats', 'geography_stats', 'infra_stats'))
    area = num(bs['area_sq_km'])
    p = pop[n]
    m = mort[n]
    nu = nutri.get(n)
    h5 = nfhs5.get(n)
    div = next(k for k, v in DIVISION.items() if n in v)

    districts.append({
        'name': n,
        'division': div,
        'kbk': n in KBK,
        'coastal': n in COASTAL,
        # Cross-sectional features: one value per district.
        'f': {
            'literacy': r1(num(bs['literacy_rate'])),
            'female_lit': r1(ed.get('Female Literacy Rate (2011)')),
            'male_lit': r1(ed.get('Male Literacy Rate (2011)')),
            'density': r1(num(bs['density_2011']), 0),
            'urban_pct': r1(urban[n][4]) if n in urban else None,
            'tribal_pct': r1(num(d['tribal_info']['tribal_share_pct'])),
            'sex_ratio': r1(1000 * p['2011']['female'] / p['2011']['male'], 0),
            'growth_01_11': r1(100 * (p['2011']['total'] / p['2001']['total'] - 1)),
            'elderly_pct': r1(share(pyr[n]['2011'], OLD)),
            'child_pct': r1(share(pyr[n]['2011'], YOUNG)),
            'elderly_pct_2036': r1(share(pyr[n]['2036'], OLD)),
            'tfr_2020': tfr_tr[n].get('2020'),
            'beds_per_100k': num(hs.get('beds_per_100k')),
            'mmr': num(hs.get('mmr')) or m.get('maternal_mortality_ratio_2017_19'),
            'forest_pct': r1(100 * geo['Forest Area (2024)'] * 1000 / (area * 100)) if geo.get('Forest Area (2024)') else None,
            'sown_pct': r1(100 * geo['Net Sown Area (2024)'] * 1000 / (area * 100)) if geo.get('Net Sown Area (2024)') else None,
            'rainfall_mm': r1(geo.get('Annual Rainfall (2024)'), 0),
            'bank_per_100k': inf.get('Bank Branches per 1,00,000 (2024-25)'),
            'sec_dropout': ed.get('Secondary Dropout Rate (2024-25)'),
            'mid_dropout': ed.get('Middle Dropout Rate (2024-25)'),
            'sec_ptr': ed.get('Secondary PTR'),
            'smart_class_pct': r1(ed.get('% Schools with Smart Classrooms')),
            'computer_pct': r1(ed.get('% Schools with Computer Facility')),
        },
        # Same indicator at two survey rounds, for "train on the past, test on the present".
        'nfhs4': {
            'imr': r1(m['infant_mortality_rate']['nfhs4']),
            'nmr': r1(m['neonatal_mortality_rate']['nfhs4']),
            'u5mr': r1(m['under_five_mortality_rate']['nfhs4']),
            'stunted': nu[2] if nu else None,
            'wasted': nu[4] if nu else None,
            'underweight': nu[8] if nu else None,
            'anaemic_child': nu[12] if nu else None,
            'tfr': tfr4[n][2] if n in tfr4 else None,
            'le_female': life[n]['female']['nfhs4'],
            'le_male': life[n]['male']['nfhs4'],
        },
        'nfhs5': {
            'imr': r1(m['infant_mortality_rate']['nfhs5']),
            'nmr': r1(m['neonatal_mortality_rate']['nfhs5']),
            'u5mr': r1(m['under_five_mortality_rate']['nfhs5']),
            'stunted': nu[3] if nu else None,
            'wasted': nu[5] if nu else None,
            'underweight': nu[9] if nu else None,
            'anaemic_child': nu[13] if nu else None,
            'le_female': life[n]['female']['nfhs5'],
            'le_male': life[n]['male']['nfhs5'],
            'srb': num(h5[5]) if h5 else None,
            'insurance': num(h5[6]) if h5 else None,
            'women_lit': num(h5[7]) if h5 else None,
            'child_marriage': num(h5[8]) if h5 else None,
            'fp_any': num(h5[9]) if h5 else None,
            'unmet_need': num(h5[12]) if h5 else None,
            'anc4': num(h5[13]) if h5 else None,
            'inst_births': num(h5[14]) if h5 else None,
            'full_vax': num(h5[15]) if h5 else None,
            'adequate_diet': num(h5[16]) if h5 else None,
        },
    })

FEATURES = {
    'literacy':        ['Literacy rate', '%', 'Census 2011'],
    'female_lit':      ['Female literacy', '%', 'Census 2011'],
    'male_lit':        ['Male literacy', '%', 'Census 2011'],
    'density':         ['Population density', 'per sq km', 'Census 2011'],
    'urban_pct':       ['Urban population', '%', 'Census 2011'],
    'tribal_pct':      ['Scheduled Tribe population', '%', 'Census 2011'],
    'sex_ratio':       ['Sex ratio', 'F per 1,000 M', 'Census 2011'],
    'growth_01_11':    ['Population growth 2001–11', '%', 'Census 2001, 2011'],
    'elderly_pct':     ['Population aged 60+', '%', 'Census 2011'],
    'child_pct':       ['Population aged 0–14', '%', 'Census 2011'],
    'elderly_pct_2036':['Population aged 60+ (2036)', '%', 'Projection'],
    'tfr_2020':        ['Total fertility rate', 'births per woman', 'Bayesian estimate, 2020'],
    'beds_per_100k':   ['Hospital beds', 'per 1,00,000', 'District health profile'],
    'mmr':             ['Maternal mortality ratio', 'per 1,00,000 births', '2017–19'],
    'forest_pct':      ['Forest cover', '% of area', 'Land use 2024'],
    'sown_pct':        ['Net sown area', '% of area', 'Land use 2024'],
    'rainfall_mm':     ['Annual rainfall', 'mm', '2024'],
    'bank_per_100k':   ['Bank branches', 'per 1,00,000', '2024–25'],
    'sec_dropout':     ['Secondary dropout', '%', 'UDISE+ 2024–25'],
    'mid_dropout':     ['Middle-school dropout', '%', 'UDISE+ 2024–25'],
    'sec_ptr':         ['Secondary pupil–teacher ratio', 'pupils', 'UDISE+ 2024–25'],
    'smart_class_pct': ['Schools with smart classrooms', '%', 'UDISE+ 2024–25'],
    'computer_pct':    ['Schools with computers', '%', 'UDISE+ 2024–25'],
    'imr':             ['Infant mortality rate', 'per 1,000 live births', 'NFHS'],
    'nmr':             ['Neonatal mortality rate', 'per 1,000 live births', 'NFHS'],
    'u5mr':            ['Under-five mortality rate', 'per 1,000 live births', 'NFHS'],
    'stunted':         ['Children under 5 stunted', '%', 'NFHS'],
    'wasted':          ['Children under 5 wasted', '%', 'NFHS'],
    'underweight':     ['Children under 5 underweight', '%', 'NFHS'],
    'anaemic_child':   ['Children 6–59 months anaemic', '%', 'NFHS'],
    'tfr':             ['Total fertility rate', 'births per woman', 'NFHS-4'],
    'le_female':       ['Female life expectancy', 'years', 'NFHS-based estimate'],
    'le_male':         ['Male life expectancy', 'years', 'NFHS-based estimate'],
    'srb':             ['Sex ratio at birth', 'F per 1,000 M', 'NFHS-5'],
    'insurance':       ['Households with health insurance', '%', 'NFHS-5'],
    'women_lit':       ['Women 15–49 literate', '%', 'NFHS-5'],
    'child_marriage':  ['Women 20–24 married before 18', '%', 'NFHS-5'],
    'fp_any':          ['Any family-planning method', '%', 'NFHS-5'],
    'unmet_need':      ['Unmet need for family planning', '%', 'NFHS-5'],
    'anc4':            ['Mothers with 4+ antenatal visits', '%', 'NFHS-5'],
    'inst_births':     ['Institutional births', '%', 'NFHS-5'],
    'full_vax':        ['Children 12–23 months fully vaccinated', '%', 'NFHS-5'],
    'adequate_diet':   ['Children 6–23 months with adequate diet', '%', 'NFHS-5'],
}

state_ref = {}
for r in health['Nutrition']:
    if len(r) > 3 and r[1] == 'Odisha':
        state_ref.update(stunted=r[3], wasted=r[5])
for r in health['Other Health Indicators']:
    if len(r) > 16 and r[2] == 'Odisha' and 'Total' in str(r[4]) and '5' in str(r[4]):
        state_ref.update(inst_births=r[14], full_vax=r[15], child_marriage=r[8], women_lit=r[7])

# Report anything missing so a silent gap never reaches a model.
missing = [(d['name'], blk, k) for d in districts for blk in ('f', 'nfhs4', 'nfhs5')
           for k, v in d[blk].items() if v is None]
for m in missing:
    print('missing:', *m)

out = {
    'meta': {
        'title': 'Odisha districts — modelling table for Soochana Learn',
        'n': len(districts),
        'features': {k: {'label': v[0], 'unit': v[1], 'source': v[2]} for k, v in FEATURES.items()},
        # Odisha NFHS-5 totals, read from the same Health.xlsx sheets; the
        # explainers use these as the "above the state average" class line.
        'state_nfhs5': state_ref,
        'groups': {'division': 'Revenue Divisional Commissioner division',
                   'kbk': 'Koraput–Bolangir–Kalahandi region (8 districts)',
                   'coastal': 'District with a sea coast'},
        'built_from': ['datasets/districts_detail.json', 'datasets/district_mortality.json',
                       'datasets/district_life_expectancy.json', 'datasets/district_fertility_trends.json',
                       'datasets/district_population_trends.json', 'datasets/district_age_pyramids.json',
                       'excel/Health.xlsx', 'excel/Migration and Urbanization.xlsx'],
    },
    'districts': districts,
}
dst = os.path.join(ROOT, 'learn', 'data', 'districts.json')
with open(dst, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
print(f'wrote {dst}: {len(districts)} districts, {len(missing)} missing values')
