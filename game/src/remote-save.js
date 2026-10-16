import { validateSnapshot, loadGame, saveGame, latestBackup, writeBackup, removeBackup } from './save.js';

export function createRemoteSaves({ request, backup = { read: latestBackup, write: writeBackup, remove: removeBackup }, legacyLoad = loadGame, localSave = saveGame }) {
  let binding, revision, account = false, pending = null, recovered = null, legacy = null, localOnly = false;
  let blocked = false, initialized = false;
  const clientId = crypto.randomUUID();
  const sendPending = async () => {
    try {
      const result = await request('save', { binding, revision: pending.revision, snapshot: pending.snapshot, operationId: pending.operationId });
      revision = result.revision;
      const saved = pending;
      pending = null;
      try {
        await backup.write(saved.backupKey, { ...saved, pending: false, revision });
        await backup.remove?.(saved.backupKey);
      } catch { /* The server has already acknowledged the save. */ }
      recovered = null;
      return result;
    } catch (error) {
      if ([401,403,409].includes(error.status)) blocked = true;
      throw error;
    }
  };
  return {
    get cloud() { return !localOnly; },
    async load() {
      const result = await request('load');
      if (result.localOnly) { localOnly = true; account = !!result.account; initialized = true; return legacyLoad(); }
      binding = result.binding; revision = result.revision; account = result.account;
      initialized = true;
      try { recovered = await backup.read(binding); } catch { recovered = null; }
      try { legacy = await legacyLoad(); } catch { legacy = null; }
      return result.snapshot;
    },
    info() { return { account, localAvailable: !!legacy && revision === 0,
      recoveryAvailable: !!recovered?.pending && recovered.revision === revision, backupAvailable: !!recovered?.pending }; },
    async save(snapshot) {
      if (!initialized) throw Error('Carregue o mundo remoto antes de salvar.');
      if (localOnly) return localSave(snapshot);
      if (blocked) throw Error('O mundo mudou em outra aba ou conta. Baixe sua cópia no menu e reabra o jogo.');
      // Retry the exact previous operation first when its response was lost.
      if (pending) await sendPending();
      const data = validateSnapshot(snapshot); data.savedAt = new Date().toISOString();
      pending = { snapshot: data, revision, operationId: crypto.randomUUID(), pending: true, backupKey: binding + ':' + clientId };
      // Keep an independent recovery copy before attempting the network write.
      try { await backup.write(pending.backupKey, pending); recovered = pending; }
      catch { pending = null; throw Error('Não foi possível guardar a cópia de segurança local. Libere espaço no navegador e tente salvar novamente.'); }
      return sendPending();
    },
    async importLocal() {
      if (revision !== 0 || !legacy) throw Error('Não há mundo local para importar em um espaço remoto vazio.');
      await this.save(legacy); return legacy;
    },
    async recover() {
      if (!recovered?.pending || recovered.revision !== revision) throw Error('O mundo remoto mudou. Baixe a cópia pendente para preservá-la.');
      pending = recovered; const snapshot = pending.snapshot; await sendPending(); return snapshot;
    },
    async backupSnapshot() { return recovered?.snapshot || legacy; },
  };
}
