export default async function handler(req, res) {
  const SOURCES = [
    "https://cdn.jsdelivr.net/gh/house-stock-watcher/data@main/data/all_transactions.json",
    "https://raw.githubusercontent.com/house-stock-watcher/data/main/data/all_transactions.json",
    "https://raw.githubusercontent.com/house-stock-watcher/data/refs/heads/main/data/all_transactions.json",
    "https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json",
  ];

  const results = [];
  for (const url of SOURCES) {
    const started = Date.now();
    try {
      const r = await fetch(url, {
        redirect: "follow",
        headers: {
          "User-Agent": "capitoltrades-proxy/1.0 (serverless; vercel)",
          "Accept": "application/json,text/plain;q=0.9,*/*;q=0.8",
        },
      });
      const ms = Date.now() - started;
      results.push({
        url,
        ok: r.ok,
        status: r.status,
        ms,
        sample: r.ok ? (await r.text()).slice(0, 60) : "",
      });
    } catch (e: any) {
      const ms = Date.now() - started;
      results.push({ url, ok: false, status: 0, ms, error: e?.message || String(e) });
    }
  }

  res.status(200).json({ ok: true, results });
}
