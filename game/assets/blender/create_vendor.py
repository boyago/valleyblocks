"""Vendedor de rua da Tríplice Fronteira (ValleyBlocks).

Rodar no Blender (aba Scripting, ou pelo addon blender-mcp):
  blender --background --python assets/blender/create_vendor.py

Estilo voxel do jogo: só caixas, cores chapadas. Altura total ~1,85.
Blender: X direita, -Y frente, Z cima. Exportado para Three.js como (x, z, -y): a frente
vira +Z, a mesma convenção dos bichos do jogo (o yaw aponta +Z para onde ele anda ou olha).

Grupos exportados (src/assets/vendor-models.json):
  body   partes fixas (cabeça, chapéu, braços, avental, pochete, bandeja)
  shirt  camisa em branco; o jogo tinge com a cor de cada vendedor
  leg    uma perna com o topo em z = 0 (o quadril), para balançar ao andar
"""
import bpy, json, math
from pathlib import Path

try:
    ROOT = Path(__file__).resolve().parents[2]
except NameError:  # executado pelo socket do addon, sem __file__
    ROOT = Path(r'D:\projetos\Games\vale-dos-blocos\game')
OUT = ROOT / 'src' / 'assets' / 'vendor-models.json'

scene = bpy.data.scenes.get('ValleyBlocks - Vendedor') or bpy.data.scenes.new('ValleyBlocks - Vendedor')
bpy.context.window.scene = scene
for ob in list(scene.collection.all_objects): bpy.data.objects.remove(ob, do_unlink=True)
collection = bpy.data.collections.new('Vendedor')
scene.collection.children.link(collection)
groups = {}

def material(name, color):
    mat = bpy.data.materials.get('VB ' + name) or bpy.data.materials.new('VB ' + name)
    rgb = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    lin = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]
    mat.use_nodes = True
    shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*lin, 1)
    shader.inputs['Roughness'].default_value = .8
    mat.diffuse_color = (*rgb, 1)  # cor sRGB exportada direto para o vertex color
    return mat

def box(name, center, size, mat, kind):
    x, y, z = center; a, b, c = [v / 2 for v in size]
    verts = [(x + sx * a, y + sy * b, z + sz * c) for sx, sy, sz in [(-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1), (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)]]
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]); data.update()
    ob = bpy.data.objects.new(name, data); collection.objects.link(ob); data.materials.append(mat)
    groups.setdefault(kind, []).append(ob)
    return ob

skin = material('Pele', '#c48e6b'); skin_dark = material('Pele sombra', '#a97556')
hair = material('Cabelo', '#2b1d16'); straw = material('Palha', '#e2c47a'); straw_dark = material('Palha escura', '#b8964f')
band = material('Fita do chapeu', '#c0392b'); white = material('Camisa', '#ffffff')
apron = material('Avental', '#2f5d50'); apron_pocket = material('Bolso do avental', '#254a40')
pants = material('Calca', '#3a3f4b'); shoe = material('Tenis', '#efe9dc'); sole = material('Sola', '#5b4636')
pouch = material('Pochete', '#1f2a36'); zip_ = material('Ziper', '#d4b25a')
tray = material('Bandeja', '#a46f3c'); eye = material('Olhos', '#1b1b1b'); mustache = material('Bigode', '#2b1d16')
goods = [material('Mercadoria amarela', '#ffd166'), material('Mercadoria verde', '#06d6a0'), material('Mercadoria rosa', '#ef476f'), material('Mercadoria azul', '#4cc9f0')]

F = -1  # frente = -Y

# Cabeça (topo ~1,74) com rosto
box('Cabeca', (0, 0, 1.53), (.38, .36, .38), skin, 'body')
box('Cabelo nuca', (0, .17, 1.58), (.4, .04, .3), hair, 'body')
box('Costeleta E', (-.19, 0, 1.56), (.03, .3, .2), hair, 'body')
box('Costeleta D', (.19, 0, 1.56), (.03, .3, .2), hair, 'body')
# Rosto: 'face' é o de sempre; 'face@novo' é o do visual novo (estilo das artes):
# olhos grandes com dois brilhos, sobrancelha grossa, bochecha corada e sorriso.
cuff = material('Punho', '#d9d2c2'); shine = material('Brilho do olho', '#fffbe8'); blush = material('Bochecha', '#f0a08a'); smile = material('Sorriso', '#7a3b2e')
for s in (-1, 1):
    box('Olho', (s * .08, F * .182, 1.57), (.06, .01, .06), eye, 'face')
    box('Sobrancelha', (s * .08, F * .182, 1.62), (.09, .012, .02), hair, 'face')
    box('Olho grande', (s * .085, F * .183, 1.565), (.085, .012, .1), eye, 'face@novo')
    box('Brilho grande', (s * .085 - s * .016, F * .19, 1.585), (.034, .01, .038), shine, 'face@novo')
    box('Brilho pequeno', (s * .085 + s * .02, F * .19, 1.535), (.016, .01, .016), shine, 'face@novo')
    box('Sobrancelha grossa', (s * .085, F * .183, 1.635), (.1, .014, .025), hair, 'face@novo')
    box('Bochecha', (s * .13, F * .183, 1.49), (.06, .01, .035), blush, 'face@novo')
