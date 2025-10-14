
// api/news.ts
import { ok, bad, allowOptions } from "../lib/db";

export default async function handler(req: Request) {
  const pre = allowOptions(req); if (pre) return pre;
  const url = new URL(req.url);
  const entity = url.searchParams.get("entity") || "";
  if (!entity) return bad(400, "entity required");
  // TODO: wire to GDELT/NewsAPI later
  return ok(null as any, { items: [] });
}
