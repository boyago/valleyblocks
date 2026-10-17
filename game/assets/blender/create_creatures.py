"""Bichos e pets do ValleyBlocks, modelados como caixas no estilo voxel do jogo.

Rodar no Blender (aba Scripting, ou pelo addon blender-mcp):
  blender --background --python assets/blender/create_creatures.py

As medidas são escritas já nas coordenadas do jogo (Three.js): X direita, Y cima,
Z frente (para onde o bicho anda). Na cena do Blender a mesma peça aparece em
(x, -z, y), para conferir no viewport e no render de prévia.

Cada criatura tem:
  body   peças fixas
  parts  grupos com ponto de giro (pivô), animados pelo jogo:
         leg0..legN (ordem: lado -1 trás, lado -1 frente, lado +1 trás, lado +1 frente),
         head e tail quando existem. A malha de cada grupo é gravada relativa ao pivô.

Saída: src/assets/creature-models.json
  { nome: { body: {positions, normals, colors}, parts: [{name, pivot, positions, normals, colors}] } }
"""
import bpy, json, math
from pathlib import Path
from mathutils import Euler, Vector

try:
    ROOT = Path(__file__).resolve().parents[2]
except NameError:  # executado pelo socket do addon, sem __file__
    ROOT = Path(r'D:\projetos\Games\vale-dos-blocos\game')
OUT = ROOT / 'src' / 'assets' / 'creature-models.json'

def rgb(color):
    return [round(int(color[i:i + 2], 16) / 255, 4) for i in (1, 3, 5)]

def shade(color, k):
    r, g, b = [min(255, max(0, round(int(color[i:i + 2], 16) * k))) for i in (1, 3, 5)]
    return f'#{r:02x}{g:02x}{b:02x}'

FACES = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
CORNERS = [(-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1), (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)]

def box(center, size, color, rot=(0, 0, 0), glow=False):
    """glow: peça que brilha no escuro (olhos, magma, fantasma); o jogo desenha sem sombra."""
    return {'c': center, 's': size, 'color': color, 'r': rot, 'glow': glow}

def corners(b, grow=0):
    """grow: folga por lado; detalhes saem um pouco para fora e não piscam (z-fighting)."""
    m = Euler(b['r'], 'XYZ').to_matrix()
    half = [v / 2 + grow for v in b['s']]
    return [Vector(b['c']) + m @ Vector((sx * half[0], sy * half[1], sz * half[2])) for sx, sy, sz in CORNERS]

def geometry(boxes, pivot=(0, 0, 0)):
    """Peças comuns + chave 'glow' com as peças brilhantes, se houver."""
    out = triangles([b for b in boxes if not b['glow']], pivot)
    lit = [b for b in boxes if b['glow']]
    if lit: out['glow'] = triangles(lit, pivot)
    return out

def triangles(boxes, pivot):
    """Triângulos com normal por face e cor por vértice, relativos ao pivô."""
    p0 = Vector(pivot); positions, normals, colors = [], [], []
    for k, b in enumerate(boxes):
        # Cada peça seguinte fica 0,5 mm mais "por cima" (até 5 mm): faces coplanares não brigam.
        v = [c - p0 for c in corners(b, min(.0005 * k, .005))]; col = rgb(b['color'])
        for f in FACES:
            a, bb, c, d = [v[i] for i in f]
            n = (bb - a).cross(d - a).normalized()
            for tri in ((a, bb, c), (a, c, d)):
                for p in tri:
                    positions.extend(round(k, 4) for k in p); normals.extend(round(k, 4) for k in n); colors.extend(col)
    return {'positions': positions, 'normals': normals, 'colors': colors}

EYE, SHINE = '#1c2422', '#fffbe8'
def eyes(x, y, z, w=.08, h=.09, color=EYE, side_facing=False):
    """Par de olhos com brilho. side_facing: olhos nas laterais da cabeça (aves, coelho)."""
    out = []
    for s in (-1, 1):
        if side_facing:
            out += [box((s * x, y, z), (.02, h, w), color), box((s * (x + .006), y + h * .25, z + w * .2), (.012, h * .35, w * .35), SHINE)]
        else:
            out += [box((s * x, y, z), (w, h, .02), color), box((s * x - s * w * .2, y + h * .25, z + .006), (w * .35, h * .35, .012), SHINE)]
    return out

def quad_legs(side_x, top, front_z, back_z, upper, paw, color, paw_color, paw_size=None):
    """Quatro pernas com pivô no alto (ombro/quadril); ordem leg0..leg3."""
    parts = []
    for i, (s, e) in enumerate([(-1, -1), (-1, 1), (1, -1), (1, 1)]):
        z = front_z if e > 0 else back_z; x = s * side_x
        boxes = [box((x, top - upper[1] / 2, z), upper, color)]
        ps = paw_size or (upper[0] * 1.15, paw, upper[2] * 1.25)
        boxes.append(box((x, ps[1] / 2, z + .02), ps, paw_color))
        parts.append({'name': f'leg{i}', 'pivot': (x, top, z), 'boxes': boxes})
    return parts

# ---------------------------------------------------------------- pets
DOG_COATS = [
    {'coat': '#ca9b66', 'light': '#efdcb0', 'ear': '#785945', 'tail': '#b58254'},
    {'coat': '#e0aa3f', 'light': '#ffedbf', 'ear': '#9f562d', 'tail': '#c07c30'},
    {'coat': '#454e50', 'light': '#e9ecdb', 'ear': '#222e31', 'tail': '#303b3d'},
]
CAT_COATS = [
    {'coat': '#9aaba5', 'light': '#e1e5cb', 'ear': '#9aaba5', 'tail': '#637e75'},
    {'coat': '#3c4850', 'light': '#f0eee0', 'ear': '#3c4850', 'tail': '#222e38'},
    {'coat': '#dba066', 'light': '#ffe3b4', 'ear': '#dba066', 'tail': '#9e5b3b'},
]

