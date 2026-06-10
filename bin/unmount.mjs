#!/usr/bin/env node
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseFlagValue } from '../lib/path-utils.mjs';

const MARKER_BEGIN = 'WIND_KEYPOOL_HANGER_BEGIN';

function main() {
  const args = process.argv.slice(2);
  const windSkillDir = resolve(parseFlagValue(args, '--wind-skill-dir') ?? process.cwd());
  const scriptsDir = resolve(windSkillDir, 'scripts');
  const windCli = resolve(scriptsDir, 'cli.mjs');
  const backupCli = resolve(scriptsDir, 'cli.wind-original.mjs');
  const metadataFile = resolve(windSkillDir, '.wind-keypool-hanger.json');

  if (!existsSync(windCli)) throw new Error(`${windCli} does not exist`);
  if (!existsSync(backupCli)) throw new Error(`${backupCli} does not exist`);
  if (!readFileSync(windCli, 'utf8').includes(MARKER_BEGIN)) {
    throw new Error(`${windCli} is not mounted by wind-keypool-hanger`);
  }

  const backupMode = statSync(backupCli).mode;
  writeFileSync(windCli, readFileSync(backupCli), { mode: backupMode });
  rmSync(backupCli, { force: true });
  rmSync(metadataFile, { force: true });
}

try {
  main();
  process.stdout.write('unmounted\n');
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
