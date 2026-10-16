export const petHealth=value=>Number.isFinite(value)?Math.max(0,Math.min(100,value)):100;
export function hurtPet(pet,damage){
  if(!pet||!Number.isFinite(damage)||damage<=0)return false;
  pet.health=Math.max(0,petHealth(pet.health)-damage);
  if(pet.health<=25){pet.mode=pet.health===0?'stay':'follow';pet.goal=null;pet.path.length=0;}
  return true;
}
export function feedPet(pet){pet.health=Math.min(100,petHealth(pet.health)+30);return `${pet.name} se recuperou. Vida: ${Math.round(pet.health)}/100.`;}
