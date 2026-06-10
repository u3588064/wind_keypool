import { spawnSync } from 'node:child_process';

export function runOriginalCli(originalCli, argsForOriginal, apiKey) {
  const env = { ...process.env };
  delete env.WIND_API_KEYS;
  delete env.WIND_API_KEY_POOL;
  if (apiKey) env.WIND_API_KEY = apiKey;

  const result = spawnSync(process.execPath, [originalCli, ...argsForOriginal], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env
  });

  if (result.error) {
    return {
      status: 1,
      stdout: result.stdout ?? '',
      stderr: `${result.stderr ?? ''}${result.error.message}\n`,
      error: result.error
    };
  }

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: null
  };
}
