"""Draw the illustrations for the home page scroll story (index.html, .story-card).

One flat drawing per card, written to images/story/<step>.svg, where <step> is the
card's data-step. Every drawing shares one palette and one set of parts (people,
houses, trees, icons), so the fifteen read as a set. They carry no numbers or
words: the figures live in the card text, which story.js keeps up to date.

    python tools/build_story_art.py
"""
import math
import os

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'images', 'story')
W, H = 360, 150
BASE = 138                     # the ground line

# ── palette (navy, amber, orange and sky, as in the reference infographics) ──
NAVY = '#27325e'
INDIGO = '#3d4c96'
SKY = '#7fb2e5'
SKY_L = '#d6e6f7'
AMBER = '#ffc15e'
YELLOW = '#ffd966'
ORANGE = '#ff9455'
CORAL = '#ec7a5c'
TEAL = '#2a9d8f'
GREEN = '#5bb07a'
LEAF = '#3e8a5e'
CREAM = '#fff8ea'
SAND = '#f3dfb8'
GROUND = '#e3e6f2'
GREY = '#aab0c4'
WHITE = '#ffffff'
HAIR = '#1f2335'
GREY_HAIR = '#d5d8e0'
SKIN = ['#f0c39c', '#d79e74', '#b97c55', '#8e5a3a']
# the story's own three colours: children, working age, elders
CHILD, WORK, ELDER = '#0f9466', '#2a78d6', '#e05524'


def f(v):
    return ('%.1f' % v).rstrip('0').rstrip('.')


def svg(body, title):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" role="img">'
            '<title>%s</title>%s</svg>\n' % (W, H, title, body))


def ground(x1=8, x2=352, y=BASE, color=GROUND):
    return '<rect x="%s" y="%s" width="%s" height="5" rx="2.5" fill="%s"/>' % (f(x1), f(y - 1), f(x2 - x1), color)


def shadow(x, w, y=BASE):
    return '<ellipse cx="%s" cy="%s" rx="%s" ry="3" fill="%s"/>' % (f(x), f(y + 1), f(w / 2), '#d3d7e8')


