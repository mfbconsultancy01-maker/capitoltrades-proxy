
// api/health.ts
import { ok } from "../lib/db";
export default async function handler() {
  return ok(null as any, { ok: true, service: "capitoltrades-proxy" });
}
