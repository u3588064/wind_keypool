# wind-skill-keypool-hanger

Loose-coupled key pool hanger for an installed `wind-mcp-skill`.

It mounts a tiny shim over `wind-mcp-skill/scripts/cli.mjs`, backs up the original CLI as `scripts/cli.wind-original.mjs`, and delegates calls through a local key-pool wrapper. It does not implement an MCP client, does not change Wind tool calls, and does not install dependencies.

## Install Order

```bash
# 1. 先安装官方 wind-mcp-skill
# 2. 再进入本项目
cd wind-skill-keypool-hanger

# 3. 配置多个 Key
mkdir -p ~/.wind-aifinmarket
cat > ~/.wind-aifinmarket/keypool.json <<'JSON'
{
  "keys": [
    "ak_xxx_1",
    "ak_xxx_2",
    "ak_xxx_3"
  ],
  "strategy": "round_robin",
  "bucket": "server",
  "maxAttemptsPerCall": "all",
  "logLevel": "warn"
}
JSON

# 4. 悬挂到 Wind skill
node ./bin/mount.mjs --wind-skill-dir /absolute/path/to/wind-mcp-skill
```

## Usage

悬挂后仍然使用原 Wind skill 的方式：

```bash
cd /absolute/path/to/wind-mcp-skill
node scripts/cli.mjs call stock_data some_tool '{"x":1}'
```

不需要改 Wind skill 的 `SKILL.md`。

不需要改官方 Wind `config`。

不需要联网安装依赖。

## Unmount

```bash
node /path/to/wind-skill-keypool-hanger/bin/unmount.mjs --wind-skill-dir /absolute/path/to/wind-mcp-skill
```

## Temporary Disable

```bash
WIND_KEYPOOL_DISABLE=1 node scripts/cli.mjs call stock_data some_tool '{"x":1}'
```

## Debug

```bash
WIND_KEYPOOL_DEBUG=1 node scripts/cli.mjs call stock_data some_tool '{"x":1}'
```

## Notes

- State is stored at `~/.wind-aifinmarket/keypool-state.json`.
- State stores only `sha256(key).slice(0, 16)` key IDs and masked keys.
- Retry only occurs for key-level errors: `KEY_INVALID`, `KEY_FORBIDDEN_SERVER`, `RATE_LIMIT_DAILY`, `RATE_LIMIT_QPS`, and `BALANCE_INSUFFICIENT`.
- Parameter, tool, business, protocol, and unknown errors are returned unchanged.
- Delete or move this project only after unmounting. If moved, run `mount` again.