box('Nariz', (0, F * .2, 1.52), (.06, .04, .07), skin_dark, 'face')
box('Bigode', (0, F * .19, 1.47), (.2, .03, .04), mustache, 'face')
box('Nariz', (0, F * .2, 1.51), (.05, .04, .05), skin_dark, 'face@novo')
box('Bigode', (0, F * .19, 1.465), (.2, .03, .035), mustache, 'face@novo')
box('Sorriso', (0, F * .183, 1.425), (.1, .01, .02), smile, 'face@novo')
box('Pescoco', (0, 0, 1.31), (.18, .16, .08), skin_dark, 'body')

# Chapéu de palha de aba larga com fita vermelha
box('Aba', (0, 0, 1.73), (.66, .66, .03), straw, 'body')
box('Copa', (0, 0, 1.81), (.38, .38, .14), straw, 'body')
box('Topo da copa', (0, 0, 1.885), (.3, .3, .02), straw_dark, 'body')
box('Fita', (0, 0, 1.765), (.395, .395, .04), band, 'body')

# Camisa (tingida no jogo) e braços
box('Tronco', (0, 0, 1.0), (.5, .3, .6), white, 'shirt')
for s in (-1, 1):
    box('Manga', (s * .33, 0, 1.17), (.16, .2, .26), white, 'shirt')
    box('Braco', (s * .33, F * .04, .95), (.13, .15, .24), skin, 'body')
    box('Mao', (s * .33, F * .08, .8), (.12, .12, .1), skin_dark, 'face')
    # Visual novo: punho da manga, mão maior e polegar separado por dentro, como nas artes
    box('Punho', (s * .33, F * .04, .86), (.17, .19, .04), cuff, 'face@novo')
    box('Mao grande', (s * .33, F * .08, .78), (.14, .14, .12), skin_dark, 'face@novo')
    box('Polegar', (s * .33 - s * .085, F * .13, .8), (.05, .06, .08), skin_dark, 'face@novo')

# Avental com bolso e alças
box('Avental', (0, F * .158, .92), (.44, .02, .62), apron, 'body')
box('Bolso', (0, F * .17, .82), (.26, .015, .14), apron_pocket, 'body')
for s in (-1, 1): box('Alca', (s * .15, F * .156, 1.24), (.05, .02, .1), apron, 'body')

# Pochete atravessada na cintura
box('Pochete', (.14, F * .2, .74), (.2, .07, .1), pouch, 'body')
box('Ziper', (.14, F * .236, .76), (.16, .005, .015), zip_, 'body')
box('Cinto', (0, 0, .74), (.52, .32, .04), pouch, 'body')

# Bandeja de mercadorias segura pelas mãos
box('Bandeja', (0, F * .36, .82), (.6, .3, .04), tray, 'body')
for s in (-1, 1): box('Borda', (s * .29, F * .36, .86), (.03, .3, .06), tray, 'body')
for i, m in enumerate(goods):
    box('Mercadoria', (-.2 + i * .13, F * (.3 + .1 * (i % 2)), .89), (.1, .1, .1 + .03 * (i % 3)), m, 'body')

# Perna (topo no quadril, z = 0)
box('Perna', (0, 0, -.33), (.18, .2, .66), pants, 'leg')
box('Tenis', (0, F * .03, -.69), (.2, .26, .08), shoe, 'leg')
box('Sola', (0, F * .03, -.735), (.21, .27, .02), sole, 'leg')

bpy.context.view_layer.update()
export = {}
for kind, objects in groups.items():
    positions, normals, colors = [], [], []
    for k, ob in enumerate(objects):
        grow = min(.0005 * k, .005)  # detalhes 0,5 mm por cima: faces coplanares não piscam
        data = ob.data; data.calc_loop_triangles()
        color = [round(c, 4) for c in data.materials[0].diffuse_color[:3]]
        for tri in data.loop_triangles:
            n = tri.normal
            for i in tri.vertices:
                v = ob.matrix_world @ data.vertices[i].co.__class__([c + math.copysign(grow, c) for c in data.vertices[i].co])
                positions.extend(round(k, 4) for k in (v.x, v.z, -v.y))
                normals.extend(round(k, 4) for k in (n.x, n.z, -n.y))
                colors.extend(color)
    export[kind] = {'positions': positions, 'normals': normals, 'colors': colors}
OUT.write_text(json.dumps(export, separators=(',', ':')), encoding='utf8')

# Pré-visualização: duas pernas posicionadas, câmera e luz para um render rápido.
for s in (-1, 1):
    for ob in groups['leg']:
        twin = ob.copy(); twin.data = ob.data; collection.objects.link(twin); twin.location = (s * .12, 0, .75)
for ob in groups['leg']: ob.hide_render = True
cam = bpy.data.objects.new('Camera', bpy.data.cameras.new('Camera')); collection.objects.link(cam)
cam.location = (1.9, -3.0, 1.55); cam.rotation_euler = (1.45, 0, .56); scene.camera = cam
sun = bpy.data.objects.new('Sol', bpy.data.lights.new('Sol', 'SUN')); sun.data.energy = 3.5; sun.rotation_euler = (.8, .2, .6); collection.objects.link(sun)
scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
scene.render.resolution_x, scene.render.resolution_y = 640, 800
scene.world = scene.world or bpy.data.worlds.new('Mundo'); scene.world.color = (.55, .7, .78)
scene.render.filepath = str(ROOT / 'test-results' / 'vendor-preview.png')
print({k: len(v['positions']) // 9 for k, v in export.items()}, 'tri ->', OUT)
