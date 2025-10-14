// /api/trades.ts
// Free source: House Stock Watcher (public S3 JSON)

type HSWTTrade = {
  TransactionDate?: string;   // "2025-09-21"
  DisclosureDate?: string;    // may be missing
  Owner?: string;
  Ticker?: string;
  AssetName?: string;
  Type?: string;              // "Purchase" | "Sale" | "Exchange"
  Amount?: string;            // "$1,001 - $15,000"
  Representative?: string;    // "Pelosi, Nancy"
  District?: string;
  State?: string;
  Party?: string;
  CapGainsOver200USD?: boolean;
};

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, "http://x");
    const ticker = (url.searchParams.get("ticker") || "").toUpperCase();
    const since = url.searchParams.get("since"); // YYYY-MM-DD
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));

    // Public dataset (House of Representatives)
    const HSW_URL = "https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json";

    const r = await fetch(HSW_URL, { next: { revalidate: 1800 } }); // cache 30 min
    if (!r.ok) throw new Error(`HouseStockWatcher returned ${r.status}`);
    const raw = (await r.json()) as HSWTTrade[];

    // Filter
    let items = raw;
    if (ticker) items = items.filter(t => (t.Ticker || "").toUpperCase() === ticker);

    if (since) {
      const cut = new Date(since + "T00:00:00Z").getTime();
      items = items.filter(t => {
        const d = t.TransactionDate || t.DisclosureDate || "";
        const ts = d ? new Date(d + "T00:00:00Z").getTime() : 0;
        return ts >= cut;
      });
    }

    // Sort newest first
    items.sort((a, b) => {
      const da = new Date((a.TransactionDate || a.DisclosureDate || "1970-01-01") + "T00:00:00Z").getTime();
      const db = new Date((b.TransactionDate || b.DisclosureDate || "1970-01-01") + "T00:00:00Z").getTime();
      return db - da;
    });

    // Limit & normalize a bit
    const trades = items.slice(0, limit).map(t => ({
      disclosure_date: t.DisclosureDate || null,
      transaction_date: t.TransactionDate || null,
      representative: t.Representative || null,
      ticker: t.Ticker || null,
      asset: t.AssetName || null,
      transaction: t.Type || null,
      amount: t.Amount || null,
      party: t.Party || null,
      state: t.State || null,
      house_only: true
    }));

    res.status(200).json({
      ok: true,
      source: "House Stock Watcher (public)",
      count: trades.length,
      trades
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "failed" });
  }
}
