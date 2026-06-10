import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { defaultLockFile, defaultStateFile } from './path-utils.mjs';
import { withLock } from './lock.mjs';

export function keyIdForKey(key) {
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

export function maskKey(key) {
  if (!key) return '';
  if (key.length <= 4) return '***';
  if (key.length <= 8) return `${key.slice(0, 2)}***${key.slice(-1)}`;
  return `${key.slice(0, 4)}***${key.slice(-4)}`;
}

export function emptyState() {
  return { version: 1, cursor: {}, cooldown: {} };
}

export function readState(stateFile = defaultStateFile()) {
  if (!existsSync(stateFile)) return emptyState();
  try {
    const parsed = JSON.parse(readFileSync(stateFile, 'utf8'));
    return {
      version: 1,
      cursor: parsed.cursor && typeof parsed.cursor === 'object' ? parsed.cursor : {},
      cooldown: parsed.cooldown && typeof parsed.cooldown === 'object' ? parsed.cooldown : {}
    };
  } catch {
    return emptyState();
  }
}

export function writeState(state, stateFile = defaultStateFile()) {
  mkdirSync(dirname(stateFile), { recursive: true });
  const tempFile = `${stateFile}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tempFile, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  renameSync(tempFile, stateFile);
}

export function withStateLock(callback, options = {}) {
  const stateFile = options.stateFile ?? defaultStateFile();
  const lockFile = options.lockFile ?? defaultLockFile();
  return withLock(lockFile, () => callback({
    state: readState(stateFile),
    save: (state) => writeState(state, stateFile),
    stateFile
  }));
}

export function setCooldown(state, key, code, cooldownMs, now = Date.now()) {
  const keyId = keyIdForKey(key);
  state.cooldown[keyId] = {
    code,
    until: now + cooldownMs,
    keyMasked: maskKey(key),
    updatedAt: new Date(now).toISOString()
  };
  return keyId;
}

export function isCoolingDown(state, key, now = Date.now()) {
  const entry = state.cooldown[keyIdForKey(key)];
  return Boolean(entry && typeof entry.until === 'number' && entry.until > now);
}
