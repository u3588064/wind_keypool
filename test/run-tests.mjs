#!/usr/bin/env node
import { mkdtempSync, mkdirSync, cpSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = resolve(rootDir, 'test/fake-wind-skill');

function keyId(key) {
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

function makeTempHome() {
  return mkdtempSync(resolve(tmpdir(), 'wind-keypool-home-'));
}

function makeWindSkill() {
  const dir = mkdtempSync(resolve(tmpdir(), 'fake-wind-skill-'));
  mkdirSync(resolve(dir, 'scripts'), { recursive: true });
  cpSync(resolve(fixtureDir, 'scripts/cli.mjs'), resolve(dir, 'scripts/cli.mjs'));
  return dir;
}

function runNode(args, options = {}) {
  return spawnSync(process.execPath, args, {
    cwd: options.cwd ?? rootDir,
    env: { ...process.env, ...(options.env ?? {}) },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseStdout(result) {
  return JSON.parse(result.stdout);
}

function mount(windDir, env = {}) {
  const result = runNode([resolve(rootDir, 'bin/mount.mjs'), '--wind-skill-dir', windDir], { env });
  assert(result.status === 0, `mount failed: ${result.stderr}`);
}

function unmount(windDir, env = {}) {
  const result = runNode([resolve(rootDir, 'bin/unmount.mjs'), '--wind-skill-dir', windDir], { env });
  assert(result.status === 0, `unmount failed: ${result.stderr}`);
}

function callWind(windDir, env = {}) {
  return runNode(['scripts/cli.mjs', 'call', 'stock_data', 'some_tool', '{"x":1}'], {
    cwd: windDir,
    env
  });
}

function testMount() {
  const windDir = makeWindSkill();
  const home = makeTempHome();
  mount(windDir, { HOME: home });
  assert(readFileSync(resolve(windDir, 'scripts/cli.mjs'), 'utf8').includes('WIND_KEYPOOL_HANGER_BEGIN'), 'shim marker missing');
  assert(existsSync(resolve(windDir, 'scripts/cli.wind-original.mjs')), 'backup missing');
  assert(existsSync(resolve(windDir, '.wind-keypool-hanger.json')), 'metadata missing');
  rmSync(windDir, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
  console.log('PASS mount');
}

function testRoundRobin() {
  const windDir = makeWindSkill();
  const home = makeTempHome();
  mount(windDir, { HOME: home });
  const keys = [];
  for (let i = 0; i < 4; i += 1) {
    const result = callWind(windDir, { HOME: home, WIND_API_KEYS: 'k1,k2,k3' });
    assert(result.status === 0, `call failed: ${result.stderr}`);
    keys.push(parseStdout(result).keyUsed);
  }
  assert(keys.join(',') === 'k1,k2,k3,k1', `unexpected keys: ${keys.join(',')}`);
  rmSync(windDir, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
  console.log('PASS round-robin');
}

function testRetryKeyError() {
  const windDir = makeWindSkill();
  const home = makeTempHome();
  mount(windDir, { HOME: home });
  const result = callWind(windDir, { HOME: home, WIND_API_KEYS: 'bad,k2' });
  assert(result.status === 0, `retry call failed: ${result.stderr}`);
  assert(parseStdout(result).keyUsed === 'k2', 'did not retry to k2');
  const state = JSON.parse(readFileSync(resolve(home, '.wind-aifinmarket/keypool-state.json'), 'utf8'));
  assert(Boolean(state.cooldown[keyId('bad')]), 'bad key cooldown missing');
  rmSync(windDir, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
  console.log('PASS retry-key-error');
}

function testNoRetryParamError() {
  const windDir = makeWindSkill();
  const home = makeTempHome();
  mount(windDir, { HOME: home });
  const result = callWind(windDir, { HOME: home, WIND_API_KEYS: 'parambad,k2' });
  assert(result.status === 1, 'param error should fail');
  const output = parseStdout(result);
  assert(output.error.code === 'PARAM_VALIDATION_ERROR', `unexpected code: ${output.error.code}`);
  const state = JSON.parse(readFileSync(resolve(home, '.wind-aifinmarket/keypool-state.json'), 'utf8'));
  assert(state.cursor.stock_data === 1, 'should not advance to k2 after non-retryable error');
  rmSync(windDir, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
  console.log('PASS no-retry-param-error');
}

function testUnmount() {
  const windDir = makeWindSkill();
  const home = makeTempHome();
  mount(windDir, { HOME: home });
  unmount(windDir, { HOME: home });
  assert(!readFileSync(resolve(windDir, 'scripts/cli.mjs'), 'utf8').includes('WIND_KEYPOOL_HANGER_BEGIN'), 'shim marker still present');
  assert(!existsSync(resolve(windDir, 'scripts/cli.wind-original.mjs')), 'backup still exists');
  assert(!existsSync(resolve(windDir, '.wind-keypool-hanger.json')), 'metadata still exists');
  rmSync(windDir, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
  console.log('PASS unmount');
}

try {
  testMount();
  testRoundRobin();
  testRetryKeyError();
  testNoRetryParamError();
  testUnmount();
  console.log('ALL PASS');
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