# ── people: faceless, flat, as in the references ──
def person(x, h, skin, top, bottom=NAVY, kind='man', hair=HAIR, wave=0, cane=False,
           face=1, base=BASE, accent=None, hold=None):
    """A standing figure, feet on `base`, `h` tall. kind: man, woman, girl, boy.
    wave: +1 raises the right arm, -1 the left. face: +1 looks right, -1 left
    (moves the bun and the cane)."""
    child = kind in ('girl', 'boy')
    woman = kind in ('woman', 'girl')
    r = h * (0.105 if child else 0.085)
    hy = base - h + r                               # head centre
    sy = hy + r + h * 0.035                          # shoulders
    tw = h * (0.27 if child else 0.25)               # torso width
    hip = base - h * 0.43
    out = [shadow(x, tw * 1.7, base)]
    # legs
    lw = tw * 0.34
    for dx in (-tw * 0.22, tw * 0.22):
        out.append('<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s"/>'
                   % (f(x + dx - lw / 2), f(hip - 2), f(lw), f(base - hip - 1), f(lw / 2), bottom))
        out.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s"/>'
                   % (f(x + dx + face * lw * 0.25), f(base - 1.2), f(lw * 0.75), f(lw * 0.4), HAIR))
    # arms (behind the body)
    aw = tw * 0.27
    al = h * (0.3 if child else 0.33)
    for side in (-1, 1):
        ax = x + side * (tw / 2 + aw * 0.15)
        rot = 0
        if wave == side:
            rot = -side * 150
        elif hold is not None:
            rot = -side * 35
        out.append('<g transform="rotate(%s %s %s)"><rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s"/>'
                   '<circle cx="%s" cy="%s" r="%s" fill="%s"/></g>'
                   % (f(rot), f(ax), f(sy + aw / 2), f(ax - aw / 2), f(sy), f(aw), f(al), f(aw / 2), top,
                      f(ax), f(sy + al), f(aw * 0.55), skin))
    # body
    if woman:
        bot = base - h * (0.14 if not child else 0.3)
        out.append('<path d="M%s %s Q%s %s %s %s L%s %s Q%s %s %s %s Z" fill="%s"/>'
                   % (f(x - tw / 2), f(sy + 3), f(x), f(sy - 3), f(x + tw / 2), f(sy + 3),
                      f(x + tw * 0.8), f(bot), f(x), f(bot + 3), f(x - tw * 0.8), f(bot), top))
        if accent:      # the pallu of a saree, or a sash
            out.append('<path d="M%s %s L%s %s L%s %s L%s %s Z" fill="%s"/>'
                       % (f(x - tw * 0.5), f(sy + 2), f(x - tw * 0.15), f(sy), f(x + tw * 0.75), f(bot - 2),
                          f(x + tw * 0.35), f(bot), accent))
    else:
        out.append('<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s"/>'
                   % (f(x - tw / 2), f(sy), f(tw), f(hip - sy + 4), f(tw * 0.3), top))
        if accent:
            out.append('<rect x="%s" y="%s" width="%s" height="%s" fill="%s"/>'
                       % (f(x - tw / 2), f(hip - 3), f(tw), f(5), accent))
    # neck and head
    out.append('<rect x="%s" y="%s" width="%s" height="%s" fill="%s"/>'
               % (f(x - r * 0.35), f(hy + r * 0.6), f(r * 0.7), f(sy - hy - r * 0.4), skin))
    if woman:
        out.append('<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (f(x - face * r * 0.95), f(hy - r * 0.15), f(r * 0.5), hair))
    out.append('<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (f(x), f(hy - r * 0.16), f(r * 1.04), hair))
    out.append('<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (f(x + face * r * 0.08), f(hy + r * 0.08), f(r * 0.92), skin))
    if cane:
        cx = x + face * (tw / 2 + aw)
        out.append('<path d="M%s %s L%s %s" stroke="%s" stroke-width="2.4" stroke-linecap="round"/>'
                   % (f(cx), f(sy + al - 2), f(cx + face * 3), f(base), '#8a5a35'))
    if hold:
        out.append(hold(x, sy, al, tw))
    return ''.join(out)


# ── things ──
def hut(x, w, wall=CREAM, roof=AMBER, door=NAVY, base=BASE):
    h = w * 0.55
    rh = w * 0.42
    return ('<rect x="%s" y="%s" width="%s" height="%s" fill="%s"/>'
            '<path d="M%s %s L%s %s L%s %s Z" fill="%s"/>'
            '<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s"/>'
            % (f(x), f(base - h), f(w), f(h), wall,
               f(x - w * 0.12), f(base - h + 2), f(x + w / 2), f(base - h - rh), f(x + w * 1.12), f(base - h + 2), roof,
               f(x + w * 0.38), f(base - h * 0.62), f(w * 0.24), f(h * 0.62), f(w * 0.12), door))


def tree(x, h, canopy=GREEN, trunk='#8a5a35', base=BASE, round_=True):
    r = h * 0.3
    s = '<rect x="%s" y="%s" width="%s" height="%s" rx="1.5" fill="%s"/>' % (f(x - h * 0.03), f(base - h * 0.5), f(h * 0.06), f(h * 0.5), trunk)
    if round_:
        s += '<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (f(x), f(base - h + r), f(r), canopy)
        s += '<circle cx="%s" cy="%s" r="%s" fill="%s" opacity="0.35"/>' % (f(x + r * 0.35), f(base - h + r * 1.2), f(r * 0.55), WHITE)
    else:   # a sal or conifer shape
        s += '<path d="M%s %s L%s %s L%s %s Z" fill="%s"/>' % (f(x - r), f(base - h * 0.35), f(x), f(base - h), f(x + r), f(base - h * 0.35), canopy)
    return s


def palm(x, h, base=BASE, lean=1):
    top = (x + lean * h * 0.18, base - h)
    s = '<path d="M%s %s Q%s %s %s %s" stroke="#8a5a35" stroke-width="4" fill="none" stroke-linecap="round"/>' % (
        f(x), f(base), f(x + lean * h * 0.02), f(base - h * 0.6), f(top[0]), f(top[1]))
    for ang in (-160, -125, -90, -55, -20):
        a = math.radians(ang)
        ex, ey = top[0] + math.cos(a) * h * 0.42, top[1] + math.sin(a) * h * 0.22 + h * 0.12
        mx, my = top[0] + math.cos(a) * h * 0.25, top[1] - h * 0.12
        s += '<path d="M%s %s Q%s %s %s %s" stroke="%s" stroke-width="5" fill="none" stroke-linecap="round"/>' % (
            f(top[0]), f(top[1]), f(mx), f(my), f(ex), f(ey), LEAF)
    return s


def building(x, w, h, color=SKY, win=WHITE, base=BASE):
    s = '<rect x="%s" y="%s" width="%s" height="%s" rx="2" fill="%s"/>' % (f(x), f(base - h), f(w), f(h), color)
    cols = max(1, int(w // 9))
    rows = max(1, int((h - 10) // 11))
    gw = w / cols
    for i in range(cols):
        for j in range(rows):
            s += '<rect x="%s" y="%s" width="%s" height="5" rx="1" fill="%s" opacity="0.85"/>' % (
                f(x + i * gw + gw * 0.25), f(base - h + 6 + j * 11), f(gw * 0.5), win)
    return s


def sun(x, y, r, color=YELLOW):
    return '<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (f(x), f(y), f(r), color)


def cloud(x, y, s=1, color=WHITE):
    return ('<g fill="%s"><ellipse cx="%s" cy="%s" rx="%s" ry="%s"/><circle cx="%s" cy="%s" r="%s"/>'
            '<circle cx="%s" cy="%s" r="%s"/></g>' % (color, f(x), f(y), f(16 * s), f(6 * s), f(x - 5 * s), f(y - 5 * s),
                                                       f(7 * s), f(x + 6 * s), f(y - 4 * s), f(5 * s)))


def heart(x, y, s, color=CORAL):
    return ('<path transform="translate(%s %s) scale(%s)" d="M0 6 C-2 -2 -12 -2 -12 6 C-12 12 -4 16 0 20 '
            'C4 16 12 12 12 6 C12 -2 2 -2 0 6 Z" fill="%s"/>' % (f(x), f(y), f(s), color))


def plus(x, y, s, color=WHITE):
    return ('<path transform="translate(%s %s) scale(%s)" d="M-2.5 -8 h5 v5.5 h5.5 v5 h-5.5 v5.5 h-5 v-5.5 h-5.5 v-5 h5.5 Z" fill="%s"/>'
            % (f(x), f(y), f(s), color))


def book(x, y, w, h, color, page=WHITE):
    return ('<rect x="%s" y="%s" width="%s" height="%s" rx="2" fill="%s"/>'
            '<rect x="%s" y="%s" width="%s" height="%s" fill="%s"/>'
            % (f(x), f(y), f(w), f(h), color, f(x + 3), f(y + h * 0.2), f(w - 3), f(h * 0.6), page))


def hexagon(x, y, r, fill, icon=''):
    pts = ' '.join('%s,%s' % (f(x + r * math.cos(math.radians(60 * i + 30))), f(y + r * math.sin(math.radians(60 * i + 30))))
                   for i in range(6))
    return '<polygon points="%s" fill="%s"/>%s' % (pts, fill, icon)


def dot(x, y, r, color):
    return '<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (f(x), f(y), f(r), color)


def rounded_bar(x, w, h, color, base=BASE):
    return '<path d="M%s %s V%s A%s %s 0 0 1 %s %s V%s Z" fill="%s"/>' % (
        f(x), f(base), f(base - h + w / 2), f(w / 2), f(w / 2), f(x + w), f(base - h + w / 2), f(base), color)


def bag(x, y, s=1, color=ORANGE):
    """A school bag, top-left at x, y."""
    return ('<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s"/>'
            '<rect x="%s" y="%s" width="%s" height="%s" rx="2" fill="%s" opacity="0.9"/>'
            % (f(x), f(y), f(14 * s), f(18 * s), f(4 * s), color, f(x + 3 * s), f(y + 9 * s), f(8 * s), f(6 * s), AMBER))


# ── the fifteen drawings ──
def art_people():
    b = [ground(), dot(60, 26, 4, CHILD), dot(76, 18, 4, WORK), dot(92, 28, 4, ELDER), dot(250, 20, 4, WORK),
         dot(268, 30, 4, CHILD), dot(284, 16, 4, WORK), dot(300, 26, 4, ELDER), dot(176, 14, 4, WORK)]
    crowd = [
        (44, 92, SKIN[2], INDIGO, 'man', HAIR, None),
        (82, 86, SKIN[1], CORAL, 'woman', HAIR, AMBER),
        (114, 50, SKIN[0], YELLOW, 'girl', HAIR, None),
        (146, 96, SKIN[3], TEAL, 'man', GREY_HAIR, None),
        (182, 88, SKIN[0], AMBER, 'woman', HAIR, CORAL),
        (214, 54, SKIN[2], SKY, 'boy', HAIR, None),
        (248, 94, SKIN[1], ORANGE, 'man', HAIR, None),
        (286, 84, SKIN[3], INDIGO, 'woman', GREY_HAIR, SKY),
        (318, 56, SKIN[1], CORAL, 'girl', HAIR, None),
    ]
    for x, h, sk, top, kind, hair, acc in crowd:
        b.append(person(x, h, sk, top, kind=kind, hair=hair, accent=acc, wave=1 if x == 214 else 0))
    return svg(''.join(b), 'A crowd of people of all ages')


def art_rural():
    b = [sun(316, 28, 13), cloud(70, 30, 1.1), cloud(220, 22, 0.8),
         '<path d="M8 %d Q120 112 240 %d L240 %d L8 %d Z" fill="#cfe8d3"/>' % (BASE - 18, BASE - 12, BASE, BASE)]
    # fields
    for i in range(5):
        b.append('<path d="M%d %d L%d %d" stroke="%s" stroke-width="3" stroke-linecap="round"/>'
                 % (14 + i * 6, BASE - 4 - i * 3, 150 - i * 14, BASE - 4 - i * 3, '#9fd0a8'))
    b += [ground(),
          palm(24, 74, lean=1), hut(52, 40, roof=AMBER), hut(106, 34, roof=ORANGE, wall='#fff1d6'),
          tree(160, 70, GREEN), hut(178, 38, roof=AMBER),
          person(136, 62, SKIN[2], CORAL, kind='woman', accent=AMBER),
          building(262, 22, 62, SKY_L, SKY), building(286, 26, 84, SKY), building(314, 20, 50, '#bcd3ee', WHITE),
          person(246, 54, SKIN[1], INDIGO, kind='man', face=-1)]
    return svg(''.join(b), 'Thatched village homes and fields, with a small town in the distance')


def art_tribal():
    b = [sun(290, 34, 15, AMBER),
         '<path d="M0 %d Q60 56 130 92 T260 70 T360 86 V%d H0 Z" fill="#b9d6ef"/>' % (BASE - 30, BASE),
         '<path d="M0 %d Q80 82 170 104 T360 98 V%d H0 Z" fill="#8fc4a3"/>' % (BASE - 14, BASE),
         ground()]
    for x, h in ((20, 64), (40, 82), (62, 58), (300, 70), (322, 88), (344, 60)):
        b.append(tree(x, h, LEAF if h > 65 else GREEN, round_=False))
    # two homes with painted walls
    for x, w, roof in ((96, 46, ORANGE), (196, 40, AMBER)):
        b.append(hut(x, w, wall='#f6e3c4', roof=roof, door=NAVY))
        for i in range(3):
            b.append('<path d="M%s %s l4 -6 l4 6 Z" fill="%s"/>' % (f(x + 4 + i * (w - 12) / 2), f(BASE - 6), CORAL))
    b += [person(160, 66, SKIN[3], TEAL, kind='woman', accent=AMBER),
          person(262, 70, SKIN[2], ORANGE, kind='man', face=-1),
          person(278, 44, SKIN[3], YELLOW, kind='girl', face=-1)]
    return svg(''.join(b), 'Homes among forested hills')


def art_line1():
    b = [ground()]
    # an hourglass
    b.append('<g transform="translate(46 %d)"><rect x="-22" y="-92" width="44" height="7" rx="3" fill="%s"/>'
             '<rect x="-22" y="-7" width="44" height="7" rx="3" fill="%s"/>'
             '<path d="M-16 -85 H16 Q16 -60 3 -46 Q16 -32 16 -7 H-16 Q-16 -32 -3 -46 Q-16 -60 -16 -85 Z" fill="%s"/>'
             '<path d="M-10 -78 H10 Q8 -64 0 -56 Q-8 -64 -10 -78 Z" fill="%s"/>'
             '<path d="M-13 -7 Q0 -26 13 -7 Z" fill="%s"/></g>' % (BASE, NAVY, NAVY, SKY_L, AMBER, AMBER))
    # saplings that barely grow
    for i, (x, h) in enumerate(((122, 26), (176, 30), (230, 34), (284, 38))):
        b.append('<path d="M%s %d h22 l-3 16 h-16 Z" fill="%s"/>' % (f(x - 11), BASE - 16, ORANGE))
        b.append('<path d="M%s %d V%s" stroke="%s" stroke-width="3" stroke-linecap="round"/>' % (f(x), BASE - 16, f(BASE - 16 - h), LEAF))
        b.append('<ellipse cx="%s" cy="%s" rx="9" ry="5" fill="%s" transform="rotate(-30 %s %s)"/>' % (
            f(x + 8), f(BASE - 16 - h * 0.7), GREEN, f(x + 8), f(BASE - 16 - h * 0.7)))
        b.append('<ellipse cx="%s" cy="%s" rx="9" ry="5" fill="%s" transform="rotate(30 %s %s)"/>' % (
            f(x - 8), f(BASE - 16 - h * 0.45), GREEN, f(x - 8), f(BASE - 16 - h * 0.45)))
    b.append('<path d="M110 40 Q200 30 300 34" stroke="%s" stroke-width="2.5" stroke-dasharray="2 7" stroke-linecap="round" fill="none"/>' % GREY)
    b.append(person(332, 70, SKIN[1], INDIGO, kind='man', face=-1))
    return svg(''.join(b), 'Seedlings growing slowly beside an hourglass')


def art_line2():
    b = [ground()]
    for i, (x, h, c) in enumerate(((176, 34, SKY_L), (206, 52, SKY), (236, 74, '#5b93d6'), (266, 98, INDIGO), (296, 118, NAVY))):
        b.append(rounded_bar(x, 22, h, c))
    b.append('<path d="M180 %d Q250 70 318 14" stroke="%s" stroke-width="3" fill="none" stroke-linecap="round"/>' % (BASE - 44, ORANGE))
    b.append('<path d="M318 14 l-10 2 M318 14 l-2 10" stroke="%s" stroke-width="3" stroke-linecap="round"/>' % ORANGE)
    # a health worker and a mother with her baby
    b.append(person(48, 92, SKIN[1], WHITE, kind='woman', accent=SKY))
    b.append('<circle cx="48" cy="%s" r="7" fill="%s"/>' % (f(BASE - 60), CORAL))
    b.append(plus(48, BASE - 60, 0.6))
    b.append(person(110, 88, SKIN[2], CORAL, kind='woman', accent=AMBER, face=-1))
    b.append('<ellipse cx="110" cy="%s" rx="11" ry="8" fill="%s"/>' % (f(BASE - 58), YELLOW))
    b.append('<circle cx="102" cy="%s" r="5.5" fill="%s"/>' % (f(BASE - 62), SKIN[2]))
    b.append(heart(146, 28, 0.9))
    return svg(''.join(b), 'A health worker and a mother with her baby, beside rising bars')


def art_line3():
    b = [cloud(250, 30, 1), sun(330, 26, 11),
         '<path d="M0 %d C80 %d 140 64 220 56 S320 50 360 50 V%d H0 Z" fill="#dce8f6"/>' % (BASE, BASE - 6, BASE),
         '<path d="M18 %d C90 %d 150 68 222 60 S312 54 344 54" stroke="%s" stroke-width="7" fill="none" stroke-linecap="round"/>'
         % (BASE - 6, BASE - 10, AMBER),
         '<path d="M18 %d C90 %d 150 68 222 60 S312 54 344 54" stroke="%s" stroke-width="2" stroke-dasharray="6 6" fill="none"/>'
         % (BASE - 6, BASE - 10, WHITE),
         ground(),
         '<path d="M330 54 V20" stroke="%s" stroke-width="2.5"/><path d="M330 20 L350 26 L330 32 Z" fill="%s"/>' % (NAVY, ORANGE),
         tree(60, 46, GREEN), tree(286, 30, LEAF, base=56), tree(304, 24, GREEN, base=55)]
    b.append(person(158, 40, SKIN[1], CORAL, kind='woman', accent=AMBER, base=79))
    b.append(person(176, 44, SKIN[2], INDIGO, kind='man', base=73))
    return svg(''.join(b), 'A road climbing a hill and levelling out toward a flag')


def art_growth():
    b = [ground()]
    heights = [30, 52, 76, 96, 90, 74, 58, 44, 34]
    cols = [AMBER, AMBER, ORANGE, ORANGE, ORANGE, SKY, SKY, INDIGO, INDIGO]
    for i, (h, c) in enumerate(zip(heights, cols)):
        b.append(rounded_bar(118 + i * 24, 16, h, c))
    b.append('<path d="M126 %d Q190 %d 214 %d T334 %d" stroke="%s" stroke-width="2.5" fill="none" stroke-dasharray="1 6" stroke-linecap="round"/>'
             % (BASE - 38, BASE - 120, BASE - 104, BASE - 42, NAVY))
    # a woman pointing at the chart, a man with notes
    b.append(person(44, 94, SKIN[2], TEAL, kind='woman', accent=AMBER, wave=1))
    b.append(person(86, 90, SKIN[0], NAVY, kind='man',
                    hold=lambda x, sy, al, tw: '<rect x="%s" y="%s" width="16" height="20" rx="2" fill="%s"/>'
                    '<path d="M%s %s h10 M%s %s h10 M%s %s h7" stroke="%s" stroke-width="1.6"/>'
                    % (f(x - 8), f(sy + al * 0.55), WHITE, f(x - 5), f(sy + al * 0.55 + 6), f(x - 5),
                       f(sy + al * 0.55 + 10), f(x - 5), f(sy + al * 0.55 + 14), GREY)))
    return svg(''.join(b), 'Columns that rise to a peak and settle, with two people reading them')


def art_tfrA():
    b = [ground(),
         '<rect x="196" y="%d" width="120" height="70" rx="4" fill="%s"/>' % (BASE - 70, CREAM),
         '<path d="M186 %d L256 %d L326 %d Z" fill="%s"/>' % (BASE - 66, BASE - 112, BASE - 66, CORAL),
         '<rect x="244" y="%d" width="24" height="40" rx="12" fill="%s"/>' % (BASE - 40, NAVY),
         '<rect x="208" y="%d" width="22" height="20" rx="3" fill="%s"/><rect x="282" y="%d" width="22" height="20" rx="3" fill="%s"/>'
         % (BASE - 58, SKY, BASE - 58, SKY),
         tree(334, 70, GREEN), heart(150, 18, 0.85)]
    family = [(40, 96, SKIN[2], INDIGO, 'man', None), (82, 58, SKIN[2], YELLOW, 'boy', None),
              (118, 90, SKIN[1], CORAL, 'woman', AMBER), (156, 54, SKIN[1], TEAL, 'girl', None)]
    for x, h, sk, top, kind, acc in family:
        b.append(person(x, h, sk, top, kind=kind, accent=acc))
    return svg(''.join(b), 'A family of four holding hands in front of their home')


def art_tfrB():
    b = [ground()]
    # a stack of books with a child reading on top
    b += [book(150, BASE - 18, 96, 18, INDIGO), book(160, BASE - 34, 80, 16, ORANGE), book(146, BASE - 50, 90, 16, TEAL)]
    b.append(person(196, 64, SKIN[2], YELLOW, kind='girl', base=BASE - 50, wave=1))
    b.append(bag(216, BASE - 50 - 18, 1, CORAL))
    # a graduation cap and a pencil
    b.append('<g transform="translate(296 %d)"><path d="M-28 0 L0 -12 L28 0 L0 12 Z" fill="%s"/>'
             '<path d="M-16 5 V16 Q0 24 16 16 V5 L0 12 Z" fill="%s"/>'
             '<path d="M22 2 V20" stroke="%s" stroke-width="2"/><circle cx="22" cy="21" r="3" fill="%s"/></g>'
             % (BASE - 86, NAVY, INDIGO, AMBER, AMBER))
    b.append('<g transform="rotate(-38 304 %d)"><rect x="270" y="%d" width="64" height="12" fill="%s"/>'
             '<path d="M334 %d l14 6 l-14 6 Z" fill="%s"/><rect x="264" y="%d" width="8" height="12" rx="2" fill="%s"/></g>'
             % (BASE - 22, BASE - 28, AMBER, BASE - 28, SAND, BASE - 28, CORAL))
    # health
    b.append('<circle cx="62" cy="%d" r="28" fill="%s"/>' % (BASE - 70, SKY_L))
    b.append(heart(62, BASE - 84, 1.25))
    b.append(plus(62, BASE - 70, 0.75))
    b.append(person(98, 92, SKIN[1], CORAL, kind='woman', accent=AMBER, face=1))
    b.append(person(30, 50, SKIN[1], ORANGE, kind='boy'))
    return svg(''.join(b), 'A girl reading on a stack of books, with symbols for health and schooling')


def ic_briefcase(x, y):
    return ('<rect x="%s" y="%s" width="20" height="14" rx="2" fill="%s"/><path d="M%s %s v-4 h8 v4" stroke="%s" stroke-width="2.4" fill="none"/>'
            % (f(x - 10), f(y - 5), WHITE, f(x - 4), f(y - 5), WHITE))


def ic_laptop(x, y):
    return ('<rect x="%s" y="%s" width="18" height="12" rx="1.5" fill="%s"/><rect x="%s" y="%s" width="24" height="3" rx="1.5" fill="%s"/>'
            % (f(x - 9), f(y - 8), WHITE, f(x - 12), f(y + 5), WHITE))


def ic_leaf(x, y):
    return ('<path d="M%s %s Q%s %s %s %s Q%s %s %s %s Z" fill="%s"/><path d="M%s %s L%s %s" stroke="%s" stroke-width="1.6"/>'
            % (f(x - 9), f(y + 9), f(x - 10), f(y - 10), f(x + 10), f(y - 10), f(x + 10), f(y + 8), f(x - 9), f(y + 9), WHITE,
               f(x - 9), f(y + 9), f(x + 4), f(y - 4), INDIGO))


def ic_gear(x, y, bg):
    s = ''
    for i in range(8):
        a = math.radians(i * 45)
        s += '<rect x="%s" y="%s" width="5" height="6" fill="%s" transform="rotate(%s %s %s)"/>' % (
            f(x - 2.5), f(y - 12), WHITE, f(i * 45), f(x), f(y))
    return s + '<circle cx="%s" cy="%s" r="8.5" fill="%s"/><circle cx="%s" cy="%s" r="3.5" fill="%s"/>' % (f(x), f(y), WHITE, f(x), f(y), bg)


def ic_cross(x, y):
    return plus(x, y, 1.1)


def ic_book(x, y):
    return ('<path d="M%s %s Q%s %s %s %s V%s Q%s %s %s %s Z M%s %s Q%s %s %s %s V%s Q%s %s %s %s Z" fill="%s"/>'
            % (f(x - 1), f(y - 6), f(x - 6), f(y - 10), f(x - 12), f(y - 7), f(y + 8), f(x - 6), f(y + 5), f(x - 1), f(y + 9),
               f(x + 1), f(y - 6), f(x + 6), f(y - 10), f(x + 12), f(y - 7), f(y + 8), f(x + 6), f(y + 5), f(x + 1), f(y + 9), WHITE))


def art_ageA():
    b = [ground()]
    r = 21
    dx, dy = r * math.sqrt(3), r * 1.5
    cells = [(0, 0, NAVY, ic_briefcase), (1, 0, CORAL, ic_laptop), (2, 0, GREY, ic_leaf),
             (0.5, 1, ORANGE, ic_gear), (1.5, 1, INDIGO, ic_book), (2.5, 1, CORAL, ic_cross),
             (1, 2, NAVY, ic_leaf), (2, 2, TEAL, ic_briefcase)]
    ox, oy = 190, 30
    for cx, cy, fill, ic in cells:
        x, y = ox + cx * (dx + 3), oy + cy * (dy + 3)
        icon = ic(x, y, fill) if ic is ic_gear else ic(x, y)
        b.append(hexagon(x, y, r, fill, icon))
    b.append(person(44, 94, SKIN[2], ORANGE, kind='man', accent=NAVY,
                    hold=lambda x, sy, al, tw: '<path d="M%s %s a10 9 0 0 1 20 0 Z" fill="%s"/>' % (f(x - 10), f(sy - 18), AMBER)))
    b.append(person(84, 90, SKIN[1], SKY, kind='woman', accent=NAVY))
    b.append(person(124, 94, SKIN[3], TEAL, kind='man', face=-1,
                    hold=lambda x, sy, al, tw: ic_laptop(x, sy + al * 0.62).replace(WHITE, NAVY)))
    return svg(''.join(b), 'Working people beside a cluster of icons for jobs, farming, skills and health')


def art_ageB():
    b = [ground(), sun(312, 30, 13, AMBER), cloud(220, 28, 0.9),
         tree(326, 92, GREEN), tree(30, 70, LEAF)]
    # a bench
    b.append('<rect x="190" y="%d" width="96" height="8" rx="3" fill="%s"/><rect x="190" y="%d" width="96" height="7" rx="3" fill="%s"/>'
             '<rect x="198" y="%d" width="6" height="22" fill="%s"/><rect x="272" y="%d" width="6" height="22" fill="%s"/>'
             % (BASE - 30, ORANGE, BASE - 48, ORANGE, BASE - 22, NAVY, BASE - 22, NAVY))
    b.append(person(92, 88, SKIN[2], INDIGO, kind='man', hair=GREY_HAIR, cane=True, face=1))
    b.append(person(132, 82, SKIN[1], CORAL, kind='woman', hair=GREY_HAIR, accent=AMBER, face=-1))
    b.append('<path d="M106 %d Q112 %d 118 %d" stroke="%s" stroke-width="2.5" fill="none" stroke-linecap="round"/>' % (BASE - 50, BASE - 46, BASE - 50, SKIN[1]))
    b.append(heart(112, 18, 0.85))
    b.append(person(178, 48, SKIN[1], YELLOW, kind='girl', wave=-1, face=-1))
    return svg(''.join(b), 'An older couple walking together in a park')


def pin(x, y, color):
    return ('<path d="M%s %s c-7 -9 -10 -13 -10 -18 a10 10 0 0 1 20 0 c0 5 -3 9 -10 18 Z" fill="%s"/><circle cx="%s" cy="%s" r="3.6" fill="%s"/>'
            % (f(x), f(y), color, f(x), f(y - 18), WHITE))


def art_mapST():
    b = [ground()]
    # a folded map
    pts = [(96, 30), (156, 18), (216, 30), (276, 18), (276, 120), (216, 132), (156, 120), (96, 132)]
    cols = [SKY_L, '#c4dcf2', SKY_L]
    for i in range(3):
        x1 = 96 + i * 60
        top1 = 30 if i % 2 == 0 else 18
        top2 = 18 if i % 2 == 0 else 30
        b.append('<path d="M%d %d L%d %d L%d %d L%d %d Z" fill="%s"/>' % (x1, top1, x1 + 60, top2, x1 + 60, top2 + 102, x1, top1 + 102, cols[i]))
    b.append('<path d="M112 92 C130 60 160 96 180 70 S230 50 262 74" stroke="%s" stroke-width="3" fill="none" stroke-dasharray="5 5" stroke-linecap="round"/>' % GREY)
    b.append('<path d="M118 112 Q150 100 168 112 T214 108 L230 124 L118 124 Z" fill="#a9d7b6"/>')
    for x, y, c in ((122, 74, CHILD), (168, 60, WORK), (204, 96, ELDER), (240, 52, AMBER), (258, 98, INDIGO), (150, 110, ORANGE)):
        b.append(pin(x, y, c))
    # a magnifying glass
    b.append('<circle cx="300" cy="62" r="20" fill="%s" fill-opacity="0.35" stroke="%s" stroke-width="6"/>'
             '<path d="M314 78 L336 102" stroke="%s" stroke-width="9" stroke-linecap="round"/>' % (WHITE, NAVY, NAVY))
    b.append(person(46, 92, SKIN[1], TEAL, kind='woman', accent=AMBER, wave=1))
    return svg(''.join(b), 'A map with coloured pins and a magnifying glass')


def art_mapLit():
    b = [ground()]
    cx = 180
    # pencil trunk
    b.append('<rect x="%d" y="%d" width="22" height="58" fill="%s"/><rect x="%d" y="%d" width="22" height="7" fill="%s"/>'
             '<path d="M%d %d L%d %d L%d %d Z" fill="%s"/><path d="M%d %d L%d %d L%d %d Z" fill="%s"/>'
             % (cx - 11, BASE - 84, AMBER, cx - 11, BASE - 84, CORAL, cx - 11, BASE - 26, cx, BASE - 4, cx + 11, BASE - 26, SAND,
                cx - 4, BASE - 12, cx, BASE - 4, cx + 4, BASE - 12, NAVY))
    # branches ending in learning icons
    branches = [(-1, 'M174 %d V40 H120 V24', (120, 18)), (-1, 'M178 %d V62 H92 V50', (92, 44)),
                (-1, 'M174 %d V84 H60', (52, 84)), (1, 'M186 %d V34 H248 V20', (248, 14)),
                (1, 'M182 %d V58 H280 V44', (280, 38)), (1, 'M186 %d V80 H310', (318, 80)), (0, 'M180 %d V14', (180, 8))]
    for side, d, end in branches:
        b.append('<path d="%s" stroke="%s" stroke-width="3" fill="none" stroke-linejoin="round"/>' % (d % (BASE - 84), NAVY))
    b.append(dot(180, 8, 5, NAVY))
    b.append('<circle cx="120" cy="16" r="12" fill="%s"/><path d="M114 14 h12 M114 19 h8" stroke="%s" stroke-width="2"/>' % (SKY, WHITE))
    b.append(book(80, 34, 26, 18, CORAL))
    b.append('<circle cx="46" cy="84" r="13" fill="%s"/>%s' % (TEAL, ic_book(46, 84)))
    b.append('<circle cx="248" cy="12" r="11" fill="%s"/><rect x="244" y="22" width="8" height="5" rx="1" fill="%s"/>' % (YELLOW, GREY))
    b.append('<rect x="268" y="26" width="26" height="20" rx="3" fill="%s"/><path d="M273 33 h4 M275 31 v4 M282 33 h6 M282 39 h6 M273 39 l4 0" stroke="%s" stroke-width="1.8"/>' % (INDIGO, WHITE))
    b.append('<circle cx="322" cy="80" r="12" fill="%s"/><path d="M316 80 l4 4 l8 -8" stroke="%s" stroke-width="2.6" fill="none" stroke-linecap="round"/>' % (GREEN, WHITE))
    for x, y in ((140, 30), (226, 50), (96, 76), (262, 76), (60, 40), (300, 20)):
        b.append('<path d="M%s %s l1.6 3.4 l3.6 0.4 l-2.7 2.4 l0.8 3.6 l-3.3 -1.9 l-3.3 1.9 l0.8 -3.6 l-2.7 -2.4 l3.6 -0.4 Z" fill="none" stroke="%s" stroke-width="1.2"/>' % (f(x), f(y - 6), GREY))
    b.append(person(104, 48, SKIN[2], ORANGE, kind='boy', wave=1))
    b.append(person(262, 50, SKIN[1], YELLOW, kind='girl', face=-1))
    return svg(''.join(b), 'A pencil grown into a tree whose branches end in books and learning symbols')


def art_mapOld():
    b = [sun(70, 34, 14, AMBER), cloud(150, 24, 0.9),
         '<path d="M196 %d Q240 92 360 86 V%d Z" fill="#9cc9ee"/>' % (BASE, BASE),
         '<path d="M0 %d H200 Q230 %d 260 %d L360 %d V%d H0 Z" fill="%s"/>' % (BASE - 4, BASE - 10, BASE + 2, BASE + 2, BASE + 6, SAND)]
    for y, x0 in ((100, 250), (112, 230), (124, 280)):
        b.append('<path d="M%d %d q8 -5 16 0 t16 0 t16 0" stroke="%s" stroke-width="2" fill="none" stroke-linecap="round"/>' % (x0, y, WHITE))
    # a fishing boat with a sail
    b.append('<path d="M286 %d h48 l-8 10 h-32 Z" fill="%s"/><path d="M310 %d V%d L334 %d Z" fill="%s"/><path d="M310 %d V%d" stroke="%s" stroke-width="2"/>'
             % (82, ORANGE, 80, 46, 78, CREAM, 80, 44, NAVY))
    b.append(palm(30, 86, lean=1))
    # a bench with an older couple, a young man walking by
    b.append('<rect x="92" y="%d" width="70" height="7" rx="3" fill="%s"/><rect x="98" y="%d" width="5" height="16" fill="%s"/><rect x="150" y="%d" width="5" height="16" fill="%s"/>'
             % (BASE - 20, NAVY, BASE - 16, NAVY, BASE - 16, NAVY))
    b.append(person(110, 74, SKIN[2], INDIGO, kind='man', hair=GREY_HAIR, base=BASE - 4, cane=True, face=-1))
    b.append(person(144, 68, SKIN[1], CORAL, kind='woman', hair=GREY_HAIR, accent=AMBER, base=BASE - 4))
    b.append(person(204, 80, SKIN[3], TEAL, kind='man', face=1, base=BASE - 2))
    return svg(''.join(b), 'An older couple on a bench by the sea, with a fishing boat')


def art_close():
    b = [ground()]
    # three circles for children, working age and elders, joined by a path
    b.append('<path d="M84 48 Q140 4 196 48 T308 48" stroke="%s" stroke-width="3" stroke-dasharray="2 7" fill="none" stroke-linecap="round"/>' % GREY)
    for x, c, ic in ((84, CHILD, ic_book), (196, WORK, ic_briefcase), (308, ELDER, None)):
        b.append('<circle cx="%d" cy="48" r="27" fill="%s"/>' % (x, c))
        if ic:
            b.append(ic(x, 48))
    b.append(heart(308, 37, 0.95, WHITE))
    b.append(person(84, 52, SKIN[1], YELLOW, kind='girl'))
    b.append(person(196, 60, SKIN[2], ORANGE, kind='man'))
    b.append(person(308, 58, SKIN[2], INDIGO, kind='woman', hair=GREY_HAIR, accent=AMBER, face=-1))
    # a signpost
    b.append('<rect x="20" y="%d" width="5" height="62" fill="%s"/><path d="M24 %d h30 l7 7 l-7 7 h-30 Z" fill="%s"/><path d="M21 %d h-12 l-6 7 l6 7 h12 Z" fill="%s"/>'
             % (BASE - 62, NAVY, BASE - 60, AMBER, BASE - 42, SKY))
    return svg(''.join(b), 'Three circles for schooling, work and care, with a signpost')


ART = {
    'people': art_people, 'rural': art_rural, 'tribal': art_tribal,
    'line1': art_line1, 'line2': art_line2, 'line3': art_line3, 'growth': art_growth,
    'tfrA': art_tfrA, 'tfrB': art_tfrB, 'ageA': art_ageA, 'ageB': art_ageB,
    'mapST': art_mapST, 'mapLit': art_mapLit, 'mapOld': art_mapOld, 'close': art_close,
}


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, fn in ART.items():
        with open(os.path.join(OUT, name + '.svg'), 'w', encoding='utf-8') as fh:
            fh.write(fn())
    print('wrote %d drawings to %s' % (len(ART), OUT))


if __name__ == '__main__':
    main()
