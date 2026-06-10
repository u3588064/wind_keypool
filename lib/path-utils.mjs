import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function projectRootFromImportMeta(importMetaUrl) {
  return resolve(dirname(fileURLToPath(importMetaUrl)), '..');
}

export function expandHome(inputPath) {
  if (!inputPath) return inputPath;
  if (inputPath === '~') return homedir();
  if (inputPath.startsWith('~/')) return resolve(homedir(), inputPath.slice(2));
  return inputPath;
}

export function defaultConfigDir() {
  return resolve(homedir(), '.wind-aifinmarket');
}

export function defaultKeypoolFile() {
  return resolve(defaultConfigDir(), 'keypool.json');
}

export function defaultDotenvConfigFile() {
  return resolve(defaultConfigDir(), 'config');
}

export function defaultStateFile() {
  return resolve(defaultConfigDir(), 'keypool-state.json');
}

export function defaultLockFile() {
  return resolve(defaultConfigDir(), 'keypool-state.lock');
}

export function parseFlagValue(args, flagName) {
  const index = args.indexOf(flagName);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flagName} requires a value`);
  }
  return value;
}
