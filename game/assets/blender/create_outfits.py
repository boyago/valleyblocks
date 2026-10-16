"""Acessórios originais do pacote de aparências "Expedição" (LABSGames).

Executar em Blender sem interface:
  blender --background --python assets/blender/create_outfits.py

Coordenadas no espaço local da cabeça do avatar (centro da cabeça = origem).
Blender: X direita, Y frente, Z cima. Exportado para Three.js (x, z, -y),
onde o avatar olha para -Z. Cabeça: 0,39 x 0,40 x 0,35; topo em z = 0,20.
"""
import bpy, math, json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'src' / 'assets' / 'outfit-models.json'
scene = bpy.data.scenes.new('LABSGames - Aparencias Expedicao')
bpy.context.window.scene = scene
collection = bpy.data.collections.new('LABSGames - Acessorios de cabeca')
scene.collection.children.link(collection)
groups = {}

def material(name, color, metallic=0):
    mat = bpy.data.materials.new('LABS ' + name)
    mat.use_nodes = True
    rgb = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    rgb = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]
    shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*rgb, 1)
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Roughness'].default_value = .65
    mat.diffuse_color = (*rgb, 1)
    return mat

def mesh(name, verts, faces, mat, kind):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces); data.update()
    ob = bpy.data.objects.new(name, data); collection.objects.link(ob)
    data.materials.append(mat)
    groups.setdefault(kind, []).append(ob)
    return ob

def box(name, center, size, mat, kind):
    x, y, z = center; a, b, c = [v / 2 for v in size]
    verts = [(x + sx * a, y + sy * b, z + sz * c) for sx, sy, sz in [(-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1), (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)]]
    return mesh(name, verts, [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], mat, kind)

def cylinder(name, center, r_bottom, r_top, height, mat, kind, n=12, open_front=0.0, cap_top=True, cap_bottom=True):
    """Lateral faces optionally omitted within `open_front` radians around +Y (the face)."""
    x, y, z = center; verts = []
    for radius, zz in [(r_bottom, z - height / 2), (r_top, z + height / 2)]:
        verts.extend((x + radius * math.cos(i * 2 * math.pi / n), y + radius * math.sin(i * 2 * math.pi / n), zz) for i in range(n))
    faces = []
    for i in range(n):
        j = (i + 1) % n
        mid = ((i + .5) * 2 * math.pi / n)
        if open_front and abs(((mid - math.pi / 2 + math.pi) % (2 * math.pi)) - math.pi) < open_front / 2: continue
        faces.append((i, j, n + j, n + i))
    if cap_bottom: faces.append(tuple(reversed(range(n))))
    if cap_top: faces.append(tuple(range(n, 2 * n)))
    return mesh(name, verts, faces, mat, kind)

# --- Capitão do Vale: boné de marinha com pala preta e emblema dourado ---
navy = material('Azul marinho', '#1f2f5c'); white = material('Branco do bone', '#f1efe6')
black = material('Pala preta', '#1b1b1f', .2); gold = material('Emblema dourado', '#d9a63a', .8)
cylinder('Copa do bone', (0, 0, .25), .23, .21, .11, navy, 'captain')
cylinder('Faixa branca', (0, 0, .19), .235, .235, .035, white, 'captain', cap_top=False, cap_bottom=False)
box('Pala', (0, .255, .20), (.3, .17, .025), black, 'captain')
box('Emblema', (0, .205, .27), (.07, .03, .06), gold, 'captain')
box('Ancora do emblema', (0, .222, .27), (.025, .012, .04), navy, 'captain')

# --- Minerador: capacete amarelo com aba, lanterna frontal e tira ---
yellow = material('Amarelo seguranca', '#f2c230'); lamp = material('Lanterna', '#3a3f45', .6)
glass = material('Vidro da lanterna', '#fff6c2', .3); strap = material('Tira do capacete', '#2f2a26')
cylinder('Cupula', (0, 0, .25), .235, .17, .15, yellow, 'hardhat')
cylinder('Topo da cupula', (0, 0, .33), .17, .11, .04, yellow, 'hardhat')
cylinder('Aba', (0, 0, .175), .27, .27, .025, yellow, 'hardhat')
box('Crista', (0, 0, .35), (.05, .3, .025), yellow, 'hardhat')
box('Lanterna', (0, .235, .26), (.11, .08, .09), lamp, 'hardhat')
box('Vidro', (0, .278, .26), (.08, .01, .07), glass, 'hardhat')
box('Tira', (0, .0, .16), (.42, .40, .02), strap, 'hardhat')

# --- Guarda-florestal: chapéu de aba larga com fita ---
felt = material('Feltro caqui', '#8a6a3f'); band = material('Fita do chapeu', '#3f2d1c'); badge = material('Insignia', '#c8a24b', .7)
cylinder('Aba larga', (0, 0, .18), .36, .35, .03, felt, 'ranger')
cylinder('Copa do chapeu', (0, 0, .28), .21, .17, .17, felt, 'ranger')
cylinder('Fita', (0, 0, .215), .215, .215, .04, band, 'ranger', cap_top=False, cap_bottom=False)
box('Vinco', (0, 0, .365), (.06, .28, .02), felt, 'ranger')
box('Insignia', (0, .212, .215), (.05, .012, .035), badge, 'ranger')

# --- Astronauta de bloco: capacete branco aberto na frente, com visor dourado ---
shell = material('Casco do capacete', '#eef0f2', .1); visor = material('Visor dourado', '#e0b24a', .9); seal = material('Anel do pescoco', '#8b949c', .6)
cylinder('Casco', (0, 0, .03), .275, .275, .46, shell, 'astronaut', n=16, open_front=math.radians(130), cap_bottom=False)
cylinder('Calota', (0, 0, .29), .275, .16, .08, shell, 'astronaut', n=16, cap_bottom=False)
cylinder('Anel do pescoco', (0, 0, -.21), .285, .285, .06, seal, 'astronaut', n=16)
box('Visor', (0, .24, .13), (.36, .03, .06), visor, 'astronaut')
for side in (-1, 1):
    box('Haste do visor', (side * .19, .21, .02), (.03, .07, .25), visor, 'astronaut')
box('Antena', (.2, -.1, .36), (.03, .03, .12), seal, 'astronaut')
box('Luz da antena', (.2, -.1, .43), (.04, .04, .03), visor, 'astronaut')

bpy.context.view_layer.update()
export = {}
for kind, objects in groups.items():
    positions = []; normals = []; colors = []
    for ob in objects:
        data = ob.data
        if hasattr(data, 'calc_loop_triangles'): data.calc_loop_triangles()
        normal_matrix = ob.matrix_world.to_3x3().inverted().transposed()
        color = list(data.materials[0].diffuse_color[:3])
        for tri in data.loop_triangles:
            normal = (normal_matrix @ tri.normal).normalized()
            for index in tri.vertices:
                v = ob.matrix_world @ data.vertices[index].co
                positions.extend(round(k, 5) for k in (v.x, v.z, -v.y))
                normals.extend(round(k, 5) for k in (normal.x, normal.z, -normal.y))
                colors.extend(round(k, 4) for k in color)
    export[kind] = {'positions': positions, 'normals': normals, 'colors': colors}
    print(kind, 'triangles', len(positions) // 9)
OUT.write_text(json.dumps(export, separators=(',', ':')), encoding='utf8')
print('exported', OUT)
