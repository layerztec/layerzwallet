import {
  Stack,
  H1,
  H2,
  Text,
  Table,
  Stat,
  Grid,
  Pill,
  Code,
  Callout,
  Divider,
} from "cursor/canvas";

type Status = "Full" | "Partial" | "Missing";

interface Cap {
  cap: string;
  status: Status;
  tool: string | null;
  networks: string;
  gap: string;
}

function StatusPill({ status }: { status: Status }) {
  if (status === "Full")
    return (
      <Pill tone="success" active size="sm">
        Full
      </Pill>
    );
  if (status === "Partial")
    return (
      <Pill tone="warning" active size="sm">
        Partial
      </Pill>
    );
  return (
    <Pill tone="neutral" size="sm">
      Missing
    </Pill>
  );
}

function rowToneFor(s: Status): "success" | "warning" | undefined {
  if (s === "Full") return "success";
  if (s === "Partial") return "warning";
  return undefined;
}

function CapTable({ rows }: { rows: Cap[] }) {
  return (
    <Table
      headers={[
        "Capability (in mobile app)",
        "Via MCP",
        "MCP tool",
        "Networks via MCP",
        "Gap vs mobile app",
      ]}
      columnAlign={["left", "left", "left", "left", "left"]}
      rowTone={rows.map((r) => rowToneFor(r.status))}
      rows={rows.map((r) => [
        r.cap,
        <StatusPill status={r.status} />,
        r.tool ? <Code>{r.tool}</Code> : "—",
        r.networks,
        r.gap,
      ])}
    />
  );
}

const discovery: Cap[] = [
  {
    cap: "List supported networks",
    status: "Full",
    tool: "list_networks",
    networks: "7 mainnet",
    gap: "Parity (testnets/meta-layers intentionally hidden)",
  },
  {
    cap: "Read native balance",
    status: "Full",
    tool: "get_network_balance",
    networks: "bitcoin, rootstock, botanix, citrea, liquid, spark, stacks",
    gap: "Mainnet parity; testnets + meta-layers excluded",
  },
  {
    cap: "Token discovery / balances",
    status: "Partial",
    tool: "list_tokens",
    networks: "spark, stacks",
    gap: "Mobile also lists Liquid + EVM (rootstock/botanix/citrea) tokens",
  },
  {
    cap: "NFT discovery",
    status: "Full",
    tool: "list_nfts",
    networks: "spark, stacks",
    gap: "Parity (mobile NFTs are spark/stacks only)",
  },
  {
    cap: "Get receive address",
    status: "Partial",
    tool: "get_receive_address",
    networks: "spark, stacks",
    gap: "No bitcoin on-chain, EVM, or liquid addresses",
  },
  {
    cap: "Transaction history",
    status: "Missing",
    tool: null,
    networks: "—",
    gap: "Not exposed; agents can't read past activity (all networks in mobile)",
  },
  {
    cap: "BTC/USD exchange rate",
    status: "Full",
    tool: "get_btc_usd_rate",
    networks: "n/a",
    gap: "Parity for the headline pair",
  },
  {
    cap: "Other asset / token fiat rates",
    status: "Missing",
    tool: null,
    networks: "—",
    gap: "Mobile prices every asset; MCP only does BTC/USD",
  },
];

const payments: Cap[] = [
  {
    cap: "Send native BTC (on-chain UTXO)",
    status: "Missing",
    tool: null,
    networks: "—",
    gap: "Core send flow not reachable by agents",
  },
  {
    cap: "Send EVM native + ERC-20",
    status: "Missing",
    tool: null,
    networks: "—",
    gap: "rootstock/botanix/citrea are balance-read only via MCP",
  },
  {
    cap: "Send native Liquid (on-chain)",
    status: "Missing",
    tool: null,
    networks: "—",
    gap: "Liquid only reachable for Lightning via MCP",
  },
  {
    cap: "Send native account funds (Spark sats / Stacks sBTC)",
    status: "Missing",
    tool: null,
    networks: "—",
    gap: "Only tokens/Lightning/swap move funds via MCP",
  },
  {
    cap: "Transfer fungible token",
    status: "Partial",
    tool: "transfer_token",
    networks: "spark, stacks",
    gap: "Mobile also sends EVM + Liquid tokens",
  },
  {
    cap: "Transfer NFT",
    status: "Full",
    tool: "transfer_nft",
    networks: "spark, stacks",
    gap: "Parity (mobile NFT sends are spark/stacks)",
  },
];

const lightning: Cap[] = [
  {
    cap: "Create Lightning invoice",
    status: "Partial",
    tool: "create_lightning_invoice",
    networks: "spark, liquid",
    gap: "Mobile also creates ARK invoices",
  },
  {
    cap: "Check invoice paid",
    status: "Partial",
    tool: "is_invoice_paid",
    networks: "spark, liquid",
    gap: "No ARK",
  },
  {
    cap: "Pay BOLT11 invoice",
    status: "Partial",
    tool: "pay_lightning_invoice",
    networks: "spark, liquid",
    gap: "No ARK; 5% max-fee cap baked in",
  },
  {
    cap: "Pay Lightning Address / LNURL-pay",
    status: "Missing",
    tool: null,
    networks: "—",
    gap: "Agent must resolve LN-address/LNURL to a BOLT11 externally",
  },
  {
    cap: "LNURL-withdraw",
    status: "Missing",
    tool: null,
    networks: "—",
    gap: "Pull-payment flow not exposed",
  },
  {
    cap: "Persistent Lightning Address (receive)",
    status: "Missing",
    tool: null,
    networks: "—",
    gap: "Static @-address would be a natural agent identity",
  },
];

