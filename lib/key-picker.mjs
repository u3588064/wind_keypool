import { isCoolingDown } from './state.mjs';

export function bucketIdForArgs(argsForOriginal, bucketMode = 'server') {
  if (bucketMode === 'global') return 'default';
  if (argsForOriginal[0] !== 'call') return 'default';
  const serverType = argsForOriginal[1] || 'default';
  if (bucketMode === 'tool') {
    return `${serverType}:${argsForOriginal[2] || 'default'}`;
  }
  return serverType;
}

export function pickKey({ keys, bucketId, attemptedKeyIds, state, keyIdForKey, now = Date.now() }) {
  if (!Array.isArray(keys) || keys.length === 0) return null;
  const start = Number.isInteger(state.cursor[bucketId]) ? state.cursor[bucketId] : 0;
  for (let offset = 0; offset < keys.length; offset += 1) {
    const index = (start + offset) % keys.length;
    const key = keys[index];
    const keyId = keyIdForKey(key);
    if (attemptedKeyIds.has(keyId)) continue;
    if (isCoolingDown(state, key, now)) continue;
    state.cursor[bucketId] = (index + 1) % keys.length;
    return { key, keyId, index };
  }
  return null;
}
