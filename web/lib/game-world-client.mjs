// The portal owns HTTP/authentication; the independent game only speaks SDK messages.
export function createGameWorld({ send, fetcher = fetch }) {
  let pending = Promise.resolve(), disposed = false;
  return {
    request(data) {
      if (!['load', 'save'].includes(data.action) || typeof data.requestId !== 'string' || data.requestId.length > 64) return;
      pending = pending.catch(() => {}).then(async () => {
        if (disposed) return;
        const body = JSON.stringify({ action: data.action, binding: data.binding, revision: data.revision, snapshot: data.snapshot, requestId: data.operationId });
        try {
          if (new Blob([body]).size > 4 * 1024 * 1024 + 4096) throw Error('O mundo excede o limite de 4 MB deste piloto.');
          const response = await fetcher('/api/world', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body, signal: AbortSignal.timeout(20000) });
          const result = await response.json();
          if (!response.ok) { if (!disposed) send('world-result', { requestId: data.requestId, ok: false, error: result.error, status: response.status }); return; }
          if (!disposed) send('world-result', { requestId: data.requestId, ok: true, result });
        } catch (error) {
          if (!disposed) send('world-result', { requestId: data.requestId, ok: false, error: error.name === 'TimeoutError' ? 'O servidor demorou para responder.' : 'Não foi possível conectar ao salvamento remoto.', status: 503 });
        }
      });
      return pending;
    },
    dispose() { disposed = true; },
  };
}
