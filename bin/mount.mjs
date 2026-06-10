#!/usr/bin/env node
import { copyFileSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFlagValue } from '../lib/path-utils.mjs';

const MARKER_BEGIN = 'WIND_KEYPOOL_HANGER_BEGIN';
const MARKER_END = 'WIND_KEYPOOL_HANGER_END';
const VERSION = '0.1.0';

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function makeShim(hangerEntry) {
  return `#!/usr/bin/env node
// ${MARKER_BEGIN}
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const hangerEntry = ${JSON.stringify(hangerEntry)};
const originalCli = resolve(__dirname, 'cli.wind-original.mjs');

const result = spawnSync(
  process.execPath,
  [hangerEntry, '--original-cli', originalCli, '--', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: process.env
  }
);

process.exit(result.status ?? 1);
// ${MARKER_END}
`;
}

function main() {
  const args = process.argv.slice(2);
  const windSkillDir = resolve(parseFlagValue(args, '--wind-skill-dir') ?? process.cwd());
  const force = args.includes('--force');
  const scriptsDir = resolve(windSkillDir, 'scripts');
  const windCli = resolve(scriptsDir, 'cli.mjs');
  const backupCli = resolve(scriptsDir, 'cli.wind-original.mjs');
  const metadataFile = resolve(windSkillDir, '.wind-keypool-hanger.json');
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const hangerEntry = resolve(projectRoot, 'bin/wind-keypool-wrapper.mjs');

  if (!existsSync(scriptsDir) || !statSync(scriptsDir).isDirectory()) {
    throw new Error(`${scriptsDir} is not a directory`);
  }
  if (!existsSync(windCli)) {
    throw new Error(`${windCli} does not exist`);
  }

  const current = readFileSync(windCli, 'utf8');
  if (current.includes(MARKER_BEGIN)) {
    writeFileSync(windCli, makeShim(hangerEntry), { mode: statSync(windCli).mode });
    process.stdout.write('mounted already / refreshed\n');
    return;
  }

  if (existsSync(backupCli) && !force) {
    throw new Error(`${backupCli} already exists and ${windCli} is not mounted. Run unmount first or use --force.`);
  }

  const originalMode = statSync(windCli).mode;
  const originalSha256 = sha256File(windCli);
  if (!existsSync(backupCli)) {
    copyFileSync(windCli, backupCli);
    writeFileSync(backupCli, readFileSync(backupCli), { mode: originalMode });
  }

  writeFileSync(windCli, makeShim(hangerEntry), { mode: originalMode });
  writeFileSync(metadataFile, `${JSON.stringify({
    mounted: true,
    version: VERSION,
    backup: 'scripts/cli.wind-original.mjs',
    hangerEntry,
    mountedAt: new Date().toISOString(),
    originalSha256
  }, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write('mounted\n');
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