def dog(p, variant):
    c, l, dark = p['coat'], p['light'], shade(p['coat'], .78)
    body = [
        box((0, .55, -.05), (.56, .46, .9), c),
        box((0, .5, .33), (.44, .4, .22), l),            # peito claro
        box((0, .33, -.05), (.42, .05, .66), l),         # barriga
        box((0, .785, -.12), (.5, .04, .6), dark),       # dorso mais escuro
        box((0, .72, .36), (.32, .28, .24), c),          # pescoço
    ]
    if variant == 2: body.append(box((0, .79, .1), (.52, .03, .22), l))  # mancha clara no dorso (pelagem 3)
    head = [
        box((0, .9, .48), (.5, .44, .44), c),
        box((0, 1.09, .44), (.38, .06, .32), dark),      # topo da cabeça
        box((0, .8, .76), (.3, .2, .2), l),              # focinho
        box((0, .86, .865), (.12, .08, .05), '#262b2a'), # nariz
        box((0, .745, .86), (.16, .02, .02), '#3a2a24'), # boca
        box((0, .72, .83), (.08, .03, .08), '#e07a86'),  # língua
        *eyes(.13, .97, .705),
        *[box((s * .13, 1.04, .703), (.1, .025, .02), dark) for s in (-1, 1)],
        *[box((s * .27, .86, .44), (.09, .36, .2), p['ear'], (0, 0, s * .15)) for s in (-1, 1)],
    ]
    tail = [box((0, .78, -.66), (.12, .12, .32), p['tail'], (.55, 0, 0)), box((0, .88, -.79), (.1, .1, .1), l)]
    return {'body': body, 'parts': quad_legs(.2, .34, .34, -.34, (.16, .3, .18), .08, c, l) + [
        {'name': 'head', 'pivot': (0, .88, .49), 'boxes': head},
        {'name': 'tail', 'pivot': (0, .7, -.54), 'boxes': tail}]}

def cat(p, variant):
    c, l, dark = p['coat'], p['light'], shade(p['coat'], .8)
    body = [
        box((0, .43, -.05), (.46, .37, .75), c),
        box((0, .4, .26), (.3, .3, .2), l),
        box((0, .26, -.05), (.34, .04, .55), l),
    ]
    if variant == 2:  # gato laranja rajado
        body += [box((0, .62, z), (.47, .03, .08), p['tail']) for z in (-.28, -.1, .08)]
    if variant == 1:  # gato preto de "luvas" e peito branco já vêm de light
        body.append(box((0, .5, .33), (.2, .14, .06), l))
    head = [
        box((0, .74, .38), (.48, .38, .38), c),
        *[box((s * .17, .67, .5), (.14, .14, .12), l) for s in (-1, 1)],   # bochechas
        box((0, .67, .575), (.18, .1, .04), l),
        box((0, .705, .6), (.06, .04, .02), '#d98a8f'),                        # nariz
        box((0, .655, .598), (.08, .015, .01), '#7a5a55'),                     # boca
        *[box((s * .11, .78, .575), (.09, .08, .02), '#5fbf6a') for s in (-1, 1)],
        *[box((s * .11, .78, .587), (.025, .07, .01), '#13201a') for s in (-1, 1)],
        *[box((s * .095, .8, .592), (.015, .015, .008), SHINE) for s in (-1, 1)],
        *[box((s * .15, .96, .36), (.15, .12, .12), c, (0, 0, -s * .2)) for s in (-1, 1)],
        *[box((s * .17, 1.04, .36), (.08, .08, .1), c, (0, 0, -s * .2)) for s in (-1, 1)],
        *[box((s * .15, .97, .425), (.08, .08, .01), '#d8a09a', (0, 0, -s * .2)) for s in (-1, 1)],
        *[box((s * .27, y, .55), (.18, .01, .01), '#efeee0') for s in (-1, 1) for y in (.66, .63)],
    ]
    if variant != 1: head.append(box((0, .9, .4), (.22, .03, .3), dark))
    tail = [box((0, .78, -.47), (.1, .48, .1), c, (-.3, 0, 0)), box((0, 1.02, -.55), (.11, .14, .11), p['tail'])]
    return {'body': body, 'parts': quad_legs(.16, .29, .25, -.25, (.13, .26, .14), .06, c, l) + [
        {'name': 'head', 'pivot': (0, .74, .38), 'boxes': head},
        {'name': 'tail', 'pivot': (0, .57, -.4), 'boxes': tail}]}

# ---------------------------------------------------------------- bichos do Vale
def chicken():
    w, cream, red, beak = '#f3e9cc', '#fbf4e0', '#c94a3d', '#e8a83a'
    body = [
        box((0, .47, 0), (.42, .38, .52), w),
        box((0, .43, .22), (.34, .3, .14), cream),
        *[box((s * .23, .5, -.02), (.07, .26, .36), '#e6dcbc') for s in (-1, 1)],
        *[box((s * .235, .42, -.16), (.06, .1, .14), '#cdbf98') for s in (-1, 1)],
        box((0, .66, -.3), (.24, .26, .1), '#d9c7a0', (-.5, 0, 0)),
        box((0, .78, -.36), (.16, .16, .08), '#b8935f', (-.6, 0, 0)),
    ]
    head = [
        box((0, .76, .25), (.26, .28, .26), w),
        *[box((0, .93 + h / 2, z), (.06, h, .07), red) for z, h in ((.18, .07), (.25, .1), (.32, .07))],
        box((0, .73, .42), (.12, .08, .12), beak), box((0, .69, .4), (.1, .04, .08), shade(beak, .85)),
        box((0, .62, .37), (.06, .1, .05), red),
        *eyes(.131, .8, .31, w=.05, h=.05, side_facing=True),
    ]
    legs = []
    for i, s in enumerate((-1, 1)):
        x = s * .1
        legs.append({'name': f'leg{i}', 'pivot': (x, .28, 0), 'boxes': [box((x, .15, 0), (.05, .26, .05), '#e1a23a'), box((x, .02, .05), (.12, .03, .16), '#d8932a')]})
    return {'body': body, 'parts': legs + [{'name': 'head', 'pivot': (0, .74, .25), 'boxes': head}]}

