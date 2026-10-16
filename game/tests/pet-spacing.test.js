import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EntitySystem } from '../src/entities.js';
import { VoxelWorld } from '../src/world.js';

function fixture(){
  const scene=new THREE.Scene(),world=new VoxelWorld(scene,'pet-spacing');
  const entities=new EntitySystem(scene,world,{}, {vehicles:[],pets:[]});
  for(let x=35;x<56;x++)for(let z=35;z<56;z++){
    world.setBlock(x,34,z,3);for(let y=35;y<39;y++)world.setBlock(x,y,z,0);
  }
  const dog=entities.createPet('dog',new THREE.Vector3(40.5,35,40.5));
  const cat=entities.createPet('cat',dog.position.clone());
  for(const p of [dog,cat]){p.tamed=true;p.mode='follow';}
  return {world,entities,dog,cat,close(){entities.dispose();world.dispose();}};
}

test('overlapping followers separate, walk together and remain apart when stopping and turning',()=>{
  const {entities,dog,cat,close}=fixture();
  try{
    for(const target of [new THREE.Vector3(49,35,40),new THREE.Vector3(49,35,49),new THREE.Vector3(39,35,49)]){
      for(let i=0;i<750;i++){
        entities.update(1/60,target);
        if(i>90)assert.ok(dog.position.distanceTo(cat.position)>=1.22,'pets must not overlap');
      }
      assert.ok(dog.position.distanceTo(target)<3.2,`dog reaches player: ${dog.position.toArray()} target ${target.toArray()}`);
      assert.ok(cat.position.distanceTo(target)<3.2,`cat reaches player: ${cat.position.toArray()} target ${target.toArray()}`);
    }
  }finally{close();}
});

test('separation respects walls, stationary companions, passengers and different floors',()=>{
  const {world,entities,dog,cat,close}=fixture();
  try{
    for(let z=38;z<44;z++)for(let y=35;y<38;y++)world.setBlock(40,y,z,17);
    dog.position.set(41.25,35,40.5);cat.position.copy(dog.position);dog.mode=cat.mode='stay';
    for(let i=0;i<120;i++)entities.separatePets(1/60,new THREE.Vector3(45,35,41));
    assert.ok(dog.position.distanceTo(cat.position)>=1.22);
    for(const p of [dog,cat])assert.ok(p.position.x>=41.21,'cannot push into wall');
    cat.position.copy(dog.position);cat.vehicleId='passenger';
    const old=cat.position.clone();entities.separatePets(.05,old);assert.equal(cat.position.distanceTo(old),0);
    cat.vehicleId=null;cat.position.y+=2;entities.separatePets(.05,old);assert.equal(cat.position.x,dog.position.x);
  }finally{close();}
});
