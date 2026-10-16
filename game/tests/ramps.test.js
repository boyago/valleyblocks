import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {VoxelWorld} from '../src/world.js';
import {Player} from '../src/player.js';
import {EntitySystem} from '../src/entities.js';
import {BLOCK} from '../src/blocks.js';
import {rampFacingFromYaw} from '../src/ramps.js';
const dirs=[[0,-1],[1,0],[0,1],[-1,0]];

test('placement direction snaps horizontal look to all four cardinal directions, including wrapped yaw',()=>{
  for(let f=0;f<4;f++)for(const turn of [-8,0,8])for(const offset of [-.7,0,.7])assert.equal(rampFacingFromYaw(-f*Math.PI/2+turn*Math.PI+offset),f);
});

test('ramp geometry, ground height and collision agree in four directions across negative chunk edges',()=>{
  for(let f=0;f<4;f++){
    const w=new VoxelWorld(null,'ramp-shapes');const [dx,dz]=dirs[f],x=-16,z=15,y=41;
    w.setBlock(x,y,z,BLOCK.RAMP,f);
    const low={x:x+.5-dx*.3,z:z+.5-dz*.3},high={x:x+.5+dx*.3,z:z+.5+dz*.3};
    assert.ok(Math.abs(w.heightAt(low.x,low.z,43)-(y+.2))<1e-8);
    assert.ok(Math.abs(w.heightAt(high.x,high.z,43)-(y+.8))<1e-8);
    assert.equal(w.collides({x:low.x-.01,y:y+.25,z:low.z-.01},{x:low.x+.01,y:y+1.9,z:low.z+.01}),false);
    assert.equal(w.collides({x:high.x-.01,y:y+.25,z:high.z-.01},{x:high.x+.01,y:y+1.9,z:high.z+.01}),true);
    const chunk=w.chunks.get('-1,0');w._buildMesh(chunk);
    let vertices=0;
    for(const mesh of chunk.meshes){const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;
      for(let i=0;i<p.count;i++)if(p.getY(i)>=y&&Math.abs(n.getY(i)-Math.SQRT1_2)<1e-6){
        vertices++;assert.ok(Math.abs(n.getX(i)+dx*Math.SQRT1_2)<1e-6);assert.ok(Math.abs(n.getZ(i)+dz*Math.SQRT1_2)<1e-6);
      }
    }
    assert.equal(vertices,4);w.dispose();
  }
});

test('orientations persist through unloading and saves; old ramps default north and replacement clears metadata',()=>{
  const w=new VoxelWorld(null,'ramp-save');
  for(let f=0;f<4;f++)w.setBlock(-17+f,41,-16,BLOCK.RAMP,f);
  w.update(1500,1500,1);
  for(let f=0;f<4;f++)assert.equal(w.rampFacingAt(-17+f,41,-16),f);
  const restored=new VoxelWorld(null,w.seed,w.serialize());
  for(let f=0;f<4;f++)assert.equal(restored.rampFacingAt(-17+f,41,-16),f);
  restored.setBlock(-16,41,-16,BLOCK.AIR);restored.setBlock(-16,41,-16,BLOCK.RAMP);
  assert.equal(restored.rampFacingAt(-16,41,-16),0);
  const legacy=new VoxelWorld(null,'legacy',[{x:20,y:41,z:20,id:17},{x:21,y:41,z:20,id:17,facing:99}]);
  assert.equal(legacy.rampFacingAt(20,41,20),0);assert.equal(legacy.rampFacingAt(21,41,20),0);
  assert.equal(legacy.rampFacingAt(10,9,15),0);
  w.dispose();restored.dispose();legacy.dispose();
});

test('player climbs and vehicle launches from continuous ramps in every direction',()=>{
  for(let f=0;f<4;f++){
    const scene=new THREE.Scene(),w=new VoxelWorld(scene,'ramp-travel');const [dx,dz]=dirs[f];
    for(let x=27;x<=46;x++)for(let z=27;z<=46;z++)w.setBlock(x,40,z,BLOCK.STONE);
    for(let step=0;step<4;step++)for(let side=-2;side<=2;side++){
      const x=36+dx*step-dz*side,z=36+dz*step+dx*side;
      for(let y=41;y<41+step;y++)w.setBlock(x,y,z,BLOCK.STONE);
      w.setBlock(x,41+step,z,BLOCK.RAMP,f);
    }
    const start=[36.5-dx*3,41.002,36.5-dz*3],yaw=-f*Math.PI/2;
    const player=new Player(w,{position:start,yaw});let peak=41;
    for(let i=0;i<225;i++){player.update(1/120,new Set(['KeyW']),'survival');peak=Math.max(peak,player.position.y);}
    assert.ok(peak>44,`player did not climb facing ${f}: ${peak}`);
    assert.equal(player.blocked(player.position),false);
    const entities=new EntitySystem(scene,w,{}),car=entities.vehicles[0];car.position.fromArray(start);car.yaw=Math.PI+yaw;
    let launched=false;
    for(let i=0;i<140;i++){entities.updateVehicle(1/60,car,{KeyW:true});launched ||= !car.grounded&&car.verticalVelocity>3&&car.position.y>44;}
    assert.ok(launched,`car did not launch facing ${f}`);
    entities.dispose();w.dispose();
  }
});
