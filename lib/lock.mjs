import { closeSync, existsSync, mkdirSync, openSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const STALE_LOCK_MS = 30_000;
const LOCK_TIMEOUT_MS = 10_000;

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function removeStaleLock(lockFile) {
  if (!existsSync(lockFile)) return;
  const ageMs = Date.now() - statSync(lockFile).mtimeMs;
  if (ageMs > STALE_LOCK_MS) {
    rmSync(lockFile, { force: true });
  }
}

export function withLock(lockFile, callback) {
  mkdirSync(dirname(lockFile), { recursive: true });
  const startedAt = Date.now();
  let fd = null;

  while (fd === null) {
    try {
      fd = openSync(lockFile, 'wx');
      writeFileSync(fd, String(process.pid));
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      removeStaleLock(lockFile);
      if (Date.now() - startedAt > LOCK_TIMEOUT_MS) {
        throw new Error(`Timed out waiting for lock: ${lockFile}`);
      }
      sleep(50 + Math.floor(Math.random() * 101));
    }
  }

  try {
    return callback();
  } finally {
    closeSync(fd);
    rmSync(lockFile, { force: true });
  }
}
