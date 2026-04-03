# surf-mcp

MCP server for the [Surf](https://ask.surf) crypto data API. Dynamically generates tools from the OpenAPI spec — 12 grouped tools covering 86 endpoints across market data, wallets, social, on-chain queries, and more.

## Setup

### Prerequisites

- [Bun](https://bun.sh) runtime
- A Surf API key ([get one here](https://ask.surf))

### Install

```bash
git clone https://github.com/asksurf-ai/surf-mcp.git
cd surf-mcp
bun install
```

### Quick start (no install)

Add to your MCP client config — no clone or install needed:

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

### Config file locations

- **Claude Code**: `.mcp.json` in project root or `~/.claude.json`
- **Claude Desktop**: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
- **Cursor**: MCP settings in the IDE

### From source

```bash
git clone https://github.com/asksurf-ai/surf-mcp.git
cd surf-mcp
bun install
```

Then point your MCP config to the local source:
```json
{
  "mcpServers": {
    "surf": {
      "command": "bun",
      "args": ["run", "/path/to/surf-mcp/src/index.ts"],
      "env": {
        "SURF_API_KEY": "your-api-key"
      }
    }
  }
}
```

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

**Get BTC price history:**
```
surf_market({ command: "price", params: { symbol: "BTC", time_range: "7d" } })
```

**Check a wallet:**
```
surf_wallet({ command: "detail", params: { address: "vitalik.eth", chain: "ethereum" } })
```

**Search for projects:**
```
surf_search({ command: "project", params: { q: "defi lending", limit: 5 } })
```

**Run on-chain SQL:**
```
surf_onchain({ command: "sql", params: { sql: "SELECT * FROM agent.ethereum_transactions LIMIT 10" } })
```

**Get social sentiment:**
```
surf_social({ command: "detail", params: { q: "ethereum", time_range: "7d" } })
```

## How it works

On startup, the server:

1. Fetches the OpenAPI spec from `https://api.asksurf.ai/gateway/openapi.json` (cached for 24h)
2. Groups all operations by their API tag
3. Registers one MCP tool per tag with auto-generated descriptions and command enums
4. Routes tool calls through `@surf-ai/sdk` for HTTP transport and auth

This means the server automatically picks up new API endpoints when the spec is updated — just restart.

## Example: AI agent

The repo includes a simple agent that connects Claude to surf-mcp tools in an agentic loop. See [`examples/agent.ts`](examples/agent.ts).

```bash
ANTHROPIC_API_KEY=your-key SURF_API_KEY=your-key bun run examples/agent.ts "What's the BTC price and fear & greed index?"
```

The agent:
1. Starts the MCP server as a subprocess
2. Lists available tools and converts them to Claude's tool format
3. Sends the user's question to Claude with all surf tools available
4. Executes any tool calls via MCP and feeds results back to Claude
5. Repeats until Claude produces a final text response

## Development

```bash
bun run start                # Run the server
bun run typecheck            # Type check
```

## License

MIT