def rabbit():
    g, light, dark = '#a6a098', '#d9d3c8', '#8c867e'
    body = [
        box((0, .33, -.03), (.38, .34, .5), g),
        *[box((s * .16, .28, -.17), (.1, .26, .28), dark) for s in (-1, 1)],
        box((0, .3, .2), (.26, .24, .14), light),
        box((0, .41, -.31), (.17, .17, .12), '#f4efe4'),
    ]
    head = [
        box((0, .56, .28), (.28, .26, .28), g),
        *[box((s * .1, .5, .38), (.1, .1, .08), light) for s in (-1, 1)],
        box((0, .545, .425), (.06, .04, .02), '#d79a9a'),
        *eyes(.141, .6, .32, w=.07, h=.07, side_facing=True),
        *[box((s * .07, .84, .23), (.08, .36, .06), g, (-.15, 0, s * .08)) for s in (-1, 1)],
        *[box((s * .07, .84, .262), (.05, .28, .01), '#e0b9ae', (-.15, 0, s * .08)) for s in (-1, 1)],
    ]
    legs = []
    for i, (s, e) in enumerate([(-1, -1), (-1, 1), (1, -1), (1, 1)]):
        if e > 0: x, top, z = s * .1, .2, .14; boxes = [box((x, .1, z + .02), (.08, .2, .1), light)]
        else: x, top, z = s * .15, .2, -.2; boxes = [box((x, .1, z), (.1, .16, .16), dark), box((x, .03, z + .08), (.12, .06, .26), light)]
        legs.append({'name': f'leg{i}', 'pivot': (x, top, z), 'boxes': boxes})
    return {'body': body, 'parts': legs + [{'name': 'head', 'pivot': (0, .55, .26), 'boxes': head}]}

def boar():
    c, dark, mane = '#6e4e3f', '#4e382d', '#3e322b'
    body = [
        box((0, .6, -.02), (.74, .56, .98), c),
        box((0, .82, .3), (.62, .2, .32), shade(c, .9)),
        box((0, .33, 0), (.58, .05, .78), shade(c, .82)),
        *[box((0, .9 + (.04 if i % 2 else 0), -.38 + i * .15), (.09, .14, .13), mane) for i in range(6)],
        box((0, .74, -.54), (.05, .18, .05), mane, (.3, 0, 0)),
    ]
    head = [
        box((0, .64, .62), (.48, .42, .36), c),
        box((0, .8, .58), (.36, .1, .26), dark),
        box((0, .56, .86), (.3, .22, .16), '#b58a73'),
        box((0, .56, .945), (.24, .16, .02), '#d6a58f'),
        *[box((s * .055, .56, .957), (.045, .06, .01), '#4a2f26') for s in (-1, 1)],
        *[box((s * .14, .64, .9), (.04, .14, .04), '#f2e6c8', (-.35, 0, s * .15)) for s in (-1, 1)],
        *eyes(.19, .73, .8, w=.06, h=.05),
        *[box((s * .19, .92, .55), (.12, .16, .08), dark, (0, 0, s * .35)) for s in (-1, 1)],
    ]
    return {'body': body, 'parts': quad_legs(.24, .34, .33, -.33, (.16, .3, .18), .07, dark, '#2e2420') + [
        {'name': 'head', 'pivot': (0, .65, .5), 'boxes': head}]}

# ---------------------------------------------------------------- bichos das outras terras
QUAD = [(-1, -1), (-1, 1), (1, -1), (1, 1)]
def quad_pos(x, back, front): return [(s * x, front if e > 0 else back) for s, e in QUAD]

def small_legs(positions, top, size, color, foot=None):
    parts = []
    for i, (x, z) in enumerate(positions):
        boxes = [box((x, top - size[1] / 2, z), size, color)]
        if foot: boxes.append(box((x, foot[1] / 2, z + .015), foot, shade(color, .8)))
        parts.append({'name': f'leg{i}', 'pivot': (x, top, z), 'boxes': boxes})
    return parts

def mico():
    o, mane, dark = '#f2a32a', '#f7b53c', '#c47a1a'
    body = [box((0, .3, 0), (.22, .24, .36), o), box((0, .28, .08), (.16, .16, .14), '#e8962a'),
            box((0, .34, -.36), (.06, .06, .44), '#e08f1f', (.6, 0, 0)), box((0, .17, -.53), (.07, .07, .1), '#9a5a14')]
    head = [box((0, .48, .18), (.34, .32, .26), mane), box((0, .6, .14), (.26, .08, .2), '#ffcf5c'),
            box((0, .45, .31), (.15, .15, .04), '#5a3a24'), box((0, .42, .335), (.06, .04, .02), '#3a2618'),
            *eyes(.035, .48, .336, w=.035, h=.035)]
    return {'body': body, 'parts': small_legs(quad_pos(.08, -.12, .12), .2, (.06, .2, .06), dark, (.07, .03, .08)) + [
        {'name': 'head', 'pivot': (0, .44, .16), 'boxes': head}]}

def pombo():
    g = '#8a8f99'
    body = [box((0, .18, 0), (.16, .16, .28), g), box((0, .27, .1), (.12, .08, .09), '#5f8a7a'),
            *[box((s * .09, .2, -.03), (.03, .12, .22), '#757a84') for s in (-1, 1)],
            *[box((s * .1, .2, z), (.03, .025, .05), '#3b3f47') for s in (-1, 1) for z in (-.04, -.1)],
            box((0, .17, -.21), (.1, .035, .14), '#5a606a')]
    head = [box((0, .31, .14), (.11, .11, .11), '#6a7a8a'), box((0, .3, .22), (.035, .03, .06), '#d9a441'),
            box((0, .316, .2), (.04, .015, .02), '#f2f0ea'), *eyes(.056, .32, .15, w=.03, h=.03, color='#e0782a', side_facing=True)]
    return {'body': body, 'parts': small_legs([(-.04, 0), (.04, 0)], .1, (.02, .1, .02), '#d97a6a', (.05, .016, .06)) + [
        {'name': 'head', 'pivot': (0, .28, .12), 'boxes': head}]}

def esquilo():
    c = '#9a5a2a'
    body = [box((0, .18, 0), (.16, .18, .28), c), box((0, .16, .07), (.12, .12, .12), '#e8cfa8'),
            box((0, .32, -.17), (.13, .3, .12), '#b0703f', (-.3, 0, 0)), box((0, .49, -.11), (.13, .14, .13), '#c27f49')]
    head = [box((0, .3, .15), (.14, .14, .14), '#a8673a'), box((0, .27, .22), (.08, .06, .02), '#e8cfa8'),
            box((0, .3, .227), (.03, .02, .01), '#2a1a12'), *[box((s * .05, .39, .13), (.03, .06, .03), c) for s in (-1, 1)],
            *eyes(.071, .32, .17, w=.035, h=.035, side_facing=True)]
    return {'body': body, 'parts': small_legs(quad_pos(.06, -.09, .09), .1, (.04, .1, .05), '#7a4520') + [
        {'name': 'head', 'pivot': (0, .27, .12), 'boxes': head}]}

