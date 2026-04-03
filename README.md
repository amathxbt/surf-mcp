# surf-mcp

MCP server for the [Surf](https://ask.surf) crypto data API. Dynamically generates tools from the OpenAPI spec — 12 grouped tools covering 86 endpoints across market data, wallets, social, on-chain queries, and more.

## Quick start

Add to your MCP client config — no clone or install needed:

```json
{
  "mcpServers": {
    "surf": {
      "command": "npx",
      "args": ["-y", "@surf-ai/surf-mcp"],
      "env": {
        "SURF_API_KEY": "your-api-key"
      }
    }
  }
}
```

Or with [Bun](https://bun.sh):

```json
{
  "mcpServers": {
    "surf": {
      "command": "bunx",
      "args": ["@surf-ai/surf-mcp"],
      "env": {
        "SURF_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Prerequisites

- A Surf API key ([get one here](https://ask.surf))
- Node.js 20+ or [Bun](https://bun.sh)

### Config file locations

- **Claude Code**: `.mcp.json` in project root or `~/.claude.json`
- **Claude Desktop**: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
- **Cursor**: MCP settings in the IDE

## Tools

The server exposes 12 tools, one per API domain. Each tool accepts a `command` and optional `params`:

| Tool | Commands | Description |
|------|----------|-------------|
| `surf_market` | `price`, `ranking`, `etf`, `futures`, `options`, `fear-greed`, `liquidation-*`, `onchain-indicator`, `price-indicator` | Market overview, rankings, indicators, ETF flows |
| `surf_exchange` | `depth`, `klines`, `funding-history`, `perp`, `price`, `markets`, `long-short-ratio` | Live exchange data from Binance, OKX, Bybit, etc. |
| `surf_wallet` | `detail`, `transfers`, `history`, `net-worth`, `protocols`, `labels-batch` | Wallet balances, transfers, DeFi positions |
| `surf_token` | `holders`, `dex-trades`, `transfers`, `tokenomics` | Token holder analysis, DEX trades, unlocks |
| `surf_social` | `detail`, `user`, `user-posts`, `tweets`, `mindshare`, `ranking`, `smart-followers-history`, `tweet-replies`, `user-followers`, `user-following`, `user-replies` | X (Twitter) social signals and sentiment |
| `surf_project` | `detail`, `defi-metrics`, `defi-ranking` | Project profiles, DeFi TVL/fees/revenue |
| `surf_onchain` | `sql`, `tx`, `gas-price`, `schema`, `bridge-ranking`, `yield-ranking`, `structured-query` | On-chain SQL queries, tx lookup, gas prices |
| `surf_search` | `project`, `wallet`, `news`, `web`, `fund`, `polymarket`, `kalshi`, `airdrop`, `events`, `social-people`, `social-posts` | Unified search across all data types |
| `surf_prediction_market` | `kalshi-*`, `polymarket-*`, `matching-*`, `category-metrics` | Polymarket and Kalshi prediction markets |
| `surf_fund` | `detail`, `portfolio`, `ranking` | Crypto VC fund profiles and portfolios |
| `surf_news` | `feed`, `detail` | Crypto news from major outlets |
| `surf_web` | `fetch` | Fetch any URL as clean markdown |

## Usage examples

Once configured, your AI assistant can use the tools directly:

```
"What's the BTC price?"        → surf_market({ command: "price", params: { symbol: "BTC" } })
"Check vitalik's wallet"       → surf_wallet({ command: "detail", params: { address: "vitalik.eth" } })
"Search for DeFi projects"     → surf_search({ command: "project", params: { q: "defi lending" } })
"Run an on-chain SQL query"    → surf_onchain({ command: "sql", params: { sql: "SELECT ..." } })
"ETH social sentiment"         → surf_social({ command: "detail", params: { q: "ethereum" } })
```

## How it works

On startup, the server:

1. Fetches the OpenAPI spec from `https://api.asksurf.ai/gateway/openapi.json` (cached for 24h)
2. Groups all operations by their API tag
3. Registers one MCP tool per tag with auto-generated descriptions and command enums
4. Routes tool calls through `@surf-ai/sdk` for HTTP transport and auth

The server automatically picks up new API endpoints when the spec is updated — just restart.

## Example: AI agent

The repo includes a simple agent that connects Claude to surf-mcp tools in an agentic loop. See [`examples/agent.ts`](examples/agent.ts).

```bash
ANTHROPIC_API_KEY=your-key SURF_API_KEY=your-key bun run examples/agent.ts "What's the BTC price and fear & greed index?"
```

## Development

```bash
git clone https://github.com/asksurf-ai/surf-mcp.git
cd surf-mcp
bun install
bun run start                # Run the server
bun run typecheck            # Type check
```

## License

MIT
