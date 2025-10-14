// /api/trades.ts
// Free public version (no API key required)
// Fetches congressional trade data from Capitol Trades' public endpoint

export default async function handler(req, res) {
  try {
    // Read query params
    const url = new URL(req.url, "http://x");
    const ticker = (url.searchParams.get("ticker") || "").toUpperCase();
    const since = url.searchParams.get("since");
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));

    // Fetch from Capitol Trades JSON feed (free and public)
    const apiUrl = "https://www.capitoltrades.com/trades.json";
    const response = await fetch(apiUrl, { next: { revalidate: 300 } }); // cache 5 min

    if (!response.ok) {
      throw new Error(`CapitolTrades returned ${response.status}`);
    }

    const data = await response.json();

    // Optional filters
    let trades = Array.isArray(data) ? data : [];

    if (ticker) {
      trades = trades.filter((t) => (t.Ticker || "").toUpperCase() === ticker);
    }

    if (since) {
      const sinceDate = new Date(since + "T00:00:00Z");
      trades = trades.filter((t) => {
        const d = t.TransactionDate || t.DisclosureDate;
        return d && new Date(d + "T00:00:00Z") >= sinceDate;
      });
    }

    // Sort newest first
    trades.sort((a, b) => {
      const da = new Date(a.TransactionDate || a.DisclosureDate || 0).getTime();
      const db = new Date(b.TransactionDate || b.DisclosureDate || 0).getTime();
      return db - da;
    });

    // Limit results
    trades = trades.slice(0, limit);

    // Send response
    res.status(200).json({
      ok: true,
      count: trades.length,
      trades,
      source: "capitoltrades.com (public)",
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message || "Failed to fetch data",
    });
  }
}
