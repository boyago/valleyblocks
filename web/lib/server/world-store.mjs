import { createHash, createHmac } from 'node:crypto';
import { AccountError } from './accounts.mjs';
import { secureEqual } from './usage-http.mjs';

export const MAX_WORLD_BYTES = 4 * 1024 * 1024;
export const WORLD_SCHEMA = [`CREATE TABLE IF NOT EXISTS labs_worlds (
  owner_id VARCHAR(80) PRIMARY KEY, revision BIGINT NOT NULL DEFAULT 0,
  snapshot MEDIUMTEXT, saved_at BIGINT NOT NULL DEFAULT 0,
  request_id VARCHAR(36), payload_hash VARCHAR(64)
)`];

export function worldBinding(owner, secret) {
  if (!secret || secret.length < 32) throw new Error('World signing secret missing');
  return createHmac('sha256', secret).update('world-owner:' + owner).digest('hex');
}
export function verifyWorldBinding(owner, binding, secret) {
  if (!secureEqual(worldBinding(owner, secret), binding)) {
    throw new AccountError('A conta mudou. Reabra o jogo para carregar o mundo correto.', 409);
  }
}
export function validateWorld(snapshot) {
  if (!snapshot || Array.isArray(snapshot) || typeof snapshot !== 'object' || snapshot.version !== 1 ||
      !['string', 'number'].includes(typeof snapshot.seed) || !String(snapshot.seed).trim() || String(snapshot.seed).length > 128 ||
      !['creative', 'survival'].includes(snapshot.mode) || !Array.isArray(snapshot.edits)) {
    throw new AccountError('Mundo inválido ou incompatível.');
  }
  const inspect = (value, depth = 0) => {
    if (depth > 40 || (typeof value === 'number' && !Number.isFinite(value))) throw new AccountError('Dados do mundo inválidos.');
    if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new AccountError('Dados do mundo inválidos.');
      inspect(item, depth + 1);
    }
  };
  inspect(snapshot);
  const encoded = JSON.stringify(snapshot);
  if (Buffer.byteLength(encoded) > MAX_WORLD_BYTES) throw new AccountError('O mundo excede o limite de 4 MB deste piloto.', 413);
  return encoded;
}
const view = row => ({ revision: Number(row?.revision || 0), snapshot: row?.snapshot ? JSON.parse(row.snapshot) : null,
  savedAt: row?.saved_at ? new Date(Number(row.saved_at)).toISOString() : null });

export function createWorldStore(db) {
  const requireOwner = owner => { if (typeof owner !== 'string' || !owner.startsWith('user:') || owner.length <= 5) throw new AccountError('Somente contas podem guardar mundos no servidor.', 401); };
  const insert = db.dialect === 'mysql' ? 'INSERT IGNORE' : 'INSERT OR IGNORE';
  const lock = db.dialect === 'mysql' ? ' FOR UPDATE' : '';
  const ensure = (query, owner) => query(`${insert} INTO labs_worlds (owner_id,revision,saved_at) VALUES (?,0,0)`, [owner]);
  return {
    async load(owner) {
      requireOwner(owner);
      const [row] = await db.query('SELECT revision,snapshot,saved_at FROM labs_worlds WHERE owner_id=?', [owner]);
      return view(row);
    },
    async save(owner, { revision, requestId, snapshot }, now = Date.now()) {
      requireOwner(owner);
      if (!Number.isSafeInteger(revision) || revision < 0 || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId || '')) throw new AccountError('Revisão de salvamento inválida.');
      const payload = validateWorld(snapshot), hash = createHash('sha256').update(payload).digest('hex');
      return db.transaction(async query => {
        await ensure(query, owner);
        const [row] = await query(`SELECT * FROM labs_worlds WHERE owner_id=?${lock}`, [owner]);
        // A lost HTTP response can be retried without applying the write twice.
        if (row.request_id === requestId && row.payload_hash === hash) return { revision: Number(row.revision), savedAt: new Date(Number(row.saved_at)).toISOString() };
        if (Number(row.revision) !== revision || row.request_id === requestId) throw new AccountError('Outra aba salvou este mundo. Sua cópia local foi preservada; reabra o jogo antes de continuar.', 409);
        await query('UPDATE labs_worlds SET revision=?,snapshot=?,saved_at=?,request_id=?,payload_hash=? WHERE owner_id=?', [revision + 1, payload, now, requestId, hash, owner]);
        return { revision: revision + 1, savedAt: new Date(now).toISOString() };
      });
    },
  };
}
