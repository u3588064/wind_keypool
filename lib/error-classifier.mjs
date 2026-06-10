export const RETRYABLE_KEY_ERROR_CODES = new Set([
  'KEY_INVALID',
  'KEY_FORBIDDEN_SERVER',
  'RATE_LIMIT_DAILY',
  'RATE_LIMIT_QPS',
  'BALANCE_INSUFFICIENT'
]);

export const NON_RETRYABLE_ERROR_CODES = new Set([
  'INVALID_PARAMS_JSON',
  'PARAM_VALIDATION_ERROR',
  'UNKNOWN_TOOL_NAME',
  'UNKNOWN_SERVER_TYPE',
  'NO_RESULTS',
  'TOOL_RUNTIME_ERROR',
  'MCP_PROTOCOL_ERROR'
]);

export function extractErrorCode(stdout) {
  try {
    const parsed = JSON.parse(stdout);
    const code = parsed?.error?.code;
    return typeof code === 'string' ? code : null;
  } catch {
    return null;
  }
}

export function isRetryableKeyErrorCode(code) {
  return RETRYABLE_KEY_ERROR_CODES.has(code);
}

export function classifyFailure(stdout) {
  const code = extractErrorCode(stdout);
  return {
    code,
    retryable: isRetryableKeyErrorCode(code)
  };
}
