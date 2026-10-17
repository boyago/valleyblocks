import * as THREE from 'three';
import { NEW_VISUAL } from './visual.js';
import { createSkyDome } from './sky-dome.js';

export class Sky {
  constructor(scene) {
    this.scene=scene;
    this.ambient=new THREE.HemisphereLight(0xe2f5ff,0x7a8b53,2);
    this.sun=new THREE.DirectionalLight(0xffe5bb,2.6);
    this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);
    Object.assign(this.sun.shadow.camera,{left:-38,right:38,top:38,bottom:-38,near:1,far:140});
    this.sun.shadow.normalBias=.04;this.sun.shadow.bias=-.0003;
    scene.add(this.ambient,this.sun,this.sun.target);
    this.clouds=new THREE.Group();
    const geo=new THREE.BoxGeometry(1,1,1),mat=new THREE.MeshLambertMaterial({color:0xfffcf1,flatShading:true});
    for(let i=0;i<28;i++) {
      const cloud=new THREE.Group();
      for(let j=0;j<3+(i%3);j++) {
        const cube=new THREE.Mesh(geo,mat);cube.scale.set(5+(i*7+j)%6,1.2+(j%2),3+(i+j)%4);
        cube.position.set(j*4, j%2, (j%3)*2);cloud.add(cube);
      }
      cloud.position.set(((i*61)%280)-140,42+(i%5)*2,((i*97)%280)-140);this.clouds.add(cloud);
    }
    scene.add(this.clouds);
    const stars=new Float32Array(600*3);
    for(let i=0;i<600;i++){const a=i*2.399963,b=Math.acos(1-2*(i+.5)/600);stars.set([Math.sin(b)*Math.cos(a)*240,Math.abs(Math.cos(b))*220+30,Math.sin(b)*Math.sin(a)*240],i*3);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(stars,3));
    this.stars=new THREE.Points(geometry,new THREE.PointsMaterial({color:0xfff4d4,size:.6,transparent:true,opacity:0,depthWrite:false}));scene.add(this.stars);
    this.sunDisc=new THREE.Mesh(new THREE.BoxGeometry(6,6,1),new THREE.MeshBasicMaterial({color:0xffedb1,fog:false}));scene.add(this.sunDisc);
    this.color=new THREE.Color();
    if(NEW_VISUAL){this.dome=createSkyDome();scene.add(this.dome);this.ambient.groundColor.set(0x8d7a4c);}
  }
  update(time,dt,position,settings) {
    // One full day lasts 24 real minutes; time is a normalized fraction.
    const phase=time*Math.PI*2-Math.PI/2;
    const daylight=THREE.MathUtils.clamp(Math.sin(phase)*1.8+.28,0,1);
    this.color.copy(new THREE.Color(0x101c38)).lerp(new THREE.Color(0xadcfd7),daylight);
    const sunset=Math.max(0,1-Math.abs(Math.sin(phase))/.28)*(daylight>.05?1:0);
    this.color.lerp(new THREE.Color(0xdab392),sunset*.3);
    this.scene.background=this.color;
    const far=settings.preview?100:({low:25,medium:58,high:78}[settings.quality]||58);
    this.scene.fog=settings.fog?new THREE.Fog(this.color,far*.42,far):null;
    this.ambient.intensity=.35+daylight*1.65;
    this.sun.intensity=.12+daylight*2.5;
    this.sun.color.set(daylight>.7?0xffefcf:0xffc694);
    this.sun.position.set(position.x+Math.cos(phase)*45,30+Math.max(.1,Math.sin(phase))*55,position.z-25);
    this.sun.target.position.copy(position);
    this.sun.castShadow=!!settings.shadows;
    this.sunDisc.position.set(position.x+Math.cos(phase)*150,Math.sin(phase)*145,position.z-100);this.sunDisc.lookAt(position);
    this.sunDisc.visible=daylight>.1;
    if(this.dome){
      // Visual novo: topo azul, horizonte claro (e alaranjado no fim de tarde), halo no sol.
      const u=this.dome.material.uniforms;
      u.top.value.set(0x0b1530).lerp(new THREE.Color(0x4f9be0),daylight);
      u.horizon.value.set(0x1b2748).lerp(new THREE.Color(0xd9eef2),daylight).lerp(new THREE.Color(0xffc48a),sunset*.75);
      u.glow.value.set(0xffd59a).multiplyScalar(daylight);
      u.sunDir.value.set(Math.cos(phase)*150,Math.sin(phase)*145,-100);
      this.dome.position.copy(position);
      this.color.copy(u.horizon.value);this.scene.background=this.color;if(this.scene.fog)this.scene.fog.color.copy(this.color);
      this.sun.color.set(daylight>.7?0xffd9a0:0xffb070);this.sun.intensity=.15+daylight*3.6;
      this.ambient.color.set(0xb9d8ff);this.ambient.intensity=.3+daylight*1.05;
      if(this.scene.fog){this.scene.fog.near*=1.5;this.scene.fog.far*=1.35;}
      this.sunDisc.visible=false;
    }
    this.stars.position.set(position.x,0,position.z);this.stars.material.opacity=(1-daylight)*.85;
    for(const cloud of this.clouds.children){cloud.position.x+=dt*.4;if(cloud.position.x-position.x>160)cloud.position.x-=300;if(cloud.position.x-position.x<-160)cloud.position.x+=300;if(cloud.position.z-position.z>160)cloud.position.z-=300;if(cloud.position.z-position.z<-160)cloud.position.z+=300;}
  }
  dispose() {if(this.dome){this.scene.remove(this.dome);this.dome.geometry.dispose();this.dome.material.dispose();}this.scene.remove(this.ambient,this.sun,this.sun.target,this.clouds,this.stars,this.sunDisc);const geometries=new Set(),materials=new Set();for(const root of [this.clouds,this.stars,this.sunDisc])root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.sun.shadow.dispose();}
}
