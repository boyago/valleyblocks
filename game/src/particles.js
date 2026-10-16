import * as THREE from 'three';
export class Particles {
  constructor(scene) {
    this.scene=scene;this.items=[];this.geometry=new THREE.BoxGeometry(.085,.085,.085);this.material=new THREE.MeshLambertMaterial({color:0xffffff});
    this.mesh=new THREE.InstancedMesh(this.geometry,this.material,160);this.mesh.count=0;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.frustumCulled=false;scene.add(this.mesh);this.dummy=new THREE.Object3D();
  }
  burst(x,y,z,color=0x98b65a,count=18) {
    for(let i=0;i<count && this.items.length<160;i++)this.items.push({position:new THREE.Vector3(x+Math.random()*.6,y+Math.random()*.6,z+Math.random()*.6),velocity:new THREE.Vector3((Math.random()-.5)*3,Math.random()*3+1,(Math.random()-.5)*3),life:.5+Math.random()*.45,color:new THREE.Color(color)});
  }
  update(dt) {
    this.items=this.items.filter(p=>(p.life-=dt)>0);
    this.items.forEach((p,i)=>{p.velocity.y-=12*dt;p.position.addScaledVector(p.velocity,dt);this.dummy.position.copy(p.position);this.dummy.scale.setScalar(Math.min(1,p.life*3));this.dummy.rotation.x+=dt;this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);this.mesh.setColorAt(i,p.color);});
    this.mesh.count=this.items.length;this.mesh.instanceMatrix.needsUpdate=true;if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;
  }
  dispose(){this.scene.remove(this.mesh);this.mesh.dispose();this.geometry.dispose();this.material.dispose();}
}
