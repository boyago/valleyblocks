import { BLOCK } from './blocks.js';
import { Inventory } from './inventory.js';

export function useBucket(world, inventory, hit, canPlace, forges) {
  const item=inventory.selectedItem;
  if(!hit || !['bucket','water_bucket'].includes(item) || !inventory.has(item)) return {ok:false,message:'Aponte para água, uma superfície ou uma churrasqueira ao alcance.'};
  const key=`${hit.x},${hit.y},${hit.z}`, forge=hit.id===BLOCK.FORGE;
  const water=forges[key]?.water===1;
  const collect=item==='bucket';
  if (collect && hit.id===BLOCK.LAVA) return {ok:false,message:'Este balde coleta água. Evite tocar na lava.'};
  if(collect && !(forge?water:hit.id===BLOCK.WATER && world.getWaterLevel(hit.x,hit.y,hit.z)===0)) return {ok:false,message:'Colete uma fonte de água; correntes rasas não enchem o balde.'};
  if(forge && !collect && water) return {ok:false,message:'A churrasqueira já tem água. Use-a ou retire com um balde vazio.'};
  const output=collect?'water_bucket':'bucket';
  const trial=new Inventory(inventory.mode,inventory.serialize());
  if(!trial.remove(item) || !trial.add(output)) return {ok:false,message:'Não há espaço para o balde.'};
  if(forge) forges[key]={water:collect?0:1};
  else if(collect) {
    if(!world.setBlock(hit.x,hit.y,hit.z,BLOCK.AIR)) return {ok:false,message:'Não foi possível coletar esta água.'};
  } else {
    const x=hit.x+hit.normal.x,y=hit.y+hit.normal.y,z=hit.z+hit.normal.z;
    if(!canPlace(x,y,z) || !world.setBlock(x,y,z,BLOCK.WATER)) return {ok:false,message:'Deixe um espaço livre para despejar a água.'};
  }
  inventory.counts=trial.counts;
  inventory.hotbar[inventory.selected]=output;
  return {ok:true,message:collect?'Balde cheio. Leve a água para outro lugar.':forge?'Bandeja da churrasqueira abastecida para resfriar o ferro.':'Água despejada. Você recuperou o balde vazio.'};
}

export function forgeIron(inventory, forge) {
  return heatMaterial('iron',inventory,forge);
}

export const HEAT_RECIPES = Object.freeze([
  {id:'fish_lambari',name:'Assar lambari',ingredients:{raw_lambari:1,18:1},output:{id:'cooked_fish',count:1}},
  {id:'fish_tilapia',name:'Assar tilápia',ingredients:{raw_tilapia:1,18:1},output:{id:'cooked_fish',count:1}},
  {id:'fish_tucunare',name:'Assar tucunaré',ingredients:{raw_tucunare:1,18:1},output:{id:'cooked_fish',count:1}},
  {id:'fish_dourado',name:'Assar dourado',ingredients:{raw_dourado:1,18:1},output:{id:'cooked_fish',count:1}},
  {id:'fish_pirarucu',name:'Assar pirarucu',ingredients:{raw_pirarucu:1,18:1},output:{id:'cooked_fish',count:3}},
  {id:'capivara',name:'Assar capivara',ingredients:{raw_capivara:1,18:1},output:{id:'cooked_capivara',count:1}},
  {id:'calango',name:'Assar calango',ingredients:{raw_calango:1,18:1},output:{id:'cooked_calango',count:1}},
  {id:'aluminum',name:'Derreter alumínio',ingredients:{57:2,18:1},output:{id:'aluminum_ingot',count:1}},
  {id:'chicken',name:'Assar frango',ingredients:{raw_chicken:1,18:1},output:{id:'cooked_chicken',count:1}},
  {id:'rabbit',name:'Assar carne de coelho',ingredients:{raw_rabbit:1,18:1},output:{id:'cooked_rabbit',count:1}},
  {id:'boar',name:'Assar carne de javali',ingredients:{raw_boar:1,18:1},output:{id:'cooked_boar',count:1}},
  {id:'iron',name:'Preparar lingote de ferro',ingredients:{10:1,18:1},output:{id:'iron_ingot',count:1}},
  {id:'copper',name:'Preparar lingote de cobre',ingredients:{19:1,18:1},output:{id:'copper_ingot',count:1}},
  {id:'gold',name:'Preparar lingote de ouro',ingredients:{20:1,18:1},output:{id:'gold_ingot',count:1}},
  {id:'glass',name:'Preparar vidro',ingredients:{4:2,18:1},output:{id:7,count:2}},
  {id:'charcoal',name:'Preparar carvão de madeira',ingredients:{5:2},output:{id:18,count:1}},
].map(r=>Object.freeze({...r,ingredients:Object.freeze(r.ingredients),output:Object.freeze(r.output)})));

export function heatMaterial(recipeId,inventory,station){
  const recipe=HEAT_RECIPES.find(r=>r.id===recipeId);
  if(!station||!recipe)return {ok:false,message:'Aproxime-se de uma churrasqueira.'};
  const trial=new Inventory(inventory.mode,inventory.serialize());
  for(const [id,n] of Object.entries(recipe.ingredients))if(!trial.remove(id,n))return {ok:false,message:'Faltam ingredientes na mochila para este preparo.'};
  if(!trial.add(recipe.output.id,recipe.output.count))return {ok:false,message:'Não foi possível guardar o material.'};
  inventory.counts=trial.counts;
  const cooled=recipeId==='iron'&&station.water===1;
  if(cooled)station.water=0;
  return {ok:true,message:recipeId==='iron'?`Lingote de ferro pronto! Use 3 lingotes e 2 tábuas na bancada para uma picareta ou machado de ferro.${cooled?' Água usada no resfriamento.':''}`:'Material preparado na churrasqueira!'};
}
