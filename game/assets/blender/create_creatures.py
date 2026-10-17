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

def box(center, size, color, rot=(0, 0, 0)):
    return {'c': center, 's': size, 'color': color, 'r': rot}

def corners(b):
    m = Euler(b['r'], 'XYZ').to_matrix()
    half = [v / 2 for v in b['s']]
    return [Vector(b['c']) + m @ Vector((sx * half[0], sy * half[1], sz * half[2])) for sx, sy, sz in CORNERS]

def geometry(boxes, pivot=(0, 0, 0)):
    """Triângulos com normal por face e cor por vértice, relativos ao pivô."""
    p0 = Vector(pivot); positions, normals, colors = [], [], []
    for b in boxes:
        v = [c - p0 for c in corners(b)]; col = rgb(b['color'])
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

CREATURES = {
    **{f'dog{i}': dog(p, i) for i, p in enumerate(DOG_COATS)},
    **{f'cat{i}': cat(p, i) for i, p in enumerate(CAT_COATS)},
    'chicken': chicken(), 'rabbit': rabbit(), 'boar': boar(),
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

def blender_box(coll, name, b, offset):
    data = bpy.data.meshes.new(name)
    verts = [(c.x + offset, -c.z, c.y) for c in corners(b)]  # jogo (x, y, z) -> Blender (x, -z, y)
    data.from_pydata(verts, [], FACES); data.update(); data.materials.append(material(b['color']))
    ob = bpy.data.objects.new(name, data); coll.objects.link(ob)

for i, (name, spec) in enumerate(CREATURES.items()):
    coll = bpy.data.collections.new(name); scene.collection.children.link(coll)
    offset = (i - (len(CREATURES) - 1) / 2) * 1.25
    for b in spec['body']: blender_box(coll, name, b, offset)
    for p in spec['parts']:
        for b in p['boxes']: blender_box(coll, f"{name} {p['name']}", b, offset)

ground = bpy.data.meshes.new('Chao'); ground.from_pydata([(-8, -3, 0), (8, -3, 0), (8, 3, 0), (-8, 3, 0)], [], [(0, 1, 2, 3)]); ground.update()
ground.materials.append(material('#8fb35a')); g = bpy.data.objects.new('Chao', ground); scene.collection.objects.link(g)
cam = bpy.data.objects.new('Camera', bpy.data.cameras.new('Camera')); scene.collection.objects.link(cam)
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 12.2
cam.location = (0, -9, 4.2); cam.rotation_euler = (math.radians(70), 0, 0); scene.camera = cam
sun = bpy.data.objects.new('Sol', bpy.data.lights.new('Sol', 'SUN')); sun.data.energy = 3.5; sun.rotation_euler = (.6, .3, .4); scene.collection.objects.link(sun)
scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
scene.render.resolution_x, scene.render.resolution_y = 1600, 520
scene.world = scene.world or bpy.data.worlds.new('Mundo'); scene.world.color = (.6, .75, .88)
scene.render.filepath = str(ROOT / 'test-results' / 'creatures-preview.png')
bpy.ops.render.render(write_still=True)
print({k: len(v['body']['positions']) // 9 + sum(len(p['positions']) // 9 for p in v['parts']) for k, v in export.items()}, '->', OUT)
