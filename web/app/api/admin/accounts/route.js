import { readBody, requireAccount, authError } from '@/lib/server/auth-http.mjs';
import { json } from '@/lib/server/usage-http.mjs';
import { AccountError } from '@/lib/server/accounts.mjs';
export const runtime='nodejs';
export async function GET(request) {
  try {const {accounts,account}=await requireAccount(request,'admin');return json({accounts:await accounts.list(account.id)});}catch(error){return authError(error);}
}
export async function POST(request) {
  try {
    const body=await readBody(request),{accounts,account}=await requireAccount(request,'admin');
    const invitation=body.renewFor?await accounts.reinvite(account.id,String(body.renewFor)):await accounts.invite({name:body.username,actor:account.id});
    return json({account:invitation.account,expiresAt:invitation.expiresAt,activationUrl:`${process.env.LABS_ORIGIN}/conta/ativar#token=${invitation.token}`},201);
  }catch(error){return authError(error);}
}
export async function PATCH(request) {
  try {
    const body=await readBody(request),{accounts,account}=await requireAccount(request,'admin');
    if (typeof body.id!=='string'||!/^[0-9a-f-]{36}$/i.test(body.id)) throw new AccountError('Conta inválida.');
    if ('profile' in body) await accounts.updateProfile(account.id,body.id,body.profile);
    else if ('disabled' in body) await accounts.setDisabled(account.id,body.id,body.disabled);
    else if ('pack' in body) {
      if ('unlimited' in body || 'cloudSave' in body) throw new AccountError('Altere uma permissão por vez.');
      await accounts.setPack(account.id,body.id,String(body.pack),body.granted);
    } else if ('cloudSave' in body) {
      if ('unlimited' in body) throw new AccountError('Altere uma permissão por vez.');
      await accounts.setCloudSave(account.id,body.id,body.cloudSave);
    } else await accounts.setUnlimited(account.id,body.id,body.unlimited);
    return json({ok:true});
  }catch(error){return authError(error);}
}
export async function DELETE(request) {
  try {
    const body=await readBody(request),{accounts,account}=await requireAccount(request,'admin');
    if (typeof body.id!=='string'||!/^[0-9a-f-]{36}$/i.test(body.id)) throw new AccountError('Conta inválida.');
    // Typed confirmation: the admin must repeat the username, so a stray click never erases a player.
    const [target]=(await accounts.list(account.id)).filter(a=>a.id===body.id);
    if (!target||body.confirm!==target.username) throw new AccountError('Digite o nome de usuário para confirmar a exclusão.');
    await accounts.remove(account.id,body.id);
    return json({ok:true});
  }catch(error){return authError(error);}
}
