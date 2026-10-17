"""Ossada de gado do Sertão (ValleyBlocks).

Rodar no Blender (aba Scripting, ou pelo addon blender-mcp):
  blender --background --python assets/blender/create_skeleton.py

Boi caído de lado no chão rachado: crânio com chifres, vértebras, costelas abertas
(algumas quebradas), bacia, rabo e ossos das pernas espalhados. Só caixas, como o resto
do jogo. Comprimento ~2,4; altura ~0,55. A base fica em z = 0 (o chão).
Blender: X direita, -Y frente (crânio), Z cima. Exportado como (x, z, -y): o crânio vira +Z.

Saída (src/assets/skeleton-models.json): { body: { positions, normals, colors } }
"""
import bpy, json, math
from pathlib import Path
from mathutils import Matrix, Euler, Vector

try:
    ROOT = Path(__file__).resolve().parents[2]
except NameError:  # executado pelo socket do addon, sem __file__
    ROOT = Path(r'D:\projetos\Games\vale-dos-blocos\game')
OUT = ROOT / 'src' / 'assets' / 'skeleton-models.json'

scene = bpy.data.scenes.get('ValleyBlocks - Ossada') or bpy.data.scenes.new('ValleyBlocks - Ossada')
bpy.context.window.scene = scene
for ob in list(scene.collection.all_objects): bpy.data.objects.remove(ob, do_unlink=True)
collection = bpy.data.collections.new('Ossada')
scene.collection.children.link(collection)
parts = []

def material(name, color):
    mat = bpy.data.materials.get('VB ' + name) or bpy.data.materials.new('VB ' + name)
    rgb = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    lin = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]
    mat.use_nodes = True
    shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*lin, 1)
    shader.inputs['Roughness'].default_value = .9
    mat.diffuse_color = (*rgb, 1)  # cor sRGB exportada direto para o vertex color
    return mat

def box(name, center, size, mat, rot=(0, 0, 0)):
    a, b, c = [v / 2 for v in size]
    verts = [(sx * a, sy * b, sz * c) for sx, sy, sz in [(-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1), (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)]]
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]); data.update()
    ob = bpy.data.objects.new(name, data); collection.objects.link(ob); data.materials.append(mat)
    ob.location = center; ob.rotation_euler = Euler(rot)
    parts.append(ob)
    return ob

bone = material('Osso', '#ece2c6'); bone_shade = material('Osso sombra', '#cdbf9b'); bone_old = material('Osso velho', '#b9a77f')
hole = material('Cavidade', '#3b2f25'); horn = material('Chifre', '#d8c49a'); horn_tip = material('Ponta do chifre', '#5e4a36')

# Crânio (frente = -Y), apoiado no chão e um pouco virado
SK = (0.08, -1.12, 0.17)
def sk(dx, dy, dz): return (SK[0] + dx, SK[1] + dy, SK[2] + dz)
box('Cranio', sk(0, 0, 0), (.32, .34, .26), bone, (0, 0, .12))
box('Focinho', sk(.02, -.3, -.04), (.22, .34, .16), bone, (-.12, 0, .12))
box('Ponta do focinho', sk(.03, -.48, -.07), (.18, .08, .12), bone_shade, (-.12, 0, .12))
box('Narina', sk(.03, -.52, -.04), (.1, .02, .05), hole, (-.12, 0, .12))
for s in (-1, 1):
    box('Orbita', sk(s * .155, -.08, .05), (.03, .1, .1), hole, (0, 0, .12))
    box('Maca do rosto', sk(s * .15, -.18, -.03), (.04, .14, .08), bone_shade, (0, 0, .12))
    # Chifres: saem para o lado, curvam para cima e para a frente
    box('Chifre base', sk(s * .3, .06, .12), (.3, .1, .1), horn, (0, -s * .2, 0))
    box('Chifre meio', sk(s * .5, .03, .25), (.09, .09, .24), horn, (0, s * .3, 0))
    box('Chifre ponta', sk(s * .55, -.01, .42), (.07, .07, .14), horn_tip, (.2, s * .45, 0))
box('Topo do cranio', sk(0, .1, .13), (.3, .12, .04), bone_shade, (0, 0, .12))
# Mandíbula caída ao lado
box('Mandibula', (.32, -1.28, .04), (.06, .46, .08), bone_old, (0, 0, .35))
box('Mandibula dentes', (.29, -1.36, .09), (.04, .2, .03), bone_shade, (0, 0, .35))

# Pescoço: vértebras que descem até o crânio
for i, (y, z) in enumerate([(-.86, .2), (-.72, .26), (-.58, .31)]):
    box('Vertebra pescoco', (0, y, z), (.14, .11, .12), bone if i % 2 else bone_shade)

