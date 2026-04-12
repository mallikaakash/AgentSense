# AgentSense

**AdSense for the agent web** — a monetization platform where publishers earn USDC when AI agents query their content, and advertisers bid to inject sponsored results into agent responses.

Built on Stellar with the x402 protocol for per-request on-chain payments.

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   DEMO AGENT    │────▶│ DEMO PUBLISHER   │────▶│    PLATFORM     │
│  (chat UI,      │402  │ (recipe blog,    │auction│ (auction API,   │
│  x402 client)   │◀────│ agentGate() MW)  │◀────│ dashboards)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
       │                        │                        ▲
       │ pay $0.01 USDC         │                        │
       └────────────────────────┘                   ┌──────┴──────┐
                           │                      │  STELLAR    │
                           │               ┌──────▼─────────┐ │
                           │               │ OZ Channels    │ │
                           └───────────────▶│ Facilitator   │─┘
                                           └────────────────┘
```

**Flow:**
1. AI Agent queries publisher content
2. `agentGate()` detects agent, returns `402 Payment Required`
3. Agent's wallet signs Soroban auth entry → pays $0.01 USDC to publisher
4. OZ Channels facilitator verifies + settles payment on-chain
5. Platform runs keyword auction → highest bidder wins the sponsored slot
6. Publisher serves content + sponsored result
7. All stats update on the platform dashboards

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment template and fill in wallet keys
cp .env.example apps/demo-agent/.env.local
cp .env.example apps/demo-publisher/.env.local
cp .env.example apps/platform/.env.local
```

Each `.env.local` needs:
- `AGENT_SECRET` — Stellar secret key (S...) for the paying agent
- `PUBLISHER_WALLET` — Stellar public key (G...) for the receiving publisher
- `CHANNELS_API_KEY` — Free API key from https://channels.openzeppelin.com/testnet/gen

**Fund testnet wallets:** https://friendbot.stellar.org/

```bash
# Run all 3 apps
pnpm dev

# Open:
#   http://localhost:3001  — Demo agent (chat UI)
#   http://localhost:3002  — Demo publisher (recipe blog)
#   http://localhost:3000  — Platform (dashboards + auction)
```

---

## Add AgentSense to Your Publisher Site

```bash
npm install @agentsense/middleware
```

```ts
// app/api/articles/route.ts
import { agentGate } from '@agentsense/middleware'

export const GET = agentGate({
  wallet: 'GXXX...' // your Stellar wallet
}, async (request) => {
  const query = new URL(request.url).searchParams.get('q')
  return { title: 'My Article', body: '...' }
})
```

The middleware handles everything:
- Detects agent requests (User-Agent / X-Agent-Id header)
- Returns x402 `402` payment challenge
- Verifies payment via OZ Channels facilitator
- Calls the platform auction for the sponsored slot
- Serves content + ad to the agent

---

## Key Files

| Path | Purpose |
|------|---------|
| `packages/middleware/src/index.ts` | `agentGate()` — self-contained x402 server + adapter |
| `apps/platform/lib/store.ts` | In-memory store: publishers, advertisers, sessions, auction |
| `apps/platform/app/api/auction/route.ts` | Auction engine with fee split (0.7% publisher) |
| `apps/demo-agent/lib/x402-client.ts` | x402 client — signs Soroban auth entries, handles 402 loop |
| `apps/demo-publisher/app/api/content/route.ts` | Demo publisher content endpoint |
| `wallets.txt` | 3 pre-funded Stellar testnet wallets (Agent, Publisher, Advertiser) |

---

## Wallets (Testnet)

| Role | Public Key | Secret Key |
|------|-----------|-----------|
| Agent (payer) | GAFVVNKFZGTAZRESL2GHIXH6RGRZ6L45L3SXFHIGFZIGA7T2JKUGQ42G | SDD446FO7EQOVR4Q3BWSCPLOVZRMW4LR4743DAO5WXPKY6HR6HQ36WX4 |
| Publisher | GCM5SIFSH3ZB2BITJNP46SD7L4T2FPGNQJ3KHWG4RBHQTNG4PPKNUJQZ | SD5GLY7QYKCABX24PYAQ5HEU5GANESBIP4PO4T5UZPW55LN3VK22NBRT |
| Advertiser | GBYNUJTPNCVP6UDGYMRJMK4NY3WI7GNF5D2OLCWA5IJWPHXYCXLUNJE5 | SCDLQYN23ZNH2VDO4WJXHQBJKDRYOQN2ZBU7AUHEFCVHZGIQB5QWZQSX |

Each wallet has ~10,000 XLM + 20 USDC on Stellar testnet.

---

## Tech Stack

- **Monorepo:** pnpm + Turborepo
- **Framework:** Next.js 15 (App Router)
- **Blockchain:** Stellar testnet + Soroban
- **Payments:** x402 v2 protocol via `@x402/core`, `@x402/stellar`, `@x402/fetch`
- **Facilitator:** OpenZeppelin Channels (https://channels.openzeppelin.com/x402/testnet)
- **USDC:** CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA on testnet

---

## Economic Model

- **$0.01 USDC** per query (set by platform, not publisher)
- **Publisher earns** 0.7% of the advertiser's bid per query (paid from advertiser's session budget)
- **Platform takes** the remainder of the ad fee

The publisher receives USDC on-chain directly from the agent's payment. Publisher earnings in the platform dashboard are tracked for display only — the on-chain payment is the authoritative settlement.