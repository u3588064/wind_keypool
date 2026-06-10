import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defaultDotenvConfigFile, defaultKeypoolFile, expandHome } from './path-utils.mjs';

export const DEFAULT_COOLDOWNS_MS = {
  KEY_INVALID: 24 * 60 * 60 * 1000,
  KEY_FORBIDDEN_SERVER: 6 * 60 * 60 * 1000,
  RATE_LIMIT_DAILY: 24 * 60 * 60 * 1000,
  RATE_LIMIT_QPS: 5 * 1000,
  BALANCE_INSUFFICIENT: 24 * 60 * 60 * 1000
};

function uniqueKeys(keys) {
  return [...new Set(keys.map((key) => String(key).trim()).filter(Boolean))];
}

export function parseKeyList(value) {
  if (!value) return [];
  const trimmed = String(value).trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return uniqueKeys(parsed);
    } catch {
      return [];
    }
  }
  return uniqueKeys(trimmed.split(/[,;\n\r]+/));
}

function parseDotenv(content) {
  const result = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const normalized = line.startsWith('export ') ? line.slice(7).trim() : line;
    const equalsIndex = normalized.indexOf('=');
    if (equalsIndex === -1) continue;
    const name = normalized.slice(0, equalsIndex).trim();
    let value = normalized.slice(equalsIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[name] = value;
  }
  return result;
}

function baseConfig() {
  return {
    keys: [],
    strategy: 'round_robin',
    bucket: 'server',
    maxAttemptsPerCall: 'all',
    logLevel: 'warn',
    cooldownsMs: { ...DEFAULT_COOLDOWNS_MS }
  };
}

function normalizeConfig(config) {
  const normalized = baseConfig();
  normalized.keys = uniqueKeys(config.keys ?? []);
  if (config.strategy === 'round_robin') normalized.strategy = config.strategy;
  if (['server', 'global', 'tool'].includes(config.bucket)) normalized.bucket = config.bucket;
  if (config.maxAttemptsPerCall === 'all' || Number.isInteger(config.maxAttemptsPerCall)) {
    normalized.maxAttemptsPerCall = config.maxAttemptsPerCall;
  }
  if (['debug', 'info', 'warn', 'error', 'silent'].includes(config.logLevel)) normalized.logLevel = config.logLevel;
  normalized.cooldownsMs = { ...DEFAULT_COOLDOWNS_MS, ...(config.cooldownsMs ?? {}) };
  return normalized;
}

export function loadConfig(env = process.env) {
  if (env.WIND_KEYPOOL_FILE) {
    const keypoolFile = resolve(expandHome(env.WIND_KEYPOOL_FILE));
    if (!existsSync(keypoolFile)) return normalizeConfig({});
    return normalizeConfig(JSON.parse(readFileSync(keypoolFile, 'utf8')));
  }

  const envKeys = parseKeyList(env.WIND_API_KEYS || env.WIND_API_KEY_POOL);
  if (envKeys.length > 0) return normalizeConfig({ keys: envKeys });

  const keypoolFile = defaultKeypoolFile();
  if (existsSync(keypoolFile)) {
    return normalizeConfig(JSON.parse(readFileSync(keypoolFile, 'utf8')));
  }

  const dotenvFile = defaultDotenvConfigFile();
  if (existsSync(dotenvFile)) {
    const dotenv = parseDotenv(readFileSync(dotenvFile, 'utf8'));
    const dotenvKeys = parseKeyList(dotenv.WIND_API_KEYS || dotenv.WIND_API_KEY_POOL);
    if (dotenvKeys.length > 0) return normalizeConfig({ keys: dotenvKeys });
    if (dotenv.WIND_API_KEY) return normalizeConfig({ keys: [dotenv.WIND_API_KEY] });
  }

  if (env.WIND_API_KEY) return normalizeConfig({ keys: [env.WIND_API_KEY] });
  return normalizeConfig({});
}
