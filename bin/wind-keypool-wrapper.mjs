#!/usr/bin/env node
import { loadConfig } from '../lib/config.mjs';
import { classifyFailure } from '../lib/error-classifier.mjs';
import { bucketIdForArgs, pickKey } from '../lib/key-picker.mjs';
import { runOriginalCli } from '../lib/runner.mjs';
import { keyIdForKey, maskKey, setCooldown, withStateLock } from '../lib/state.mjs';

function parseArgs(argv) {
  const originalCliIndex = argv.indexOf('--original-cli');
  const separatorIndex = argv.indexOf('--');
  if (originalCliIndex === -1 || separatorIndex === -1 || separatorIndex < originalCliIndex) {
    throw new Error('Usage: wind-keypool-wrapper.mjs --original-cli /path/to/cli.wind-original.mjs -- <args>');
  }
  const originalCli = argv[originalCliIndex + 1];
  if (!originalCli || originalCli.startsWith('--')) {
    throw new Error('--original-cli requires a value');
  }
  return {
    originalCli,
    argsForOriginal: argv.slice(separatorIndex + 1)
  };
}

function writeResult(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

function debug(message) {
  if (process.env.WIND_KEYPOOL_DEBUG === '1') {
    process.stderr.write(`[wind-keypool] ${message}\n`);
  }
}

function exhausted() {
  process.stdout.write(`${JSON.stringify({
    ok: false,
    error: {
      code: 'KEY_POOL_EXHAUSTED',
      agent_action: '所有 Wind API Key 均不可用、已尝试或处于冷却状态。请检查 Key 是否有效、额度是否充足、权限是否覆盖当前 server_type。'
    }
  })}\n`);
  process.exit(1);
}

let parsedArgs;
try {
  parsedArgs = parseArgs(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}

const { originalCli, argsForOriginal } = parsedArgs;

if (process.env.WIND_KEYPOOL_DISABLE === '1') {
  const result = runOriginalCli(originalCli, argsForOriginal, process.env.WIND_API_KEY);
  writeResult(result);
  process.exit(result.status);
}

const config = loadConfig();

if (config.keys.length === 0) {
  const result = runOriginalCli(originalCli, argsForOriginal, process.env.WIND_API_KEY);
  writeResult(result);
  process.exit(result.status);
}

if (config.keys.length === 1) {
  const result = runOriginalCli(originalCli, argsForOriginal, config.keys[0]);
  writeResult(result);
  process.exit(result.status);
}

const bucketId = bucketIdForArgs(argsForOriginal, config.bucket);
const attemptedKeyIds = new Set();
const maxAttempts = config.maxAttemptsPerCall === 'all'
  ? config.keys.length
  : Math.max(1, Math.min(Number(config.maxAttemptsPerCall), config.keys.length));

while (attemptedKeyIds.size < maxAttempts) {
  const selected = withStateLock(({ state, save }) => {
    const picked = pickKey({
      keys: config.keys,
      bucketId,
      attemptedKeyIds,
      state,
      keyIdForKey
    });
    if (picked) save(state);
    return picked;
  });

  if (!selected) exhausted();
  attemptedKeyIds.add(selected.keyId);

  const result = runOriginalCli(originalCli, argsForOriginal, selected.key);
  if (result.status === 0) {
    writeResult(result);
    process.exit(0);
  }

  const failure = classifyFailure(result.stdout);
  if (!failure.retryable) {
    writeResult(result);
    process.exit(result.status);
  }

  withStateLock(({ state, save }) => {
    setCooldown(state, selected.key, failure.code, config.cooldownsMs[failure.code]);
    save(state);
  });
  debug(`${failure.code} on ${maskKey(selected.key)}, retrying next key`);
}

exhausted();
