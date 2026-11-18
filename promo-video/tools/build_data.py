"""Builds src/data/odisha.json for the promo video from the portal's own files.

Reads (from the portal root, one folder up):
  Orissa.geojson                             district boundaries
  datasets/district_population_trends.json   population by district, 1951-2036

Writes the district outlines as SVG paths in a 1000 x 1000 box, a set of dots
spread evenly inside the state (each tagged with its district), and the state
population for every data year. Standard library only.
"""
import json
import math
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(HERE, '..', 'src', 'data', 'odisha.json')

BOX = 1000
PAD = 20
N_DOTS = 1100
# The boundary file and the data file spell two districts differently.
GEO_TO_DATA = {'Balangir': 'Bolangir', 'Nabarangapur': 'Nabarangpur'}


def rings_of(geom):
    if geom['type'] == 'Polygon':
        return [geom['coordinates'][0]]
    return [poly[0] for poly in geom['coordinates']]


def inside(x, y, ring):
    hit = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            hit = not hit
        j = i
    return hit


def main():
    geo = json.load(open(os.path.join(ROOT, 'Orissa.geojson'), encoding='utf-8'))
    pop = json.load(open(os.path.join(ROOT, 'datasets', 'district_population_trends.json'), encoding='utf-8'))

    lons, lats = [], []
    for f in geo['features']:
        for ring in rings_of(f['geometry']):
            for lon, lat in ring:
                lons.append(lon)
                lats.append(lat)
    k = math.cos(math.radians((min(lats) + max(lats)) / 2))
    w = (max(lons) - min(lons)) * k
    h = max(lats) - min(lats)
    s = (BOX - 2 * PAD) / max(w, h)
    ox = (BOX - w * s) / 2
    oy = (BOX - h * s) / 2

    def proj(lon, lat):
        return (ox + (lon - min(lons)) * k * s, oy + (max(lats) - lat) * s)

    districts = []
    for f in geo['features']:
        name = f['properties']['Dist_Name']
        rings = [[proj(lon, lat) for lon, lat in ring] for ring in rings_of(f['geometry'])]
        d = ''.join('M' + 'L'.join('%.1f,%.1f' % p for p in r[::2]) + 'Z' for r in rings)
        cx = sum(p[0] for r in rings for p in r) / sum(len(r) for r in rings)
        cy = sum(p[1] for r in rings for p in r) / sum(len(r) for r in rings)
        districts.append({'name': GEO_TO_DATA.get(name, name), 'd': d,
                          'cx': round(cx, 1), 'cy': round(cy, 1), 'rings': rings})

    # A hex grid over the state, tightened until it holds a few more dots than needed.
    step = 30.0
    while True:
        pts = []
        row = 0
        y = PAD
        while y < BOX - PAD:
            x = PAD + (step / 2 if row % 2 else 0)
            while x < BOX - PAD:
                for i, dist in enumerate(districts):
                    if any(inside(x, y, r) for r in dist['rings']):
                        pts.append((x, y, i))
                        break
                x += step
            y += step * math.sqrt(3) / 2
            row += 1
        if len(pts) >= N_DOTS:
            break
        step *= 0.96
    rnd = random.Random(21)
    rnd.shuffle(pts)
    pts = sorted(pts[:N_DOTS], key=lambda p: (p[1], p[0]))
    dots = [[round(x, 1), round(y, 1), i] for x, y, i in pts]

    years = sorted(int(y) for y in next(iter(pop.values())))
    state = {str(y): sum(d[str(y)]['total'] for d in pop.values()) for y in years}

    for dist in districts:
        del dist['rings']
    out = {'box': BOX, 'dotStep': round(step, 2), 'districts': districts,
           'dots': dots, 'statePop': state, 'source': 'Orissa.geojson; datasets/district_population_trends.json'}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, separators=(',', ':'))
    print('wrote', OUT, len(districts), 'districts,', len(dots), 'dots, step', round(step, 1))


if __name__ == '__main__':
    main()
