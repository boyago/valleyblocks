export function createGameAccess({game,send,onStatus,fetcher=fetch,win=window,doc=document}) {
  const session=crypto.randomUUID();let running=false,disposed=false,pending=Promise.resolve();
  const record=(active)=>{
    const job=pending.catch(()=>{}).then(async()=>{
      if(disposed&&active)return {allowed:false,message:'Partida encerrada.'};
      try{
        const response=await fetcher('/api/play',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',keepalive:true,body:JSON.stringify({game,session,active})});
        const data=await response.json();if(!response.ok)throw Error(data.error);
        if(!disposed)onStatus(data);
        return data;
      }catch{return {allowed:false,message:'Não foi possível verificar seu tempo. Sua partida foi pausada; tente novamente.'};}
    });pending=job;return job;
  };
  const heartbeat=async()=>{
    if(!running||disposed)return;
    const data=await record(!doc.hidden);
    if(!data.allowed){running=false;send('pause');if(!disposed)onStatus(data);}
  };
  const hidden=()=>{if(doc.hidden&&running){running=false;send('pause');void record(false);}};
  doc.addEventListener('visibilitychange',hidden);
  const timer=win.setInterval(heartbeat,15000);
  return {
    async request(id){
      const data=await record(true);if(disposed)return;
      running=!!data.allowed;send('access-result',{requestId:id,...data});
    },
    /** Para jogos que não pedem acesso sozinhos: o portal pergunta antes de iniciar. */
    async check(){const data=await record(true);if(!disposed)running=!!data.allowed;return data;},
    state(active){if(running&&!active)void record(false);running=active;},
    dispose(){void record(false);disposed=true;running=false;win.clearInterval(timer);doc.removeEventListener('visibilitychange',hidden);},
  };
}
