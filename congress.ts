
// api/tickers/[sym]/congress.ts
import { supabase, ok, allowOptions } from "../../../lib/db";

export default async function handler(req: Request) {
  const pre = allowOptions(req); if (pre) return pre;
  const parts = new URL(req.url).pathname.split("/"); // /api/tickers/:sym/congress
  const sym = decodeURIComponent(parts[3] || "");

  const { data: trades } = await supabase.from("trades")
    .select("*, disclosures!inner(politician_id, politicians!inner(name,party,chamber,state))")
    .eq("mapped_ticker", sym)
    .order("trade_date", { ascending: false })
    .limit(100);

  const { data: metrics } = await supabase.from("trade_metrics")
    .select("*")
    .in("trade_id", (trades || []).map((t: any) => t.id));

  const out = (trades || []).map((t: any) => ({
    ...t,
    politician: t.disclosures?.politicians ? {
      id: t.disclosures.politician_id,
      name: t.disclosures.politicians.name,
      party: t.disclosures.politicians.party,
      chamber: t.disclosures.politicians.chamber,
      state: t.disclosures.politicians.state
    } : undefined
  }));

  return ok(null as any, { ticker: sym, trades: out, metrics: metrics || [] });
}
