
// imports/ptr.ts
import { supabase, ok, bad, allowOptions } from "../lib/db";
import { z } from "zod";

const Body = z.object({
  source_url: z.string().url().optional(),
  file_base64: z.string().optional(),
  notes: z.string().optional()
});

export default async function handler(req: Request) {
  const pre = allowOptions(req); if (pre) return pre;
  if (req.method !== "POST") return bad(405, "POST only");

  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) return bad(400, parsed.error.message);

  // Minimal create of a disclosure row; parsing the PDF happens in a separate worker.
  const politician_id = "pol_demo"; // TODO: resolve real owner from parsing or selection
  const disclosure_id = `disc_${crypto.randomUUID()}`;
  const filed_at = new Date().toISOString();

  const { error } = await supabase.from("disclosures").insert([{
    id: disclosure_id,
    politician_id,
    source: parsed.data.source_url ? "manual:url" : "manual:upload",
    filed_at,
    type: "PTR",
    pdf_url: parsed.data.source_url || null,
    sha256: null
  }]);
  if (error) return bad(500, error.message);

  return ok(null as any, { disclosure_id });
}
