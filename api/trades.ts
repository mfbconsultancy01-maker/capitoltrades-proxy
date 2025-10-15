const SOURCE = "https://raw.githubusercontent.com/unusualwhales/congress-trades/main/transactions.json";

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, "http://x");
    const ticker = (url.searchParams.get("ticker") || "").toUpperCase();
    const since = url.searchParams.get("since");
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));

    const r = await fetch(SOURCE, { next: { revalidate: 1800 } });
    if (!r.ok) throw new Error(`source returned ${r.status}`);

    let trades = await r.json();
    if (!Array.isArray(trades)) trades = [];

    if (ticker) trades = trades.filter(t => (t.Ticker || "").toUpperCase() === ticker);
    if (since) {
      const cut = new Date(since + "T00:00:00Z").getTime();
      trades = trades.filter(t => {
        const d = t.TransactionDate || t.DisclosureDate || "";
        return d && new Date(d + "T00:00:00Z").getTime() >= cut;
      });
    }

    trades.sort((a, b) => {
      const da = new Date(a.TransactionDate || a.DisclosureDate || 0).getTime();
      const db = new Date(b.TransactionDate || b.DisclosureDate || 0).getTime();
      return db - da;
    });

    res.status(200).json({
      ok: true,
      source: SOURCE,
      count: Math.min(trades.length, limit),
      trades: trades.slice(0, limit),
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "failed" });
  }
}
