
// api/politicians/[id].ts
import { supabase, ok, bad, allowOptions } from "../../lib/db";

export default async function handler(req: Request) {
  const pre = allowOptions(req); if (pre) return pre;
  const id = new URL(req.url).pathname.split("/").pop()!;

  const { data: pol, error: e1 } = await supabase.from("politicians").select("*").eq("id", id).single();
  if (e1) return bad(404, "politician not found");

  const { data: disc } = await supabase.from("disclosures").select("*").eq("politician_id", id).order("filed_at", { ascending: false }).limit(20);
  const discIds = (disc || []).map(d => d.id);
  let trades: any[] = [];
  if (discIds.length) {
    const r = await supabase.from("trades").select("*")
      .in("disclosure_id", discIds)
      .order("trade_date", { ascending: false })
      .limit(50);
    trades = r.data || [];
  }

  return ok(null as any, {
    politician: pol,
    disclosures: disc || [],
    recent_trades: trades
  });
}
