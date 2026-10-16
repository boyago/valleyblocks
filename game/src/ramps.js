// Uphill direction: north (-Z), east (+X), south (+Z), west (-X).
export const validFacing = value => Number.isInteger(value) && value >= 0 && value < 4 ? value : 0;
export function rampFacingFromYaw(yaw) {
  return Number.isFinite(yaw) ? ((Math.round(-yaw / (Math.PI / 2)) % 4) + 4) % 4 : 0;
}
export function rampHeight(x, z, facing) {
  return [1-z, x, z, 1-x][validFacing(facing)];
}
export function rotateRamp([x,y,z], facing, normal = false) {
  const edge = normal ? 0 : 1;
  switch(validFacing(facing)) {
    case 1:return [edge-z,y,x];
    case 2:return [edge-x,y,edge-z];
    case 3:return [z,y,edge-x];
    default:return [x,y,z];
  }
}
