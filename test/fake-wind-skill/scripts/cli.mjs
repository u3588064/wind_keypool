#!/usr/bin/env node
const key = process.env.WIND_API_KEY;

if (key === 'bad') {
  console.log(JSON.stringify({
    ok: false,
    error: {
      code: 'KEY_INVALID',
      agent_action: 'bad key'
    }
  }));
  process.exit(1);
}

if (key === 'qps') {
  console.log(JSON.stringify({
    ok: false,
    error: {
      code: 'RATE_LIMIT_QPS',
      agent_action: 'qps limit'
    }
  }));
  process.exit(1);
}

if (key === 'parambad') {
  console.log(JSON.stringify({
    ok: false,
    error: {
      code: 'PARAM_VALIDATION_ERROR',
      agent_action: 'param bad'
    }
  }));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  keyUsed: key,
  argv: process.argv.slice(2)
}));
process.exit(0);
