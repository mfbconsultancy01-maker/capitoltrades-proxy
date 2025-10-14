// /api/trades.ts
// Free version (using the House Stock Watcher GitHub mirror)

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, "http://x");
    const ticker = (url.searchParams.get("ticker") || "").toUpperCase();
    const since = url.searchParams.get("since");
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));

    // ✅ Use the GitHub mirror instead of blocked S3 URL
    const GH_URL = "https://raw.githubusercontent.com/house-stock-watcher/data/main/data/all_transactions.json";

    const response = await fetch(GH_URL, { next: { revalidate: 1800 } }); // cache 30 min
    if (!response.ok) throw new Error(`HouseStockWatcher returned ${response.status}`);

    const data = await response.json();

    // Filter
    let trades = Array.isArray(data) ? data : [];
    if (ticker) trades = trades.filter(t => (t.Ticker || "").toUpperCase() === ticker);

    if (since) {
      const sinceDate = new Date(since + "T00:00:00Z").getTime();
      trades = trades.filter(t => {
        const d = t.TransactionDate || t.DisclosureDate;
        const ts = d ? new Date(d + "T00:00:00Z").getTime() : 0;
        return ts >= sinceDate;
      });
    }

    // Sort newest first
    trades.sort((a, b) => {
      const da = new Date(a.TransactionDate || a.DisclosureDate || 0).getTime();
      const db = new Date(b.TransactionDate || b.DisclosureDate || 0).getTime();
      return db - da;
    });

    // Limit and normalize
    trades = trades.slice(0, limit).map(t => ({
      disclosure_date: t.DisclosureDate || null,
      transaction_date: t.TransactionDate || null,
      representative: t.Representative || null,
      ticker: t.Ticker || null,
      asset: t.AssetName || null,
      transaction: t.Type || null,
      amount: t.Amount || null,
      party: t.Party || null,
      state: t.State || null,
    }));

    res.status(200).json({
      ok: true,
      source: "House Stock Watcher (GitHub mirror)",
      count: trades.length,
      trades,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || "Failed to fetch data" });
  }
}
