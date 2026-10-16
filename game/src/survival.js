export const FOODS = Object.freeze({
  food: {nutrition:10,energy:5},
  raw_lambari: {nutrition:5,energy:2},  raw_tilapia: {nutrition:5,energy:2},  raw_tucunare: {nutrition:5,energy:2},  raw_dourado: {nutrition:5,energy:2},  raw_pirarucu: {nutrition:5,energy:2}, cooked_fish: {nutrition:32,energy:16},
  raw_capivara: {nutrition:7,energy:3}, cooked_capivara: {nutrition:38,energy:18},
  raw_calango: {nutrition:5,energy:2}, cooked_calango: {nutrition:30,energy:14},
  raw_chicken: {nutrition:7,energy:2}, cooked_chicken: {nutrition:30,energy:16},
  raw_rabbit: {nutrition:8,energy:2}, cooked_rabbit: {nutrition:34,energy:18},
  raw_boar: {nutrition:10,energy:3}, cooked_boar: {nutrition:40,energy:22},
});
const bounded=(value,fallback)=>Number.isFinite(value)?Math.max(0,Math.min(100,value)):fallback;
export function restoreNeeds(player,saved){
  player.hunger=bounded(saved?.hunger,100);player.stamina=bounded(saved?.stamina,100);
  player.exhausted=!!saved?.exhausted||player.stamina<=0;
  player.panting=0;player.sprinting=false;
}
export function updateNeeds(player,dt,mode,{moving=false,sprinting=false,mining=false,swimming=false}={}){
  if(!Number.isFinite(dt)||dt<=0)return;
  if(mode!=='survival'){player.panting=0;player.sprinting=false;return;}
  const effort=(sprinting?13:0)+(swimming&&moving?5:0)+(mining?2:0);
  const recovery=player.hunger<=10?3:moving?5:12;
  player.stamina=bounded(player.stamina+(effort?-effort:recovery)*dt,100);
  player.hunger=bounded(player.hunger-dt*(sprinting?.16:swimming&&moving?.1:moving||mining?.055:.025),100);
  if(player.stamina<=0)player.exhausted=true;
  else if(player.stamina>=25)player.exhausted=false;
  player.panting=Math.max(0,Math.min(1,(45-player.stamina)/35));
  if(player.hunger<=0)player.health=Math.max(0,player.health-dt*.6);
}
export function eatFood(player,inventory,id,mode){
  const food=FOODS[id];
  if(!food)return {ok:false,message:'Este item não é alimento.'};
  if(mode!=='survival')return {ok:false,message:'No Criativo você não sente fome.'};
  if(player.hunger>=100)return {ok:false,message:'Você está satisfeito. Guarde para depois.'};
  if(!inventory.remove(id))return {ok:false,message:'Esse alimento acabou.'};
  if(!inventory.has(id))inventory.hotbar=inventory.hotbar.map(slot=>slot===id?null:slot);
  player.hunger=Math.min(100,player.hunger+food.nutrition);
  player.stamina=Math.min(100,player.stamina+food.energy);
  if(id.startsWith('cooked_'))player.health=Math.min(100,player.health+6);
  return {ok:true,message:id.startsWith('raw_')?'Você comeu carne crua. Assada, ela alimenta muito mais.':'Você se alimentou e recuperou energia.'};
}
