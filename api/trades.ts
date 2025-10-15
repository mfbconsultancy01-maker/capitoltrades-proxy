// /api/trades.ts
// Uses Senate GitHub + local fallback + Twelve Data price enrichment (auto key)

type Trade = {
  chamber: string;
  politician: string;
  ticker: string;
  asset_description: string;
  transaction_date: string;
  filed_date: string;
  type: string;
  amount: string;
  source: string;
  price?: number;
  price_time?: string;
};

export const config = { api: { bodyParser: false } };

export default async function handler(req: any, res: any) {
  const { limit = "50", since, enrich } = req.query;

  const toNum = (x: any, d = 50) => {
    const n = Number(x);
    return Number.isFinite(n) ? n : d;
  };
  const lim = Math.max(1, Math.min(200, toNum(limit)));

  const wantPrices = String(enrich || "").toLowerCase() === "prices";

  // ✅ your Twelve Data API key here
  const twelveKey = "628319d95d9c4bd78fc59295e04f4ca6";

  async function tryJson(u: string, ms = 8000, headers: Record<string, string> = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(u, {
        signal: ctrl.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "base44-dashboard/1.0 (+vercel)",
          "Accept": "application/json,text/plain;q=0.9,*/*;q=0.8",
          ...headers,
        },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } finally {
      clearTimeout(t);
    }
  }

  const attempts: Array<{ url: string; ok?: boolean; error?: string }> = [];
  let aggregated: Trade[] = [];

  // 1) Senate GitHub aggregate
  try {
    const url =
      "https://raw.githubusercontent.com/timothycarambat/senate-stock-watcher-data/master/aggregate/all_transactions.json";
    const raw = await tryJson(url, 9000);
    const rows = (Array.isArray(raw) ? raw : []).map((r: any): Trade => ({
      chamber: "Senate",
      politician: String(r.senator || ""),
      ticker: r.ticker || "--",
      asset_description: r.asset_description || "",
      transaction_date: r.transaction_date,
      filed_date: r.disclosure_date,
      type: r.type,
      amount: r.amount,
      source: "senate-github",
    }));
    aggregated = aggregated.concat(rows);
    attempts.push({ url, ok: true });
  } catch (e: any) {
    attempts.push({
      url: "senate-github:aggregate/all_transactions.json",
      error: String(e?.message || e),
    });
  }

  // 2) Filter + sort
  if (since) {
    const s = new Date(String(since));
    if (!isNaN(s.getTime())) {
      aggregated = aggregated.filter(
        (x) =>
          new Date(x.filed_date || x.transaction_date || 0) >= s ||
          new Date(x.transaction_date || x.filed_date || 0) >= s
      );
    }
  }

  aggregated.sort((a, b) => {
    const ts = (x: Trade) =>
      new Date(x.filed_date || x.transaction_date || 0).getTime();
    return ts(b) - ts(a);
  });

  // 3) Local fallback
  if (aggregated.length === 0) {
    try {
      const sample = await import("../data/sample_trades.json");
      aggregated = (sample as any).default || (sample as any);
      attempts.push({ url: "local:../data/sample_trades.json", ok: true });
    } catch (e: any) {
      return res.status(502).json({
        ok: false,
        error: "All live sources failed and local sample not found.",
        attempts,
      });
    }
  }

  // 4) Price enrichment (Twelve Data)
  if (wantPrices && twelveKey) {
    try {
      const uniq = Array.from(
        new Set(
          aggregated
            .map((t) => (t.ticker || "").trim().toUpperCase())
            .filter((t) => t && t !== "--")
        )
      ).slice(0, 50);

      if (uniq.length > 0) {
        const url =
          "https://api.twelvedata.com/quote?symbol=" +
          encodeURIComponent(uniq.join(",")) +
          `&apikey=${encodeURIComponent(twelveKey)}`;

        const quotes = await tryJson(url, 9000);
        const map: Record<string, { price?: number; datetime?: string }> = {};

        if (Array.isArray(quotes?.data)) {
          for (const q of quotes.data) {
            const price = Number(q.close ?? q.price ?? q.last ?? q.prev_close);
            if (q.symbol && Number.isFinite(price)) {
              map[String(q.symbol).toUpperCase()] = {
                price,
                datetime: q.datetime || q.timestamp,
              };
            }
          }
        } else {
          for (const [sym, q] of Object.entries(quotes)) {
            const price = Number((q as any).close ?? (q as any).price ?? (q as any).last);
            if (Number.isFinite(price)) {
              map[sym.toUpperCase()] = {
                price,
                datetime: (q as any).datetime || (q as any).timestamp,
              };
            }
          }
        }

        aggregated = aggregated.map((t) => {
          const hit = map[(t.ticker || "").toUpperCase()];
          return hit ? { ...t, price: hit.price, price_time: hit.datetime } : t;
        });

        attempts.push({ url: "twelvedata:/quote batch", ok: true });
      }
    } catch (e: any) {
      attempts.push({ url: "twelvedata:/quote batch", error: String(e?.message || e) });
    }
  }

  const data = aggregated.slice(0, lim);
  return res.status(200).json({ ok: true, count: data.length, data, attempts });
}