def quati():
    c, belly, dark = '#8a5a34', '#b58a5c', '#3a2616'
    body = [box((0, .32, 0), (.3, .28, .6), c), box((0, .2, 0), (.24, .04, .46), belly),
            *[box((0, .42 + i * .06, -.38 - i * .08), (.1, .1, .12), dark if i % 2 else '#c49a6c') for i in range(6)]]
    head = [box((0, .4, .38), (.22, .2, .24), c), box((0, .36, .56), (.1, .1, .2), '#5a3a22'), box((0, .37, .665), (.08, .06, .02), '#1f1510'),
            *[box((s * .07, .43, .505), (.05, .03, .02), '#efe2c8') for s in (-1, 1)], *eyes(.065, .45, .505, w=.035, h=.035),
            *[box((s * .08, .52, .34), (.06, .06, .04), dark) for s in (-1, 1)]]
    return {'body': body, 'parts': small_legs(quad_pos(.1, -.2, .2), .2, (.08, .2, .08), dark) + [
        {'name': 'head', 'pivot': (0, .38, .28), 'boxes': head}]}

def turista():
    shirt, skin, shorts = '#4cc9f0', '#e8b48f', '#e9c46a'
    flowers = [(-.14, 1.2, '#ffd166'), (.12, 1.0, '#ef476f'), (-.06, .88, '#ffd166'), (.16, 1.28, '#ef476f')]
    body = [box((0, 1.05, 0), (.5, .6, .3), shirt), *[box((x, y, .152), (.08, .08, .01), c) for x, y, c in flowers],
            box((0, .72, 0), (.5, .18, .3), shorts), box((0, 1.31, 0), (.18, .06, .16), skin),
            box((0, 1.55, 0), (.38, .38, .36), skin), box((0, 1.69, -.02), (.4, .1, .36), '#7a5230'), box((0, 1.53, .19), (.07, .07, .04), '#e07a6a'),
            box((0, 1.6, .185), (.32, .07, .02), '#1b1b1b'), box((0, 1.46, .182), (.12, .02, .01), '#9a5a4a'),
            box((0, 1.77, 0), (.42, .1, .4), '#f1e3b5'), box((0, 1.73, 0), (.56, .03, .54), '#e6d29c'),
            box((0, 1.15, .175), (.16, .12, .08), '#222428'), box((0, 1.15, .22), (.07, .07, .02), '#5a6a7a'), box((0, 1.27, .155), (.3, .03, .01), '#222428'),
            *[box((s * .33, 1.12, 0), (.15, .3, .18), shirt) for s in (-1, 1)], *[box((s * .33, .86, 0), (.13, .24, .15), skin) for s in (-1, 1)]]
    legs = []
    for i, s in enumerate((-1, 1)):
        x = s * .12
        legs.append({'name': f'leg{i}', 'pivot': (x, .66, 0), 'boxes': [box((x, .38, 0), (.17, .5, .19), skin), box((x, .11, 0), (.18, .1, .2), '#f4f1e8'), box((x, .03, .03), (.2, .06, .26), '#7a4a2a')]})
    return {'body': body, 'parts': legs}

def salamandra():
    o = '#ff6a1a'
    body = [box((0, .08, 0), (.2, .1, .5), o), *[box((s * .06, .135, z), (.05, .012, .06), '#ffd23a') for s, z in ((-1, .1), (1, -.02), (-1, -.14), (1, .2))],
            box((0, .14, 0), (.05, .03, .4), '#ffb238'), box((0, .06, -.44), (.07, .06, .42), '#ff5a10', (0, .25, 0)), box((-.06, .055, -.66), (.05, .05, .1), '#ffd23a', (0, .25, 0))]
    head = [box((0, .1, .34), (.18, .1, .18), '#ffb238'), box((0, .07, .43), (.14, .03, .02), '#a83208'), *eyes(.07, .15, .37, w=.04, h=.04, color='#2a0a00', side_facing=True)]
    return {'body': body, 'parts': small_legs(quad_pos(.13, -.16, .16), .06, (.05, .06, .05), '#c03a0a', (.08, .02, .07)) + [
        {'name': 'head', 'pivot': (0, .1, .26), 'boxes': head}]}

def panda():
    w, k = '#f2f0ea', '#1f1f22'
    body = [box((0, .6, 0), (.62, .55, .85), w), box((0, .62, .12), (.64, .3, .4), k), box((0, .34, -.05), (.5, .04, .6), '#dedbd2')]
    head = [box((0, .88, .56), (.48, .42, .4), w), *[box((s * .2, 1.12, .52), (.13, .13, .07), k) for s in (-1, 1)],
            *[box((s * .11, .9, .762), (.13, .12, .02), k, (0, 0, s * .35)) for s in (-1, 1)],
            *[box((s * .11, .91, .775), (.045, .045, .01), w) for s in (-1, 1)], *[box((s * .11, .91, .782), (.022, .03, .01), k) for s in (-1, 1)],
            box((0, .8, .78), (.2, .13, .06), '#e8e4da'), box((0, .83, .815), (.08, .05, .02), k),
            box((.12, .79, .82), (.04, .04, .42), '#6cab4a', (0, 1.2, 0)), box((.32, .79, .74), (.08, .06, .03), '#4f8f36', (0, 1.2, 0))]
    return {'body': body, 'parts': small_legs(quad_pos(.2, -.28, .28), .36, (.18, .36, .2), k) + [
        {'name': 'head', 'pivot': (0, .84, .46), 'boxes': head}]}

def macaco():
    c = '#a39486'
    body = [box((0, .45, 0), (.36, .4, .42), c), box((0, .64, -.02), (.4, .08, .42), '#b8aa9c'), box((0, .4, -.24), (.06, .06, .08), '#8d7f72')]
    head = [box((0, .72, .2), (.3, .3, .28), c), box((0, .82, .19), (.32, .08, .3), '#b8aa9c'), box((0, .7, .345), (.2, .18, .02), '#e07a74'),
            *eyes(.05, .74, .358, w=.04, h=.03, color='#2a201c'), box((0, .66, .358), (.06, .02, .01), '#9a4a44'),
            *[box((s * .16, .72, .18), (.04, .08, .06), '#d9877f') for s in (-1, 1)]]
    return {'body': body, 'parts': small_legs(quad_pos(.12, -.14, .14), .26, (.1, .26, .1), '#8d7f72', (.11, .04, .13)) + [
        {'name': 'head', 'pivot': (0, .62, .14), 'boxes': head}]}

