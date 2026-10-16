/**
 * LABSGames SDK — protocolo iframe-labs-v1
 * Copiado em cada jogo (games/<slug>/src/labs-game-sdk.js). Sem dependências.
 *
 * Uso:
 *   const labs = createLabsBridge({ slug: 'arena-labs', version: '1.0.0' });
 *   labs.on('start', () => game.start());
 *   labs.on('restart', () => game.restart());
 *   labs.on('pause', () => game.pause());
 *   labs.on('resume', () => game.resume());
 *   labs.on('destroy', () => game.dispose());
 *   labs.ready();            // quando o módulo estiver pronto para receber start
 *   labs.progress(3, 10);    // progresso real de assets
 *   labs.started(); labs.completed({ timeMs }); labs.error('msg', 'code');
 *   labs.requestFullscreen();
 *
 * labs.standalone === true quando o jogo roda fora de um iframe (dev/teste).
 */
export function createLabsBridge({ slug, version = '1.0.0' }) {
  const standalone = window.parent === window;
  const handlers = new Map();
  const accessRequests=new Map();let accessRequired=false;
  const worldRequests=new Map();
  const parentOrigin = window.location.origin; // portal e jogo no mesmo domínio

  function send(type, data = {}) {
    if (standalone) return;
    window.parent.postMessage({ labs: 1, type, slug, ...data }, parentOrigin);
  }

  function on(type, fn) {
    if (!handlers.has(type)) handlers.set(type, new Set());
    handlers.get(type).add(fn);
    return () => handlers.get(type)?.delete(fn);
  }

  function emitLocal(type, data) {
    handlers.get(type)?.forEach((fn) => fn(data));
  }

  function onMessage(event) {
    const msg = event.data;
    if (!msg || msg.labs !== 1 || typeof msg.type !== 'string') return;
    if (event.origin !== parentOrigin || event.source !== window.parent) return;
    if(msg.type==='world-result'){
      const request=worldRequests.get(msg.requestId);
      if(request){clearTimeout(request.timer);worldRequests.delete(msg.requestId);if(msg.ok)request.resolve(msg.result);else request.reject(Object.assign(new Error(msg.error||'Falha no salvamento remoto.'),{status:msg.status}));}return;
    }
    if(msg.type==='access-result'){
      const request=accessRequests.get(msg.requestId);if(request){clearTimeout(request.timer);accessRequests.delete(msg.requestId);request.resolve({allowed:msg.allowed===true,message:msg.message||''});}return;
    }
    if(msg.type==='start')accessRequired=msg.playAccess===true;
    if (!['start', 'restart', 'pause', 'resume', 'destroy'].includes(msg.type)) return;
    emitLocal(msg.type, msg);
  }
  window.addEventListener('message', onMessage);

  return {
    worldRequest:(action,data={})=>new Promise((resolve,reject)=>{
      if(standalone){reject(new Error('Salvamento remoto indisponível fora do portal.'));return;}
      const requestId=crypto.randomUUID();
      const timer=setTimeout(()=>{worldRequests.delete(requestId);reject(new Error('A conexão com o salvamento demorou. Tente novamente.'));},25000);
      worldRequests.set(requestId,{resolve,reject,timer});send('world-request',{...data,action,requestId});
    }),
    requestAccess:()=>{
      if(standalone||!accessRequired)return Promise.resolve({allowed:true});
      const requestId=crypto.randomUUID();return new Promise(resolve=>{
        const timer=setTimeout(()=>{accessRequests.delete(requestId);resolve({allowed:false,message:'A conexão com o portal demorou. Tente continuar novamente.'});},15000);
        accessRequests.set(requestId,{resolve,timer});send('access-request',{requestId});
      });
    },
    standalone,
    slug,
    on,
    emitLocal,
    ready: () => send('ready', { version }),
    progress: (loaded, total, label) => send('progress', { loaded, total, label }),
    started: () => send('started'),
    gameplay: (active) => send('gameplay', { active: !!active }),
    completed: (data = {}) => send('completed', data),
    error: (message, code = 'runtime') => send('error', { message, code }),
    requestFullscreen: () => send('fullscreen-request'),
    /** Asks the portal to open the checkout of a product; the portal decides, never the game. */
    purchase: (product) => send('purchase-request', { product: String(product).slice(0, 64) }),
    dispose: () => {
      send('gameplay', { active: false });
      for(const request of accessRequests.values()){clearTimeout(request.timer);request.resolve({allowed:false});}accessRequests.clear();
      for(const request of worldRequests.values()){clearTimeout(request.timer);request.reject(new Error('Partida encerrada.'));}worldRequests.clear();
      window.removeEventListener('message', onMessage);
      handlers.clear();
    },
  };
}
