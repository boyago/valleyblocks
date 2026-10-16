const DATABASE_NAME = 'labs-valleyblocks';
const STORE_NAME = 'snapshots';
const SAVE_KEY = 'current';
const FALLBACK_KEY = `${DATABASE_NAME}:save:v1`;
export const SAVE_VERSION = 1;
let databasePromise;

/** Returns a detached, validated save. No live objects may change an in-flight save. */
export function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('O arquivo de mundo é inválido.');
  if (snapshot.version != null && snapshot.version !== SAVE_VERSION) throw new Error('Esta versão do mundo salvo não é compatível.');
  if ((typeof snapshot.seed !== 'string' && typeof snapshot.seed !== 'number') || String(snapshot.seed).trim() === '') {
    throw new Error('O mundo salvo não tem uma seed válida.');
  }
  const visiting = new WeakSet();
  const inspect = (value, depth = 0) => {
    if (depth > 40) throw new Error('O mundo salvo contém uma estrutura inválida.');
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('O mundo salvo contém um número inválido.');
    if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') throw new Error('O mundo salvo contém dados incompatíveis.');
    if (!value || typeof value !== 'object') return;
    if (visiting.has(value)) throw new Error('O mundo salvo contém referências circulares.');
    visiting.add(value);
    for (const entry of Object.values(value)) inspect(entry, depth + 1);
    visiting.delete(value);
  };
  inspect(snapshot);
  const copy = JSON.parse(JSON.stringify(snapshot));
  copy.version = SAVE_VERSION;
  return copy;
}

function database() {
  if (databasePromise) return databasePromise;
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); databasePromise = undefined; };
      resolve(db);
    };
    request.onerror = () => { databasePromise = undefined; reject(new Error('Não foi possível acessar o armazenamento local.', { cause: request.error })); };
    request.onblocked = () => { databasePromise = undefined; reject(new Error('Feche outra aba deste jogo para liberar o salvamento.')); };
  });
  return databasePromise;
}

function transact(db, mode, operation) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    let result;
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => { result = request.result; };
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () => reject(new Error('O salvamento foi interrompido. O mundo anterior foi preservado.', { cause: transaction.error }));
    transaction.onerror = () => reject(new Error('Não foi possível salvar: verifique o espaço disponível no navegador.', { cause: transaction.error }));
  });
}

export async function saveGame(snapshot) {
  const data = validateSnapshot(snapshot);
  data.savedAt = new Date().toISOString();
  const db = await database();
  if (db) await transact(db, 'readwrite', store => store.put(data, SAVE_KEY));
  else {
    if (typeof localStorage === 'undefined') throw new Error('Este navegador não disponibilizou armazenamento local.');
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(data));
  }
  return { savedAt: data.savedAt, version: data.version };
}

export async function loadGame() {
  const db = await database();
  let result;
  if (db) result = await transact(db, 'readonly', store => store.get(SAVE_KEY));
  else {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(FALLBACK_KEY);
    if (raw) {
      try { result = JSON.parse(raw); }
      catch { throw new Error('O mundo salvo está corrompido. Inicie um novo mundo para continuar.'); }
    }
  }
  return result ? validateSnapshot(result) : null;
}

export async function deleteSave() {
  const db = await database();
  if (db) await transact(db, 'readwrite', store => store.delete(SAVE_KEY));
  if (typeof localStorage !== 'undefined') localStorage.removeItem(FALLBACK_KEY);
}

export async function hasSave() { return (await loadGame()) !== null; }

// Remote backups have separate keys: the original browser world is never replaced.
export async function readBackup(key) {
  const db = await database();
  if (db) return (await transact(db, 'readonly', store => store.get('remote:' + key))) || null;
  const raw = globalThis.localStorage?.getItem(`${DATABASE_NAME}:remote:${key}`);
  return raw ? JSON.parse(raw) : null;
}
export async function writeBackup(key, value) {
  const db = await database();
  if (db) await transact(db, 'readwrite', store => store.put(value, 'remote:' + key));
  else {
    if (!globalThis.localStorage) throw Error('Armazenamento local indisponível.');
    localStorage.setItem(`${DATABASE_NAME}:remote:${key}`, JSON.stringify(value));
  }
}

export async function latestBackup(owner) {
  const db = await database();
  let entries = [];
  if (db) {
    const prefix = 'remote:' + owner + ':';
    entries = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly'), values = [];
      const cursor = tx.objectStore(STORE_NAME).openCursor();
      cursor.onsuccess = () => { const item = cursor.result; if (!item) return; if (String(item.key).startsWith(prefix)) values.push(item.value); item.continue(); };
      tx.oncomplete = () => resolve(values); tx.onerror = () => reject(tx.error);
    });
  } else if (globalThis.localStorage) {
    const prefix = `${DATABASE_NAME}:remote:${owner}:`;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) { try { entries.push(JSON.parse(localStorage.getItem(key))); } catch { /* Ignore a corrupt backup, not the server world. */ } }
    }
  }
  return entries.filter(entry => entry?.pending).sort((a,b) => (b.snapshot?.savedAt || '').localeCompare(a.snapshot?.savedAt || ''))[0] || null;
}
export async function removeBackup(key) {
  const db = await database();
  if (db) await transact(db, 'readwrite', store => store.delete('remote:' + key));
  else globalThis.localStorage?.removeItem(`${DATABASE_NAME}:remote:${key}`);
}
