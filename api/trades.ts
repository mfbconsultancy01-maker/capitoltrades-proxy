
// api/trades.ts
import { supabase, ok, bad, allowOptions } from "../lib/db";

export default async function handler(req: Request) {
  const pre = allowOptions(req); if (pre) return pre;
  const url = new URL(req.url);
  const since = url.searchParams.get("since");
  const ticker = url.searchParams.get("ticker");
  const politician = url.searchParams.get("politician");
  const limit = Number(url.searchParams.get("limit") || 50);

  let q = supabase.from("trades")
    .select("*, disclosures!inner(*, politicians!inner(*))")
    .order("trade_date", { ascending: false })
    .limit(limit);

  if (since) q = q.gte("trade_date", since.slice(0,10));
  if (ticker) q = q.eq("mapped_ticker", ticker);
  if (politician) q = q.eq("disclosures.politician_id", politician);

  const { data, error } = await q;
  if (error) return bad(500, error.message);

  const trades = (data || []).map((t: any) => ({
    id: t.id,
    disclosure_id: t.disclosure_id,
    trade_date: t.trade_date,
    owner: t.owner,
    asset_type: t.asset_type,
    issuer_raw: t.issuer_raw,
    mapped_ticker: t.mapped_ticker,
    txn: t.txn,
    amount_min: t.amount_min,
    amount_max: t.amount_max,
    notes: t.notes,
    politician: t.disclosures?.politicians ? {
      id: t.disclosures.politicians.id,
      name: t.disclosures.politicians.name,
      party: t.disclosures.politicians.party,
      chamber: t.disclosures.politicians.chamber,
      state: t.disclosures.politicians.state
    } : undefined
  }));

  return ok(null as any, { trades });
}
