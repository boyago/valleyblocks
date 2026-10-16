"""Original LABSGames models. Run in Blender; export baked meshes for Three.js."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
scene = bpy.data.scenes.new('LABSGames - Churrasqueira e balde')
bpy.context.window.scene = scene
collection = bpy.data.collections.new('LABSGames - Utensilios originais')
scene.collection.children.link(collection)
groups = {'grill': [], 'bucket': []}

def material(name, color, metallic=0):
    mat = bpy.data.materials.new('LABS '+name)
    mat.use_nodes = True
    rgb = [int(color[i:i+2],16)/255 for i in (1,3,5)]
    rgb = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*rgb,1)
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Roughness'].default_value = .6
    mat.diffuse_color = (*rgb,1)
    return mat

brick = [material('Tijolo '+str(i),c) for i,c in enumerate(['#ac624a','#c37b59','#ae694e'])]
mortar = material('Argamassa','#c7b99d')
steel = material('Aco escuro','#465258',.7)
silver = material('Metal galvanizado','#a5b7c1',.8)
rim = material('Borda do balde','#d4dee1',.8)
wood = material('Madeira da alca','#805535')
coal = material('Carvao','#292a2b')

def mesh(name,verts,faces,mat,kind):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts,[],faces); data.update()
    ob = bpy.data.objects.new(name,data); collection.objects.link(ob)
    data.materials.append(mat)
    groups[kind].append(ob)
    return ob

def box(name,center,size,mat,kind='grill'):
    x,y,z=center; a,b,c=[v/2 for v in size]
    verts=[(x+sx*a,y+sy*b,z+sz*c) for sx,sy,sz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    return mesh(name,verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat,kind)

# One block footprint, with an actual open wood-storage bay and open firebox.
box('Base de pedra',(0,0,.055),(.96,.88,.11),mortar)
for row in range(5):
    h=.13+row*.105
    for side in [-1,1]:
        for j in range(3):
            box('Tijolo lateral',(side*.385,-.29+j*.29,h),(.18,.275,.095),brick[(row+j)%3])
    for j in range(3):
        box('Tijolo traseiro',(-.23+j*.23,.35,h),(.22,.16,.095),brick[(row+j+1)%3])
box('Laje de trabalho',(0,0,.61),(.96,.9,.10),mortar)
for row in range(2):
    for side in [-1,1]:
        for j in range(3):
            box('Tijolo da grelha',(side*.405,-.3+j*.30,.73+row*.11),(.14,.285,.1),brick[(row+j)%3])
    for j in range(4):
        box('Anteparo traseiro',(-.3+j*.2,.385,.73+row*.11),(.19,.13,.1),brick[(row+j)%3])
box('Bandeja de brasas',(0,0,.685),(.65,.65,.04),steel)
for i in range(3):
    for j in range(3):
        box('Carvao mineral',(-.21+i*.21,-.2+j*.2,.72),(.15,.13,.05),coal)
for i in range(9):
    box('Barra da grelha',(-.3+i*.075,0,.875),(.022,.69,.024),silver)
for y in [-.30,.30]: box('Travessa da grelha',(0,y,.852),(.68,.025,.025),steel)
box('Pegador frontal',(0,-.46,.805),(.39,.055,.05),wood)
for x in [-.19,.19]: box('Suporte do pegador',(x,-.395,.805),(.025,.1,.025),steel)
for i in range(3): box('Lenha guardada',(-.2+i*.2,0,.20),(.12,.62,.12),wood)

# Hollow, twelve-sided tapered bucket: bottom, outer wall, rim and inner wall.
n=12; verts=[]
for radius,z in [(.12,-.12),(.165,.15),(.145,.15),(.102,-.092)]:
    verts.extend((radius*math.cos(i*2*math.pi/n),radius*math.sin(i*2*math.pi/n),z) for i in range(n))
faces=[]
for ring in range(3):
    for i in range(n):
        j=(i+1)%n; faces.append((ring*n+i,ring*n+j,(ring+1)*n+j,(ring+1)*n+i))
faces.extend([tuple(reversed(range(n))),tuple(range(3*n,4*n))])
mesh('Balde oco galvanizado',verts,faces,silver,'bucket')
for z,r in [(.154,.165),(-.105,.122)]:
    vs=[]
    for zz,rr in [(z-.012,r),(z+.012,r),(z+.012,r-.009),(z-.012,r-.009)]:
        vs.extend((rr*math.cos(i*2*math.pi/n),rr*math.sin(i*2*math.pi/n),zz) for i in range(n))
    fs=[]
    for ring in range(4):
        for i in range(n):
            j=(i+1)%n; k=(ring+1)%4
            fs.append((ring*n+i,ring*n+j,k*n+j,k*n+i))
    mesh('Aro reforcado',vs,fs,rim,'bucket')
for side in [-1,1]: box('Pivo da alca',(side*.169,0,.13),(.025,.045,.045),steel,'bucket')
for i in range(12):
    a=i*math.pi/12; b=(i+1)*math.pi/12
    start=Vector((.175*math.cos(a),0,.13+.205*math.sin(a)))
    end=Vector((.175*math.cos(b),0,.13+.205*math.sin(b)))
    direction=end-start
    ob=box('Arco da alca',(0,0,0),(.014,.014,direction.length),rim,'bucket')
    ob.rotation_euler=direction.to_track_quat('Z','Y').to_euler();ob.location=(start+end)/2
box('Pegador de madeira',(0,0,.333),(.12,.037,.035),wood,'bucket')

bpy.context.view_layer.update()
export={}
for kind,objects in groups.items():
    positions=[];normals=[];colors=[]
    for ob in objects:
        data=ob.data;data.calc_loop_triangles()
        normal_matrix=ob.matrix_world.to_3x3().inverted().transposed()
        color=list(data.materials[0].diffuse_color[:3])
        for tri in data.loop_triangles:
            normal=(normal_matrix@tri.normal).normalized()
            for index in tri.vertices:
                v=ob.matrix_world@data.vertices[index].co
                positions.extend(round(k,6) for k in (v.x,v.z,-v.y))
                normals.extend(round(k,6) for k in (normal.x,normal.z,-normal.y))
                colors.extend(round(k,6) for k in color)
    export[kind]={'positions':positions,'normals':normals,'colors':colors}
    print(kind, 'triangles',len(positions)//9)

out=ROOT/'src'/'assets';out.mkdir(parents=True,exist_ok=True)
(out/'domestic-models.json').write_text(json.dumps(export,separators=(',',':')),encoding='utf8')
# Keep an editable Blender library, independent of the user's pre-existing scene.
assetdir=ROOT/'assets'/'blender'
# Display both objects side by side on the same floor, independent of game origins.
for ob in groups['bucket']:
    ob.location.x+=1.1
    ob.location.z+=.12
bpy.data.libraries.write(str(assetdir/'utensilios-labsgames.blend'),{scene},fake_user=True)
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_distance=3.7
        area.spaces.active.region_3d.view_location=(.45,0,.45)
print('Exported original models to',out/'domestic-models.json')
