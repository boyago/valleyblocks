// Integration probe: disposable player fixtures, never an existing player's world.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { tokenHash, hashPassword } from '../lib/server/accounts.mjs';
export async function verifyWorlds(db, origin) {
  const owned=[];
  const client=cookie=>async(body,overrideOrigin=origin)=>{
    const response=await fetch(origin+'/api/world',{method:'POST',headers:{Origin:overrideOrigin,'Content-Type':'application/json',Cookie:cookie||''},body:JSON.stringify(body)});
    return {status:response.status,data:await response.json()};
  };
  const fixture=async()=>{
    const id=randomUUID(),token=randomBytes(32).toString('hex');owned.push(id);
    await db.query('INSERT INTO labs_accounts (id,username,password_hash,role,unlimited,disabled,created_at) VALUES (?,?,?,\'player\',0,0,?)',[id,'qa_world_'+id.slice(0,8),await hashPassword(randomBytes(24).toString('hex')),Date.now()]);
    await db.query('INSERT INTO labs_auth_sessions (token_hash,account_id,expires_at) VALUES (?,?,?)',[tokenHash(token),id,Date.now()+600000]);
    return {id,call:client('labs_session='+token)};
  };
  try {
    const guest=client(''),a=await fixture(),b=await fixture();
    const [before]=await db.query("SELECT COUNT(*) AS total FROM labs_worlds WHERE owner_id LIKE 'guest:%'");
    assert.deepEqual((await guest({action:'load'})).data,{localOnly:true});
    assert.equal((await guest({action:'save',cloudSave:true,account:true})).status,401);
    assert.equal((await a.call({action:'load'})).data.localOnly,true);
    assert.equal((await a.call({action:'save',cloudSave:true,unlimited:true})).status,403);
    for(const id of [a.id,b.id])await db.query('INSERT INTO labs_cloud_access (account_id,enabled,updated_at) VALUES (?,1,?)',[id,Date.now()]);
    const first=await a.call({action:'load'}),other=await b.call({action:'load'});
    assert.equal(first.status,200);assert.equal(first.data.snapshot,null);assert.notEqual(first.data.binding,other.data.binding);
    const input={action:'save',binding:first.data.binding,revision:0,requestId:randomUUID(),snapshot:{version:1,seed:'integration-probe-'+randomUUID(),mode:'creative',edits:[]}};
    assert.equal((await a.call(input,'https://invalid.example')).status,403);
    assert.equal((await b.call(input)).status,409);
    const saved=await a.call(input);assert.equal(saved.status,200);assert.equal(saved.data.revision,1);
    assert.deepEqual((await a.call(input)).data,saved.data);
    const race=await Promise.all([a.call({...input,revision:1,requestId:randomUUID()}),a.call({...input,revision:1,requestId:randomUUID()})]);
    assert.deepEqual(race.map(v=>v.status).sort(),[200,409]);
    assert.equal((await a.call({action:'load'})).data.snapshot.seed,input.snapshot.seed);
    assert.equal((await b.call({action:'load'})).data.snapshot,null);
    await db.query('UPDATE labs_cloud_access SET enabled=0 WHERE account_id=?',[a.id]);
    assert.equal((await a.call(input)).status,403);assert.equal((await a.call({action:'load'})).data.localOnly,true);
    await db.query('UPDATE labs_cloud_access SET enabled=1 WHERE account_id=?',[a.id]);
    assert.equal((await a.call({action:'load'})).data.snapshot.seed,input.snapshot.seed);
    await db.query('DELETE FROM labs_auth_sessions WHERE account_id=?',[a.id]);
    assert.equal((await a.call(input)).status,401);
    const [after]=await db.query("SELECT COUNT(*) AS total FROM labs_worlds WHERE owner_id LIKE 'guest:%'");
    assert.equal(Number(after.total),Number(before.total));
    console.log('World HTTP/MySQL probe passed: visitors/free accounts cannot upload; grant, revocation, isolation, persistence, conflicts and retries verified. Guest worlds: '+after.total);
  } finally {
    for(const id of owned){
      await db.query('DELETE FROM labs_worlds WHERE owner_id=?',['user:'+id]);
      await db.query('DELETE FROM labs_cloud_access WHERE account_id=?',[id]);
      await db.query('DELETE FROM labs_auth_sessions WHERE account_id=?',[id]);
      await db.query('DELETE FROM labs_accounts WHERE id=?',[id]);
    }
  }
}
