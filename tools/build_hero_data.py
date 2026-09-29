"""Build hero_data.js, the compact data the home-page hero (dotfield3d.js) draws.

    python tools/build_hero_data.py

Reads, from the repository root:
  datasets/state_demographics.json        state age pyramids and population 1901-2036
  datasets/district_age_pyramids.json     district age bands 2011-2036
  datasets/district_fertility_trends.json district TFR, NFHS-4 then projections
  Orissa.geojson                          district boundaries

Run it again whenever one of those files changes.
"""
import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(name):
    with open(os.path.join(ROOT, name), encoding='utf-8') as f:
        return json.load(f)


state = load('datasets/state_demographics.json')
dist_pyr = load('datasets/district_age_pyramids.json')
dist_tfr = load('datasets/district_fertility_trends.json')
geo = load('Orissa.geojson')

# boundary file spellings -> dataset spellings
GEO_NAMES = {'Balangir': 'Bolangir', 'Nabarangapur': 'Nabarangpur'}

# ── state age pyramid: % of the whole population, [male, female] per band ──
# Each year's list carries worksheet debris after the 17 age bands.
pyr = {}
for yr, rows in state['pyramids'].items():
    bands = rows[:17]
    assert bands[0]['age'] == '0-4' and bands[16]['age'] == '80+', yr
    total = sum(b['male'] + b['female'] for b in bands)
    pyr[yr] = [[round(100 * b['male'] / total, 3), round(100 * b['female'] / total, 3)] for b in bands]

# ── population 1901-2021 (census) and 2026-2036 (projection) ──
growth = []
for r in state['population_trends']:
    y, t = r['year'], r['total']
    census = y <= 2021 and (y - 1901) % 10 == 0   # drops the odd 1936 row
    projected = y > 2021 and (y - 2021) % 5 == 0
    if not t or not (census or projected):
        continue
    if growth and y <= growth[-1][0]:       # the file repeats a few years, with junk
        continue
    growth.append([y, t, round(r['sex_ratio']) if r['sex_ratio'] else None, 1 if y > 2021 else 0])

# ── districts: population and share aged 60+ per projection year ──
DIST_YEARS = ['2011', '2021', '2026', '2031', '2036']
districts = []
for name in sorted(dist_pyr):
    pop, s60 = [], []
    for y in DIST_YEARS:
        bands = dist_pyr[name][y]
        t = sum(b['total'] for b in bands)
        pop.append(t)
        s60.append(round(100 * sum(b['total'] for b in bands[12:]) / t, 2))
    districts.append({'name': name, 'pop': pop, 's60': s60})
index = {d['name']: i for i, d in enumerate(districts)}

# ── dot map: an even hex grid of dots inside the state, each tagged with its district ──
polys = []   # (district index, [rings])
for f in geo['features']:
    name = GEO_NAMES.get(f['properties']['Dist_Name'], f['properties']['Dist_Name'])
    g = f['geometry']
    parts = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    for p in parts:
        # thin the rings: the dots sit ~10 km apart, the boundary needs far less detail
        rings = [r[::max(1, len(r) // 600)] + [r[0]] for r in p]
        xs = [pt[0] for pt in rings[0]]
        ys = [pt[1] for pt in rings[0]]
        polys.append((index[name], rings, (min(xs), min(ys), max(xs), max(ys))))

lons = [pt[0] for _, p, _ in polys for ring in p for pt in ring]
lats = [pt[1] for _, p, _ in polys for ring in p for pt in ring]
lon0, lon1, lat0, lat1 = min(lons), max(lons), min(lats), max(lats)
kx = math.cos(math.radians((lat0 + lat1) / 2))


def inside(x, y, ring):
    c = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            c = not c
        j = i
    return c


def district_at(lon, lat):
    for d, p, (x0, y0, x1, y1) in polys:
        if lon < x0 or lon > x1 or lat < y0 or lat > y1:
            continue
        if inside(lon, lat, p[0]) and not any(inside(lon, lat, h) for h in p[1:]):
            return d
    return None


def grid(step):
    pts = []
    row = 0
    lat = lat0 + step / 2
    while lat < lat1:
        off = step / 2 if row % 2 else 0
        lon = lon0 + off + step / 2
        while lon < lon1:
            d = district_at(lon, lat)
            if d is not None:
                pts.append((lon, lat, d))
            lon += step / kx
        lat += step * 0.866
        row += 1
    return pts


# dot count falls with the square of the spacing: one trial run sets it
TARGET = 1100
trial = 0.15
step = trial * math.sqrt(len(grid(trial)) / TARGET)
pts = grid(step)

# into world units: 640 wide, centred, y up (the hero's convention)
W = 640.0
sx = W / ((lon1 - lon0) * kx)
cx, cy = (lon0 + lon1) / 2, (lat0 + lat1) / 2
dots = [[round((lon - cx) * kx * sx, 1), round((lat - cy) * sx, 1), d] for lon, lat, d in pts]

# a label anchor per district: the mean of its dots
for i, d in enumerate(districts):
    mine = [p for p in dots if p[2] == i]
    d['at'] = [round(sum(p[0] for p in mine) / len(mine), 1), round(sum(p[1] for p in mine) / len(mine), 1)]
    d['dots'] = len(mine)

# ── fertility: NFHS-4 (2015-16) then yearly projections ──
FERT_KEYS = list(next(iter(dist_tfr.values())).keys())
fert_years = [2016 if k.startswith('2015-16') else int(k) for k in FERT_KEYS]
fert = [{'name': n, 'v': [dist_tfr[n][k] for k in FERT_KEYS]} for n in sorted(dist_tfr)]

out = {
    'pyr': pyr,
    'growth': growth,
    'districtYears': [int(y) for y in DIST_YEARS],
    'districts': districts,
    'dots': dots,
    'fertYears': fert_years,
    'fertFirstLabel': '2015-16',
    'fert': fert,
}

with open(os.path.join(ROOT, 'hero_data.js'), 'w', encoding='utf-8') as f:
    f.write('/* Generated by tools/build_hero_data.py from datasets/ and Orissa.geojson.\n'
            '   Do not edit by hand: change the source data and run the script again. */\n')
    f.write('window.SOOCHANA_HERO = ')
    json.dump(out, f, separators=(',', ':'))
    f.write(';\n')

print('dots', len(dots), 'districts', len(districts), 'growth', [g[0] for g in growth])
for y in pyr:
    s = sum(a + b for a, b in pyr[y][12:])
    print(y, '60+ %.1f%%' % s)
print('smallest district dot count', min(d['dots'] for d in districts))