def bisao():
    c, mane, dark = '#5a3d28', '#3f2a1c', '#2a1d14'
    body = [box((0, .95, -.12), (.8, .7, 1.1), c), box((0, 1.3, .33), (.88, .52, .62), mane), box((0, 1.0, .5), (.84, .6, .3), mane),
            box((0, .62, .62), (.32, .32, .16), dark), box((0, 1.0, -.68), (.05, .32, .05), dark, (.2, 0, 0)), box((0, .82, -.72), (.09, .1, .09), mane)]
    head = [box((0, .95, .86), (.5, .5, .42), mane), box((0, 1.17, .82), (.54, .12, .38), '#4e3826'), box((0, .82, 1.08), (.34, .22, .06), dark),
            *[box((s * .06, .84, 1.112), (.05, .05, .01), '#120c08') for s in (-1, 1)],
            *[box((s * .29, 1.12, .82), (.14, .08, .08), '#e8e0cc') for s in (-1, 1)], *[box((s * .36, 1.22, .82), (.06, .14, .06), '#cfc6b0', (0, 0, -s * .5)) for s in (-1, 1)],
            *eyes(.251, 1.0, .98, w=.05, h=.05, side_facing=True)]
    return {'body': body, 'parts': small_legs(quad_pos(.26, -.4, .4), .6, (.18, .6, .2), mane, (.2, .07, .22)) + [
        {'name': 'head', 'pivot': (0, .98, .72), 'boxes': head}]}

