// /api/trades.ts
// Free congressional trades with robust multi-source fallback (no API key)

type Trade = {
  TransactionDate?: string;
  DisclosureDate?: string;
  Representative?: string;
  Ticker?: string;
  AssetName?: string;
  Type?: string;
  Amount?: string;
  Party?: string;
  State?: string;
};

const SOURCES = [
  // 1) Primary GitHub mirror
  "https://raw.githubusercontent.com/house-stock-watcher/data/main/data/all_transactions.json",
  // 2) Alternate GitHub mirror (older repo name)
  "https://raw.githubusercontent.com/house-stock-watcher/house-stock-watcher-data/main/data/all_transactions.json",
  // 3) Original S3 bucket (sometimes blocks direct browser; works from serverless)
  "https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json",
];

async function fetchFirstAvailable(): Promise<Trade[]> {
  let lastErr: Error | null = null;
  for (const url of SOURCES) {
    try {
      const resp = await fetch(url, {
        // cache at the edge for 30 min to be nice to the public mirrors
        next: { revalidate: 1800 },
        headers: {
          // a UA helps with some strict mirrors
          "User-Agent": "capitoltrades-proxy/1.0 (serverless; vercel)",
          "Accept": "application/json,text/plain;q=0.9,*/*;q=0.8",
        },
      });
      if (!resp.ok) {
        lastErr = new Error(`Source ${url} returned ${resp.status}`);
        continue;
      }
      const json = await resp.json();
      if (Array.isArray(json)) return json as Trade[];
      lastErr = new Error(`Source ${url} returned non-array payload`);
    } catch (e: any) {
      lastErr = e;
      continue;
    }
  }
  throw lastErr ?? new Error("All sources failed");
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, "http://x");
    const ticker = (url.searchParams.get("ticker") || "").toUpperCase();
    const since = url.searchParams.get("since");
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));

    const raw = await fetchFirstAvailable();

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
      disclosure_date: t.DisclosureDate ?? null,
      transaction_date: t.TransactionDate ?? null,
      representative: t.Representative ?? null,
      ticker: t.Ticker ?? null,
      asset: t.AssetName ?? null,
      transaction: t.Type ?? null,
      amount: t.Amount ?? null,
      party: t.Party ?? null,
      state: t.State ?? null,
      chamber: "House",
    }));

    res.status(200).json({
      ok: true,
      source: "House Stock Watcher (multi-source)",
      count: trades.length,
      trades,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "failed" });
  }
}
