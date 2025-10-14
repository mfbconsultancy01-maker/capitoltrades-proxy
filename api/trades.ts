// /api/trades.ts
// Free congressional trades with resilient multi-source fallback (no API key)
// + verbose debugging so we can see what's failing in Vercel logs

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
  "https://cdn.jsdelivr.net/gh/house-stock-watcher/data@main/data/all_transactions.json",
  "https://raw.githubusercontent.com/house-stock-watcher/data/main/data/all_transactions.json",
  "https://raw.githubusercontent.com/house-stock-watcher/data/refs/heads/main/data/all_transactions.json",
  "https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json",
];

async function fetchFirstAvailable(debug: string[]): Promise<{ data: Trade[]; source: string }> {
  let lastErr: Error | null = null;

  for (const url of SOURCES) {
    try {
      debug.push(`TRY ${url}`);
      const resp = await fetch(url, {
        next: { revalidate: 1800 },
        redirect: "follow",
        headers: {
          "User-Agent": "capitoltrades-proxy/1.0 (serverless; vercel)",
          "Accept": "application/json,text/plain;q=0.9,*/*;q=0.8",
          "Cache-Control": "no-cache",
        },
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        lastErr = new Error(`Source ${url} returned ${resp.status} ${resp.statusText} ${txt?.slice(0,120)}`);
        debug.push(lastErr.message);
        continue;
      }

      const json = await resp.json();
      if (Array.isArray(json)) {
        debug.push(`OK ${url}`);
        return { data: json as Trade[], source: url };
      }
      lastErr = new Error(`Source ${url} returned non-array payload`);
      debug.push(lastErr.message);
    } catch (e: any) {
      lastErr = e;
      debug.push(`ERR ${url}: ${e?.message || e}`);
      continue;
    }
  }

  throw lastErr ?? new Error("All sources failed");
}

export default async function handler(req, res) {
  const debug: string[] = [];
  try {
    const url = new URL(req.url, "http://x");
    const ticker = (url.searchParams.get("ticker") || "").toUpperCase();
    const since = url.searchParams.get("since");
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));

    const { data: raw, source } = await fetchFirstAvailable(debug);

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

    // Limit & light normalize
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

    // Emit debug to Vercel logs
    console.log("[/api/trades] debug:", debug);

    res.status(200).json({ ok: true, source, count: trades.length, trades });
  } catch (err: any) {
    console.error("[/api/trades] error:", err?.message, "debug:", debug);
    res.status(500).json({ ok: false, error: err?.message || "failed", debug });
  }
}