def onca():
    coat, spot = '#d39a3a', '#2a211b'
    body = [box((0, .62, 0), (.5, .42, 1.05), coat), box((0, .42, 0), (.4, .04, .8), '#f1dcae')]
    for i in range(12):
        x, z = ((i % 3) - 1) * .16, -.42 + (i // 3) * .26 + (.06 if i % 2 else 0)
        body += [box((x, .835, z), (.1, .015, .1), spot), box((x, .84, z), (.05, .012, .05), '#b8782a')]
    body += [box((s * .255, .6 + (i % 2) * .1, -.34 + i * .2), (.012, .09, .09), spot) for s in (-1, 1) for i in range(4)]
    head = [box((0, .82, .66), (.42, .36, .38), coat), box((0, .74, .88), (.24, .16, .12), '#e8c48a'), box((0, .78, .945), (.08, .05, .02), '#5a3a2a'),
            *[box((s * .15, 1.02, .6), (.1, .1, .06), coat) for s in (-1, 1)], *[box((s * .15, 1.02, .632), (.06, .06, .01), spot) for s in (-1, 1)],
            *[box((s * .11, .88, .852), (.08, .05, .02), '#e6d23c') for s in (-1, 1)], *[box((s * .11, .88, .864), (.025, .05, .01), '#14100c') for s in (-1, 1)],
            *[box((s * .12, .96, .7), (.06, .015, .06), spot) for s in (-1, 1)]]
    tail = [box((0, .62, -.82), (.08, .08, .6), coat, (.5, 0, 0)), box((0, .45, -1.08), (.09, .09, .12), spot, (.5, 0, 0))]
    return {'body': body, 'parts': small_legs(quad_pos(.17, -.36, .36), .42, (.15, .42, .16), coat, (.17, .05, .2)) + [
        {'name': 'head', 'pivot': (0, .8, .5), 'boxes': head}, {'name': 'tail', 'pivot': (0, .75, -.52), 'boxes': tail}]}

def capivara():
    fur, dark = '#8a5f3c', '#6f4a2e'
    body = [box((0, .5, 0), (.62, .5, .95), fur), box((0, .76, -.05), (.56, .04, .8), dark), box((0, .26, 0), (.5, .03, .7), '#9c7050')]
    head = [box((0, .58, .62), (.42, .4, .42), fur), box((0, .52, .88), (.36, .3, .16), dark), *[box((s * .07, .56, .965), (.05, .03, .01), '#1d1714') for s in (-1, 1)],
            box((0, .42, .95), (.2, .02, .02), '#3a2618'), *eyes(.15, .68, .8, w=.05, h=.04), *[box((s * .15, .82, .52), (.08, .08, .06), '#5a3b24') for s in (-1, 1)]]
    return {'body': body, 'parts': small_legs(quad_pos(.2, -.32, .32), .26, (.13, .26, .14), dark, (.15, .04, .17)) + [
        {'name': 'head', 'pivot': (0, .55, .45), 'boxes': head}]}

def calango():
    c = '#8f8a4a'
    body = [box((0, .1, 0), (.22, .12, .5), c), *[box((0, .165, .12 - i * .14), (.12, .015, .08), '#c96b3a') for i in range(3)],
            *[box((s * .09, .15, z), (.03, .01, .03), '#5a5630') for s, z in ((-1, .05), (1, -.1), (-1, -.2), (1, .15))],
            box((0, .08, -.48), (.08, .07, .5), '#7d7840', (0, .2, 0)), box((-.05, .07, -.72), (.05, .05, .08), '#6a6538', (0, .2, 0))]
    head = [box((0, .12, .33), (.18, .1, .2), '#a6a058'), box((0, .085, .43), (.12, .015, .01), '#4a4628'), *eyes(.091, .16, .37, w=.035, h=.035, side_facing=True)]
    return {'body': body, 'parts': small_legs(quad_pos(.14, -.17, .17), .06, (.06, .06, .06), '#7d7840', (.09, .02, .07)) + [
        {'name': 'head', 'pivot': (0, .11, .24), 'boxes': head}]}

# ---------------------------------------------------------------- inimigos da noite
def humanoid(m, torso, skin, legs_color, boots, sleeve, hand, eye, eye_glow=True, extra_body=(), extra_arm=(), head_color=None, glow_body=False):
    """Base dos humanoides: corpo, cabeça, braço esquerdo fixo, braço direito (pivô 'arm') e duas pernas."""
    body = [box((0, 1.03 * m, 0), (.62 * m, .66 * m, .34 * m), torso, glow=glow_body),
            box((0, 1.58 * m, 0), (.45 * m, .42 * m, .42 * m), head_color or skin, glow=glow_body),
            box((-.43 * m, 1.0 * m, 0), (.2 * m, .6 * m, .23 * m), sleeve, glow=glow_body),
            box((-.43 * m, .66 * m, .02), (.17 * m, .14 * m, .19 * m), hand, glow=glow_body),
            *[box((s * .11 * m, 1.62 * m, .213 * m), (.07 * m, .055 * m, .02), eye, glow=eye_glow) for s in (-1, 1)],
            *extra_body]
    legs = []
    for i, s in enumerate((-1, 1)):
        x = s * .16 * m
        legs.append({'name': f'leg{i}', 'pivot': (x, .73 * m, 0), 'boxes': [
            box((x, .45 * m, 0), (.24 * m, .57 * m, .29 * m), legs_color, glow=glow_body),
            box((x, .07 * m, .06 * m), (.27 * m, .14 * m, .4 * m), boots)]})
    ax, ay = .43 * m, 1.28 * m
    arm = [box((ax, ay - .22 * m, 0), (.19 * m, .5 * m, .21 * m), sleeve, glow=glow_body),
           box((ax, ay - .52 * m, .03), (.17 * m, .18 * m, .2 * m), hand, glow=glow_body), *extra_arm]
    return {'body': body, 'parts': legs + [{'name': 'arm', 'pivot': (ax, ay, 0), 'boxes': arm}]}

def reaper():
    hood, cloak = '#8f1f28', '#b72f38'
    return humanoid(1, cloak, '#c48e6b', '#354951', '#382e2c', cloak, '#c48e6b', '#ffcf5a', extra_body=[
        box((0, 1.68, -.03), (.53, .5, .47), hood), box((0, 1.56, .2), (.36, .3, .05), '#2a1416'),
        box((0, 1.92, -.12), (.3, .12, .3), hood), box((0, .78, 0), (.64, .08, .36), '#5a1a20'),
        box((0, .66, -.17), (.6, .34, .06), hood), box((0, .73, .175), (.1, .1, .02), '#c9a24a')])

def cangaceiro():
    ghost, ghost2, ghost3, leather, gold = '#c8b48d', '#8a6a45', '#e9dcc0', '#6b4426', '#e4c06a'
    return humanoid(1, ghost, ghost3, ghost2, '#4a3220', ghost, ghost3, '#ffb347', head_color=ghost3, glow_body=True, extra_body=[
        box((0, 1.03, .175), (.06, .7, .02), '#5b3b22', (0, 0, .7)), box((0, 1.03, .177), (.06, .7, .02), '#5b3b22', (0, 0, -.7)),
        *[box((x, 1.03 + abs(x) * .3, .19), (.04, .07, .02), gold) for x in (-.18, -.09, .09, .18)],
        box((0, 1.81, 0), (.92, .06, .5), leather), box((0, 1.93, 0), (.5, .22, .42), leather), box((0, 2.02, .18), (.64, .14, .06), leather),
        *[box((x, 2.02, .215), (.06, .06, .02), gold) for x in (-.2, 0, .2)], box((0, 1.45, .215), (.2, .05, .02), '#3a2618')],
        extra_arm=[box((.43, -.27 + 1.28 - .3, .4), (.05, .08, .7), '#d9dee0'), box((.43, .72, .02), (.07, .1, .12), '#5b3b22')])

def terracota():
    skin, cloth, dark, plate = '#b98a62', '#9c6b46', '#6e4a30', '#7e5638'
    return humanoid(1, cloth, skin, dark, '#4a3220', cloth, skin, '#3a2a20', eye_glow=False, extra_body=[
        *[box((0, .86 + i * .16, 0), (.66, .06, .4), plate) for i in range(3)], *[box((x, .86 + i * .16, .205), (.04, .04, .02), '#c9a46a') for i in range(3) for x in (-.2, 0, .2)],
        box((0, 1.86, -.06), (.16, .14, .16), dark), box((0, 1.79, -.06), (.3, .04, .2), dark),
        box((0, 1.5, .215), (.2, .04, .02), dark), *[box((s * .12, 1.47, .215), (.04, .07, .02), dark) for s in (-1, 1)],
        *[box((s * .38, 1.3, 0), (.24, .1, .3), plate) for s in (-1, 1)]],
        extra_arm=[box((.46, 1.08, .18), (.05, 1.6, .05), '#6b4a2e'), box((.46, 1.94, .18), (.09, .22, .09), '#9aa3a8'), box((.46, 1.78, .18), (.12, .05, .12), '#b2292e')])

def oni():
    m, skin = 1.12, '#c8322d'
    return humanoid(m, '#2f3a4a', skin, '#1d1d1d', '#1d1d1d', skin, skin, '#ffe066', head_color=skin, extra_body=[
        *[box((s * .17 * m, 1.93 * m, 0), (.08, .24, .08), '#f2e6c8', (0, 0, -s * .3)) for s in (-1, 1)],
        box((0, 1.8 * m, -.04), (.52 * m, .12, .48 * m), '#1d1d1d'), box((0, 1.66 * m, -.22 * m), (.5 * m, .4, .06), '#1d1d1d'),
        box((0, 1.47 * m, .22 * m), (.3, .08, .04), '#f6f1e0'), *[box((s * .1, 1.43 * m, .225 * m), (.05, .07, .03), '#f6f1e0') for s in (-1, 1)],
        box((0, 1.69 * m, .214 * m), (.3, .04, .02), '#7a1414'),
        box((0, .78 * m, 0), (.66 * m, .22, .38 * m), '#e8b923'), *[box((x, .78 * m, .195 * m), (.05, .2, .02), '#1d1d1d') for x in (-.22, -.06, .1, .24)]],
        extra_arm=[box((.43 * m, .78, .32), (.12, .9, .12), '#4a3a2a'), *[box((.43 * m, .58 + i * .12, .32), (.16, .05, .16), '#9aa3a8') for i in range(4)]])

def pegrande():
    m, fur, face = 1.22, '#5a3e2b', '#8c6a50'
    return humanoid(m, '#4b3323', fur, fur, '#3a281b', fur, '#3a281b', '#2a1a10', eye_glow=False, extra_body=[
        box((0, 1.55 * m, .22 * m), (.32, .26, .03), face), box((0, 1.66 * m, .225 * m), (.36, .05, .04), '#3a281b'),
        box((0, 1.28 * m, 0), (.72 * m, .2, .42 * m), fur), *[box((s * .33 * m, 1.12 * m, .05), (.1, .3, .3), '#4b3323') for s in (-1, 1)],
        *[box((x, .9 * m, .2 * m), (.08, .14, .03), '#6b4a33') for x in (-.15, .05, .2)], box((0, 1.48 * m, .245 * m), (.12, .03, .02), '#2a1a10')],
        extra_arm=[box((.43 * m, 1.28 * m - .3, .1), (.08, .3, .08), '#6b4a33')])

def golem():
    m, rock, dark, magma = 1.3, '#3d3633', '#2c2624', '#ff9a2a'
    cracks = [(-.15, 1.2, .24, .08, .4), (.18, .95, .24, .3, .06), (0, 1.45, .24, .06, .3), (.1, 1.7, .27, .2, .05), (-.2, .8, .24, .05, .2)]
    return humanoid(m, dark, rock, dark, '#221d1b', rock, rock, '#ffdd55', head_color=rock, extra_body=[
        *[box((x * m, y * m, z * m), (w * m, h * m, .03), magma, glow=True) for x, y, z, w, h in cracks],
        *[box((s * .4 * m, 1.38 * m, 0), (.34 * m, .26 * m, .4 * m), rock) for s in (-1, 1)],
        *[box((s * .44 * m, 1.52 * m, 0), (.06 * m, .04, .3 * m), magma, (0, 0, 0), True) for s in (-1, 1)],
        box((0, 1.82 * m, 0), (.3 * m, .1, .3 * m), dark), box((0, 1.46 * m, .215 * m), (.24, .05, .02), magma, glow=True)],
        extra_arm=[box((.43 * m, .62 * m, .03), (.24 * m, .2 * m, .26 * m), rock), box((.43 * m, .9 * m, .14 * m), (.02, .2, .03), magma, glow=True)])

def et():
    skin, dark = '#6b4a33', '#5a3d2a'
    body = [box((0, .85, 0), (.42, .55, .26), skin), box((0, 1.33, .02), (.62, .5, .52), skin),
            *[box((x, 1.62, -.02), (.14, .16, .3), dark) for x in (-.2, 0, .2)],
            *[box((s * .15, 1.33, .28), (.17, .13, .04), '#d91f1f', glow=True) for s in (-1, 1)],
            *[box((s * .15, 1.35, .3), (.05, .04, .01), '#ffb0a0', glow=True) for s in (-1, 1)],
            box((0, 1.17, .285), (.12, .03, .02), '#3a2618'), box((0, .85, .135), (.3, .3, .02), '#7a5a40'),
            box((-.3, .78, 0), (.12, .62, .13), skin), box((-.3, .44, 0), (.16, .08, .16), dark)]
    legs = [{'name': f'leg{i}', 'pivot': (s * .12, .58, 0), 'boxes': [box((s * .12, .3, 0), (.14, .56, .16), skin), box((s * .12, .03, .04), (.18, .06, .24), dark)]} for i, s in enumerate((-1, 1))]
    arm = [box((.3, .78, 0), (.12, .62, .13), skin), box((.3, .45, 0), (.16, .08, .16), dark)]
    return {'body': body, 'parts': legs + [{'name': 'arm', 'pivot': (.3, 1.08, 0), 'boxes': arm}]}

def saci():
    skin, red = '#5a3a24', '#d9342b'
    body = [box((0, .85, 0), (.4, .45, .26), '#6b4630'), box((0, .66, 0), (.42, .12, .28), '#f4efe4'),
            box((0, 1.24, 0), (.36, .34, .32), skin), box((0, 1.45, 0), (.3, .14, .3), red), box((0, 1.56, -.04), (.18, .14, .18), red), box((0, 1.66, -.1), (.1, .1, .1), red),
            *[box((s * .09, 1.27, .165), (.06, .06, .03), '#fff3c0', glow=True) for s in (-1, 1)], box((0, 1.15, .165), (.14, .03, .02), '#f4efe4'),
            box((.08, 1.17, .22), (.04, .04, .18), '#3a2616'), box((.08, 1.2, .32), (.07, .07, .07), '#3a2616'), box((.08, 1.26, .32), (.04, .04, .04), '#ff7a1a', glow=True),
            box((-.27, .86, 0), (.12, .4, .14), skin)]
    legs = [{'name': 'leg0', 'pivot': (0, .62, 0), 'boxes': [box((0, .32, 0), (.14, .6, .16), skin), box((0, .03, .04), (.16, .06, .22), '#3a2616')]}]
    arm = [box((.27, .82, 0), (.12, .4, .14), skin)]
    return {'body': body, 'parts': legs + [{'name': 'arm', 'pivot': (.27, 1.02, 0), 'boxes': arm}]}

def ratao():
    fur, pink = '#6d6a66', '#d79a9a'
    body = [box((0, .38, 0), (.5, .42, .9), fur), box((0, .6, -.05), (.44, .06, .7), '#5a5753'), box((0, .2, 0), (.4, .04, .7), '#8a8682'),
            box((0, .3, -.78), (.06, .06, .7), pink, (-.25, 0, 0))]
    arm = [box((0, .44, .58), (.34, .3, .36), fur), box((0, .4, .8), (.12, .1, .12), pink), box((0, .43, .865), (.06, .04, .02), '#2a1a1a'),
           *[box((s * .14, .66, .52), (.12, .14, .04), pink) for s in (-1, 1)], *[box((s * .1, .5, .765), (.05, .05, .03), '#c0201a', glow=True) for s in (-1, 1)],
           *[box((s * .05, .33, .83), (.03, .06, .02), '#f2ead8') for s in (-1, 1)], *[box((s * .2, .38, .78), (.16, .01, .01), '#c9c4bd') for s in (-1, 1)]]
    return {'body': body, 'parts': small_legs(quad_pos(.2, -.3, .3), .2, (.1, .2, .1), '#4d4a46', (.12, .03, .14)) + [
        {'name': 'arm', 'pivot': (0, .4, .6), 'boxes': [{**b, 'c': b['c']} for b in arm]}]}

def boitata():
    body = []
    for i in range(9):
        w, h = .42 - i * .03, .36 - i * .025
        body.append(box((math.sin(i * .9) * .18, .3, -i * .38), (w, h, .42), '#ff7a1a' if i % 2 else '#ffb238', glow=True))
        body.append(box((math.sin(i * .9) * .18, .3 + h / 2 + .03, -i * .38), (w * .5, .06, .2), '#fff3a0', glow=True))
    body += [box((0, .36, .36), (.5, .38, .5), '#ff5a10', glow=True), box((0, .42, .66), (.36, .2, .16), '#ff5a10', glow=True),
             *[box((s * .14, .5, .62), (.09, .09, .05), '#ffffff', glow=True) for s in (-1, 1)], *[box((s * .14, .5, .645), (.04, .07, .02), '#3a0a00') for s in (-1, 1)],
             *[box((s * .22, .62, .3), (.06, .2, .06), '#fff3a0', (0, 0, -s * .4), True) for s in (-1, 1)], box((0, .27, .76), (.26, .03, .04), '#7a1a00')]
    return {'body': body, 'parts': [{'name': 'arm', 'pivot': (0, .36, .36), 'boxes': []}]}

def specter():
    body = [box((0, 1.03, 0), (.65, .77, .5), '#d6e9c0', glow=True), box((0, 1.58, 0), (.53, .41, .47), '#e6f1d4', glow=True),
            *[box((s * .15, 1.6, .245), (.13, .16, .025), '#305e40') for s in (-1, 1)], *[box((s * .15, 1.58, .264), (.055, .07, .04), '#82ff47', glow=True) for s in (-1, 1)],
            *[box((s * .43, 1.07, 0), (.21, .58, .23), '#c4dbb0', (0, 0, s * .35)) for s in (-1, 1)],
            box((0, 1.33, .27), (.19, .21, .03), '#406344'), *[box((i * .13, .58 - (i % 2) * .05, 0), (.13, .3 + (i % 2) * .1, .4), '#a5d980') for i in range(-2, 3)],
            box((0, .91, .28), (.36, .25, .11), '#7add35', glow=True), *[box((x, .3, z), (.08, .12, .08), '#7add35', glow=True) for x, z in ((-.2, .1), (.15, -.12), (0, .18))]]
    return {'body': body, 'parts': [{'name': 'arm', 'pivot': (0, 1.2, 0), 'boxes': []}]}

ENEMY_MODELS = {'reaper': reaper(), 'cangaceiro': cangaceiro(), 'terracota': terracota(), 'oni': oni(), 'pegrande': pegrande(), 'golem': golem(),
                'et': et(), 'saci': saci(), 'ratao': ratao(), 'boitata': boitata(), 'specter': specter()}

CREATURES = {
    **{f'dog{i}': dog(p, i) for i, p in enumerate(DOG_COATS)},
    **{f'cat{i}': cat(p, i) for i, p in enumerate(CAT_COATS)},
    'chicken': chicken(), 'rabbit': rabbit(), 'boar': boar(),
    'mico': mico(), 'pombo': pombo(), 'esquilo': esquilo(), 'quati': quati(), 'turista': turista(), 'salamandra': salamandra(),
    'panda': panda(), 'macaco': macaco(), 'bisao': bisao(), 'onca': onca(), 'capivara': capivara(), 'calango': calango(),
    **{f'enemy-{k}': v for k, v in ENEMY_MODELS.items()},
}

# ---------------------------------------------------------------- exportação
export = {}
for name, spec in CREATURES.items():
    export[name] = {'body': geometry(spec['body']), 'parts': [
        {'name': p['name'], 'pivot': [round(v, 4) for v in p['pivot']], **geometry(p['boxes'], p['pivot'])} for p in spec['parts']]}
OUT.write_text(json.dumps(export, separators=(',', ':')), encoding='utf8')

# ---------------------------------------------------------------- cena de prévia no Blender
scene = bpy.data.scenes.get('ValleyBlocks - Criaturas') or bpy.data.scenes.new('ValleyBlocks - Criaturas')
bpy.context.window.scene = scene
for ob in list(scene.collection.all_objects): bpy.data.objects.remove(ob, do_unlink=True)
for coll in list(scene.collection.children): bpy.data.collections.remove(coll)
materials = {}
def material(color):
    if color not in materials:
        mat = bpy.data.materials.new('VB ' + color); mat.use_nodes = True
        lin = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb(color)]
        shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        shader.inputs['Base Color'].default_value = (*lin, 1); shader.inputs['Roughness'].default_value = .85
        mat.diffuse_color = (*rgb(color), 1); materials[color] = mat
    return materials[color]

