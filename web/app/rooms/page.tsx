import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Room } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RoomsPage() {
  const supabase = await createClient();
  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, title, date, mode, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="container">
      <h1>방 목록</h1>
      {(!rooms || rooms.length === 0) && (
        <p className="muted">아직 만들어진 방이 없습니다. 모임 날짜가 확정되면 방이 열려요.</p>
      )}
      <div style={{ display: "grid", gap: 10 }}>
        {(rooms as Room[] | null)?.map((r) => (
          <Link key={r.id} href={`/rooms/${r.id}`} className="card row spread">
            <div>
              <div style={{ fontWeight: 600 }}>{r.title}</div>
              <div className="meta small muted">
                📅 {r.date} · {r.mode === "online" ? "온라인" : "오프라인"}
              </div>
            </div>
            <span className="badge">입장 →</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
