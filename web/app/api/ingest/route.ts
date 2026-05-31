import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/server";

// 카톡 수집기(reader)가 POST 로 주제를 보내는 엔드포인트.
// 인증: Authorization: Bearer <INGEST_SECRET>
// body: { author, content, source_date? }  또는  { items: [...] }
export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!process.env.INGEST_SECRET || token !== process.env.INGEST_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const raw = Array.isArray((body as any)?.items)
    ? (body as any).items
    : [body];

  const rows = raw
    .map((it: any) => {
      const author = String(it?.author ?? "익명").slice(0, 100).trim();
      const content = String(it?.content ?? "").trim();
      if (!content) return null;
      const source_date = it?.source_date ?? null;
      const msg_hash = createHash("sha256")
        .update(`${author}::${content}`)
        .digest("hex");
      return { author, content, source_date, msg_hash, status: "pending" };
    })
    .filter(Boolean);

  if (rows.length === 0) {
    return NextResponse.json({ error: "no content" }, { status: 400 });
  }

  const admin = createAdminClient();
  // msg_hash 중복은 무시(멱등)
  const { data, error } = await admin
    .from("topics")
    .upsert(rows, { onConflict: "msg_hash", ignoreDuplicates: true })
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ inserted: data?.length ?? 0 });
}
