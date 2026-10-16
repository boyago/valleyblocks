import { advanceSession, DAILY_SECONDS, dayKey } from '../usage-policy.mjs';
export const PLAY_SCHEMA=[
  `CREATE TABLE IF NOT EXISTS labs_play_sessions (
    owner_id VARCHAR(80) PRIMARY KEY, session_id VARCHAR(36) NOT NULL,
    game VARCHAR(64) NOT NULL, active INTEGER NOT NULL, updated_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS labs_play_daily (
    owner_id VARCHAR(80) NOT NULL, day_key VARCHAR(10) NOT NULL, used_ms BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (owner_id,day_key)
  )`,
  `CREATE TABLE IF NOT EXISTS labs_play_guest_claims (
    guest_id VARCHAR(80) NOT NULL, account_id VARCHAR(80) NOT NULL, day_key VARCHAR(10) NOT NULL,
    claimed_ms BIGINT NOT NULL DEFAULT 0, PRIMARY KEY (guest_id,account_id,day_key)
  )`,
  // Per game/day/player history for the admin (adesão por jogo). Kept 400 days; ids are
  // already pseudonymous (user:<uuid> or guest:<hmac>), the IP owner is never stored here.
  `CREATE TABLE IF NOT EXISTS labs_play_stats (
    day_key VARCHAR(10) NOT NULL, game VARCHAR(64) NOT NULL, owner_id VARCHAR(80) NOT NULL,
    used_ms BIGINT NOT NULL DEFAULT 0, starts INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day_key,game,owner_id)
  )`,
];
export const STATS_RETENTION_DAYS=400;
const ready=new WeakMap();
// Production tables were created before labs_play_stats existed: create it once per process.
export function ensurePlaySchema(db){
  if(!ready.has(db))ready.set(db,(async()=>{for(const sql of PLAY_SCHEMA)await db.query(sql);})().catch(e=>{ready.delete(db);throw e;}));
  return ready.get(db);
}
export function createPlayStore(db) {
  const insert=db.dialect==='mysql'?'INSERT IGNORE':'INSERT OR IGNORE',lock=db.dialect==='mysql'?' FOR UPDATE':'';
  return {
    async record(owner, input, {account=false,unlimited=false,ipOwner=null}={}, now=Date.now()) {
      await ensurePlaySchema(db);
      return db.transaction(async query=>{
        await query(`${insert} INTO labs_play_sessions (owner_id,session_id,game,active,updated_at) VALUES (?,?,?,0,?)`,[owner,'',input.game,now]);
        const [previous]=await query(`SELECT * FROM labs_play_sessions WHERE owner_id=?${lock}`,[owner]);
        const result=advanceSession(previous,input,now),day=dayKey(now);
        if(!result.accepted)return {allowed:false,reason:'already-playing',message:'Esta conta já está jogando em outra aba. Pause a outra partida para continuar.'};
        // Guests: the IP-derived owner only accumulates time (no session row, so it never
        // causes 'already-playing'); dropping the cookie no longer resets the daily quota.
        const owners=!account&&ipOwner?[owner,ipOwner]:[owner];
        for(const segment of result.segments)for(const o of owners){
          await query(`${insert} INTO labs_play_daily (owner_id,day_key,used_ms) VALUES (?,?,0)`,[o,segment.day]);
          await query('UPDATE labs_play_daily SET used_ms=used_ms+? WHERE owner_id=? AND day_key=?',[segment.ms,o,segment.day]);
        }
        const stat=async(d,game,ms,starts)=>{
          await query(`${insert} INTO labs_play_stats (day_key,game,owner_id,used_ms,starts) VALUES (?,?,?,0,0)`,[d,game,owner]);
          await query('UPDATE labs_play_stats SET used_ms=used_ms+?,starts=starts+? WHERE day_key=? AND game=? AND owner_id=?',[ms,starts,d,game,owner]);
        };
        for(const segment of result.segments)if(previous?.game)await stat(segment.day,previous.game,segment.ms,0);
        if(input.active&&result.newSession)await stat(day,input.game,0,1);
        let used=0;for(const o of owners){const [row]=await query('SELECT used_ms FROM labs_play_daily WHERE owner_id=? AND day_key=?',[o,day]);used=Math.max(used,Number(row?.used_ms||0));}
        const limit=DAILY_SECONDS[account?'account':'visitor'],remaining=unlimited?null:Math.max(0,limit-Math.ceil(used/1000));
        const allowed=unlimited||remaining>0;
        await query('UPDATE labs_play_sessions SET session_id=?,game=?,active=?,updated_at=? WHERE owner_id=?',[input.session,input.game,input.active&&allowed?1:0,result.row.updated_at,owner]);
        return {allowed,remainingSeconds:remaining,unlimited,account,day,reason:allowed?null:'daily-limit',message:allowed?'':account?'Seu tempo de hoje terminou. Volte amanhã para continuar.':'Seus 15 minutos de hoje terminaram. Entre em uma conta para ter até 60 minutos diários.'};
      });
    },
    async claimGuest(guest, account, now=Date.now()) {
      const day=dayKey(now);
      await db.transaction(async query=>{
        // Serialized claim per guest/account/day; repeated logins never duplicate it.
        await query(`${insert} INTO labs_play_guest_claims (guest_id,account_id,day_key,claimed_ms) VALUES (?,?,?,0)`,[guest,account,day]);
        const [claim]=await query(`SELECT * FROM labs_play_guest_claims WHERE guest_id=? AND account_id=? AND day_key=?${lock}`,[guest,account,day]);
        const [usage]=await query('SELECT used_ms FROM labs_play_daily WHERE owner_id=? AND day_key=?',[guest,day]);
        const used=Number(usage?.used_ms||0),delta=Math.max(0,used-Number(claim.claimed_ms));
        await query(`${insert} INTO labs_play_daily (owner_id,day_key,used_ms) VALUES (?,?,0)`,[account,day]);
        await query('UPDATE labs_play_daily SET used_ms=used_ms+? WHERE owner_id=? AND day_key=?',[delta,account,day]);
        await query('UPDATE labs_play_guest_claims SET claimed_ms=? WHERE guest_id=? AND account_id=? AND day_key=?',[used,guest,account,day]);
      });
    },
    async cleanup(now=Date.now()) {
      const cutoff=dayKey(now-2*86400000);
      await db.query('DELETE FROM labs_play_sessions WHERE updated_at<?',[now-2*86400000]);
      await db.query('DELETE FROM labs_play_daily WHERE day_key<?',[cutoff]);
      await db.query('DELETE FROM labs_play_guest_claims WHERE day_key<?',[cutoff]);
      await ensurePlaySchema(db);
      await db.query('DELETE FROM labs_play_stats WHERE day_key<?',[dayKey(now-STATS_RETENTION_DAYS*86400000)]);
    },
  };
}
