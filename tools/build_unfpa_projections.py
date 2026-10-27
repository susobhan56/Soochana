"""Build datasets/unfpa_district_projections.json from the UNFPA workbook.

    python tools/build_unfpa_projections.py "path/to/Odisha_District_Wise_Population_Projections_UNFPA.xlsx"

Reads the workbook's sheets:
  Odisha PP              state age-sex bands, ORGI projections 2021-2036
  Dist. Pop 1951-2026    district totals by sex, Census 1951-2011 and UNFPA 2021, 2026
  Dist. Age wise Pop     district single-year ages 0-14 and 5-year bands to 75+, 2021 and 2026

The sheet "Sheet2" (an NFHS-5 fragment covering three districts) is not used.
Needs only the standard library, so it runs without openpyxl.
"""
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}

# workbook spellings -> the spellings datasets/district_population_trends.json uses
NAMES = {'Anugul': 'Angul', 'Balangir': 'Bolangir', 'Baudh': 'Boudh', 'Khorda': 'Khordha',
         'Nabarangapur': 'Nabarangpur', 'Mayunbhanj': 'Mayurbhanj', 'Kendujarh': 'Kendujhar'}


def read_workbook(path):
    """Every sheet as {name: {(row, col): value}}, both 0-based."""
    z = zipfile.ZipFile(path)
    t = '{%s}t' % NS['m']
    strings = [''.join(x.text or '' for x in si.iter(t))
               for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS)]
    rels = {r.get('Id'): r.get('Target') for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
    sheets = {}
    for sh in ET.fromstring(z.read('xl/workbook.xml')).find('m:sheets', NS):
        target = rels[sh.get('{%s}id' % NS['r'])].lstrip('/')
        target = target if target.startswith('xl/') else 'xl/' + target
        cells = {}
        for row in ET.fromstring(z.read(target)).find('m:sheetData', NS):
            for c in row:
                v = c.find('m:v', NS)
                if c.get('t') == 's' and v is not None:
                    val = strings[int(v.text)]
                elif c.get('t') == 'inlineStr':
                    val = ''.join(x.text or '' for x in c.iter(t))
                elif v is not None:
                    val = float(v.text)
                else:
                    continue
                letters, digits = re.match(r'([A-Z]+)(\d+)', c.get('r')).groups()
                col = 0
                for ch in letters:
                    col = col * 26 + ord(ch) - 64
                cells[(int(digits) - 1, col - 1)] = val
        sheets[sh.get('name')] = cells
    return sheets


def name(raw):
    raw = raw.strip()
    return NAMES.get(raw, raw)


def age_label(raw):
    """'0 (⏴ 1 yr)' -> '0', '15 – 19' -> '15-19', '6  – 14' -> '6-14'."""
    if isinstance(raw, float):
        return str(int(raw))
    raw = raw.strip()
    if raw.startswith('0 ('):
        return '0'
    return re.sub(r'\s*[–-]\s*', '-', raw)


def num(x):
    return int(round(x))


def sex(cells, r, c):
    """Person, Male, Female in three adjacent columns."""
    return {'total': num(cells[(r, c)]), 'male': num(cells[(r, c + 1)]), 'female': num(cells[(r, c + 2)])}


wb = read_workbook(sys.argv[1])
portal = set(json.load(open(os.path.join(ROOT, 'datasets/district_population_trends.json'), encoding='utf-8')))

# ── district totals, Census 1951-2011 and UNFPA 2021, 2026 ──
# Columns run Male, Female, Total for each year, so they are reordered here.
pop = wb['Dist. Pop 1951-2026']
years = [num(pop[(5, c)]) for c in range(2, 29, 3)]
assert years == [1951, 1961, 1971, 1981, 1991, 2001, 2011, 2021, 2026], years


def totals(r):
    return {str(y): {'total': num(pop[(r, 2 + 3 * i + 2)]), 'male': num(pop[(r, 2 + 3 * i)]),
                     'female': num(pop[(r, 2 + 3 * i + 1)])} for i, y in enumerate(years)}


state_series = totals(7)
districts = {}
for r in range(8, 38):
    d = name(pop[(r, 1)])
    districts[d] = {'code': pop[(r, 0)], 'series': totals(r)}
assert set(districts) == portal, set(districts) ^ portal

# ── district age structure, 2021 and 2026 ──
# Each district is a block of six columns (2021 P, M, F, 2026 P, M, F) named in row 2;
# the age labels sit in column A and are repeated before every second district, where
# the name sits over the "Age (Years)" column rather than over the first number.
ages = wb['Dist. Age wise Pop']
blocks = {c + (ages.get((2, c)) == 'Age (Years)'): name(v)
          for (r, c), v in ages.items() if r == 1 and isinstance(v, str)}
assert set(blocks.values()) == portal
labels = [age_label(ages[(r, 0)]) for r in range(4, 32)]
assert labels[0] == '0' and labels[14] == '14' and labels[-1] == '75+' and ages[(32, 0)] == 'TOTAL', labels
groups = [age_label(ages[(r, 0)]) for r in range(37, 41)]
assert groups == ['0-14', '6-14', '15-59', '60+'], groups
assert str(ages[(41, 0)]).startswith('Estimated Eligible Women')

for c, d in blocks.items():
    # the summary table repeats the same layout
    assert name(ages.get((34, c)) or ages[(34, c - 1)]) == d, (c, d)
    assert ages[(3, c)] == 'Person', (c, d)
    proj = {}
    for k, yr in enumerate(('2021', '2026')):
        cc = c + 3 * k
        bands = [dict(age=a, **sex(ages, 4 + i, cc)) for i, a in enumerate(labels)]
        total = sex(ages, 32, cc)
        assert abs(sum(b['total'] for b in bands) - total['total']) <= 30, (d, yr)
        assert total == districts[d]['series'][yr], (d, yr, total, districts[d]['series'][yr])
        proj[yr] = {
            'ages': bands,
            'groups': {g: sex(ages, 37 + i, cc) for i, g in enumerate(groups)},
            'eligible_women_15_49': num(ages[(41, cc + 2)]),
        }
    districts[d]['projection'] = proj

# ── state age-sex bands, ORGI 2021-2036 ──
# The "0-1" row is a subset of "0-4" and is kept apart so it is never summed in.
pp = wb['Odisha PP']
state_bands = {}
for c in range(28, 40, 3):
    yr = str(num(pp[(4, c)]))
    rows = [dict(age=age_label(pp[(r, 27)]), **sex(pp, r, c)) for r in range(8, 25)]
    assert rows[0]['age'] == '0-4' and rows[-1]['age'] == '80+', rows
    state_bands[yr] = {'total': sex(pp, 6, c), 'under_1': sex(pp, 7, c), 'ages': rows}

out = {
    'meta': {
        'title': 'Odisha district population projections, 2021 and 2026',
        'sources': {
            'census': 'Census of India 1951-2011',
            'district_projection': 'UNFPA, District Level Population Projections in Selected States of India – 2021 & 2026 (published 2022)',
            'state_projection': 'Population Projections for India and States 2011-2036, Technical Group, ORGI',
        },
        'notes': [
            'District names follow the portal spellings (Angul, Bolangir, Boudh, Khordha, Nabarangpur).',
            'District age bands stop at 75+; the portal\'s Bayesian pyramids go to 80+.',
            'Male + female can differ from the total by a few persons because of rounding in the source.',
            'District totals for 2021 and 2026 sum to within 1,000 of the ORGI state total; the methods differ.',
            'Workbook sheet "Odisha PP" labels the 1991 male and female columns the wrong way round; this file takes 1991 from the district sheet, which is correct.',
            'State "under_1" is part of the 0-4 band and must not be added to it.',
        ],
    },
    'state': {'series': state_series, 'projection': state_bands},
    'districts': dict(sorted(districts.items())),
}

dest = os.path.join(ROOT, 'datasets/unfpa_district_projections.json')
with open(dest, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
print('wrote', dest, os.path.getsize(dest), 'bytes,', len(districts), 'districts')