def blender_box(coll, name, b, offset, depth):
    data = bpy.data.meshes.new(name)
    verts = [(c.x + offset, -c.z + depth, c.y) for c in corners(b)]  # jogo (x, y, z) -> Blender (x, -z, y)
    data.from_pydata(verts, [], FACES); data.update(); data.materials.append(material(b['color']))
    ob = bpy.data.objects.new(name, data); coll.objects.link(ob)

PER_ROW = 11  # prévia em fileiras, olhando de 3/4
for i, (name, spec) in enumerate(CREATURES.items()):
    coll = bpy.data.collections.new(name); scene.collection.children.link(coll)
    row, col = divmod(i, PER_ROW); offset, depth = (col - (PER_ROW - 1) / 2) * 1.35, row * 2.8
    for b in spec['body']: blender_box(coll, name, b, offset, depth)
    for p in spec['parts']:
        for b in p['boxes']: blender_box(coll, f"{name} {p['name']}", b, offset, depth)

ground = bpy.data.meshes.new('Chao'); ground.from_pydata([(-10, -3, 0), (10, -3, 0), (10, 10, 0), (-10, 10, 0)], [], [(0, 1, 2, 3)]); ground.update()
ground.materials.append(material('#8fb35a')); g = bpy.data.objects.new('Chao', ground); scene.collection.objects.link(g)
cam = bpy.data.objects.new('Camera', bpy.data.cameras.new('Camera')); scene.collection.objects.link(cam)
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 17.5
cam.location = (-5, -12, 7.5); cam.rotation_euler = (math.radians(62), 0, math.radians(-22)); scene.camera = cam
sun = bpy.data.objects.new('Sol', bpy.data.lights.new('Sol', 'SUN')); sun.data.energy = 3.5; sun.rotation_euler = (.6, .3, .4); scene.collection.objects.link(sun)
scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
scene.render.resolution_x, scene.render.resolution_y = 1800, 1100
scene.world = scene.world or bpy.data.worlds.new('Mundo'); scene.world.color = (.6, .75, .88)
scene.render.filepath = str(ROOT / 'test-results' / 'creatures-preview.png')
bpy.ops.render.render(write_still=True)
print({k: len(v['body']['positions']) // 9 + sum(len(p['positions']) // 9 for p in v['parts']) for k, v in export.items()}, '->', OUT)