# Coluna: vértebras com espinhos dorsais
spine = [(-.44 + i * .12) for i in range(11)]
for i, y in enumerate(spine):
    z = .36 - (.02 if i in (0, 10) else 0)
    box('Vertebra', (0, y, z), (.16, .1, .12), bone if i % 2 else bone_shade)
    if i < 9: box('Espinho', (0, y, z + .1), (.04, .05, .1 - .006 * i), bone_old)

# Costelas: arcos abertos dos dois lados; umas quebradas, outras faltando
for i in range(8):
    y = -.38 + i * .1
    for s in (-1, 1):
        if (i, s) in [(2, 1), (6, -1)]: continue  # faltando
        broken = (i, s) in [(4, 1), (0, -1), (7, 1)]
        m = bone if (i + (s > 0)) % 2 else bone_shade
        box('Costela alta', (s * .17, y, .33), (.14, .045, .05), m, (0, -s * .45, 0))
        box('Costela meio', (s * .28, y, .2), (.05, .045, .2), m, (0, -s * .18, 0))
        if not broken: box('Costela baixa', (s * .3, y, .06), (.05, .045, .12), bone_old, (0, s * .2, 0))
# Esterno caído no chão
box('Esterno', (.1, .0, .025), (.1, .6, .05), bone_old, (0, 0, .08))

# Bacia e rabo
box('Bacia', (0, .82, .3), (.42, .2, .16), bone)
for s in (-1, 1):
    box('Ilio', (s * .2, .78, .38), (.1, .16, .1), bone_shade, (0, -s * .3, 0))
    box('Isquio', (s * .14, .95, .2), (.08, .12, .14), bone_old)
for i in range(6):
    box('Rabo', (0, 1.0 + i * .085, .3 - i * .045), (.07 - i * .007, .07, .06 - i * .005), bone if i % 2 else bone_shade)

# Pernas: ossos longos espalhados no chão, cada um com as duas pontas
legs = [((-.42, -.3, .04), .5, .9), ((.46, -.2, .04), .55, -.4), ((-.5, .6, .04), .6, -.6), ((.5, .7, .04), .48, .5), ((-.15, 1.3, .035), .4, 1.4)]
for (x, y, z), length, yaw in legs:
    box('Osso da perna', (x, y, z), (.07, length, .07), bone, (0, 0, yaw))
    for e in (-1, 1):
        dx, dy = -math.sin(yaw) * e * length / 2, math.cos(yaw) * e * length / 2
        box('Junta', (x + dx, y + dy, z + .01), (.11, .08, .09), bone_shade, (0, 0, yaw))
# Escápula solta
box('Escapula', (-.36, -.52, .02), (.24, .18, .04), bone_old, (0, 0, .5))

bpy.context.view_layer.update()
positions, normals, colors = [], [], []
for ob in parts:
    data = ob.data; data.calc_loop_triangles()
    color = [round(c, 4) for c in data.materials[0].diffuse_color[:3]]
    world, rot = ob.matrix_world, ob.matrix_world.to_3x3()
    for tri in data.loop_triangles:
        n = (rot @ tri.normal).normalized()
        for i in tri.vertices:
            v = world @ data.vertices[i].co
            positions.extend(round(k, 4) for k in (v.x, v.z, -v.y))
            normals.extend(round(k, 4) for k in (n.x, n.z, -n.y))
            colors.extend(color)
OUT.write_text(json.dumps({'body': {'positions': positions, 'normals': normals, 'colors': colors}}, separators=(',', ':')), encoding='utf8')

# Pré-visualização: chão de terra rachada, câmera e sol
ground = box('Chao', (0, 0, -.05), (4, 4, .1), material('Terra seca', '#c58a55'))
cam = bpy.data.objects.new('Camera', bpy.data.cameras.new('Camera')); collection.objects.link(cam)
cam.location = (3.1, -3.3, 2.5); cam.rotation_euler = (1.0, 0, .76); scene.camera = cam
sun = bpy.data.objects.new('Sol', bpy.data.lights.new('Sol', 'SUN')); sun.data.energy = 4; sun.rotation_euler = (.7, .2, .9); collection.objects.link(sun)
scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
scene.render.resolution_x, scene.render.resolution_y = 800, 560
scene.world = scene.world or bpy.data.worlds.new('Mundo'); scene.world.color = (.55, .7, .85)
scene.render.filepath = str(ROOT / 'test-results' / 'skeleton-preview.png')
bpy.ops.render.render(write_still=True)
print(len(positions) // 9, 'tri ->', OUT)