const swaps: Cap[] = [
  {
    cap: "Get swap quote",
    status: "Partial",
    tool: "get_swap_quote",
    networks: "spark (BTC <-> USDB)",
    gap: "Only Flashnet AMM pair; mobile has many pairs/providers",
  },
  {
    cap: "Execute swap",
    status: "Partial",
    tool: "execute_swap",
    networks: "spark (BTC <-> USDB)",
    gap: "Only Flashnet AMM pair (3% slippage cap)",
  },
  {
    cap: "Cross-chain transfers (Sideshift, Garden, Symbiosis, Spark Exit, Native Deposit)",
    status: "Missing",
    tool: null,
    networks: "—",
    gap: "The entire Transfer tab is unreachable except the one Spark pair",
  },
  {
    cap: "Boarding / deposit claim (ARK / Spark)",
    status: "Missing",
    tool: null,
    networks: "—",
    gap: "No claim/refund of inbound on-chain deposits",
  },
  {
    cap: "Yield / earn discovery",
    status: "Missing",
    tool: null,
    networks: "—",
    gap: "Spark USDB / Botanix yield options not surfaced",
  },
];

export default function MobileFeaturesVsMcp() {
  return (
    <Stack gap={20} style={{ padding: 24, maxWidth: 1100 }}>
      <Stack gap={6}>
        <H1>Mobile features vs. MCP exposure</H1>
        <Text tone="secondary">
          Every row is a capability that exists in the <Code>mobile</Code> app
          and that <Text weight="semibold">could and should</Text> be driven by
          an AI agent. UI-only / security-sensitive features are excluded (see
          bottom). MCP exposes <Text weight="semibold">13 tools</Text>, all
          scoped to the dedicated "AI Agent" pocket (account 4141).
        </Text>
        <Text size="small" tone="tertiary">
          Source: <Code>mobile/</Code> feature inventory +{" "}
          <Code>shared/features/mcp/modules/mcp-calls.ts</Code> · Layerz Wallet
          monorepo
        </Text>
      </Stack>

      <Grid columns={4} gap={12}>
        <Stat value="5" label="Full parity" tone="success" />
        <Stat value="8" label="Partial (limited scope)" tone="warning" />
        <Stat value="12" label="Missing (useful gap)" tone="danger" />
        <Stat value="25" label="MCP-relevant features" />
      </Grid>

      <Callout
        tone="info"
        title="Biggest opportunities (useful + feasible, not yet exposed)"
      >
        Read <Text weight="semibold">transaction history</Text>; generic{" "}
        <Text weight="semibold">on-chain / EVM / Liquid sends</Text>; the
        broader <Text weight="semibold">cross-chain Transfer tab</Text>{" "}
        (Sideshift / Garden / Symbiosis); and{" "}
        <Text weight="semibold">Lightning-address / LNURL payments</Text>. These
        are the high-value, agent-friendly gaps.
      </Callout>

      <Stack gap={8}>
        <H2>Discovery &amp; read-only queries</H2>
        <Text tone="secondary" size="small">
          Safe, no-funds-move operations an agent needs to orient itself.
        </Text>
        <CapTable rows={discovery} />
      </Stack>

      <Stack gap={8}>
        <H2>Payments &amp; transfers (moves funds)</H2>
        <Text tone="secondary" size="small">
          Sending value. MCP only moves funds via token transfer, NFT transfer,
          Lightning, or the one Spark swap.
        </Text>
        <CapTable rows={payments} />
      </Stack>

      <Stack gap={8}>
        <H2>Lightning</H2>
        <Text tone="secondary" size="small">
          Invoice lifecycle is the most complete MCP surface; address-based
          payments and ARK are still missing.
        </Text>
        <CapTable rows={lightning} />
      </Stack>

      <Stack gap={8}>
        <H2>Swaps / cross-chain / DeFi</H2>
        <Text tone="secondary" size="small">
          MCP exposes exactly one Spark AMM pair; the rest of the rich Transfer
          system is invisible to agents.
        </Text>
        <CapTable rows={swaps} />
      </Stack>

      <Divider />

      <Callout
        tone="neutral"
        title="Deliberately out of MCP scope (excluded from the matrix)"
      >
        <Stack gap={4}>
          <Text size="small">
            <Text weight="semibold">Security / human-in-the-loop:</Text> wallet
            create/import, seed backup &amp; recovery, password &amp; biometric
            unlock, "clear all data".
          </Text>
          <Text size="small">
            <Text weight="semibold">UI-only:</Text> dApp browser &amp; EIP-1193
            signing approvals, QR scanning, pocket switching, settings toggles,
            deep links, screen-capture protection.
          </Text>
          <Text size="small">
            <Text weight="semibold">External / KYC flow:</Text> fiat on-ramp
            ("Fund" / Onramper). Not feasible headlessly.
          </Text>
        </Stack>
      </Callout>
    </Stack>
  );
}
