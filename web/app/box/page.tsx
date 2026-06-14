import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { TopicList } from "@/components/TopicList";
import type { Topic } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BoxPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { data: topics } = await supabase
    .from("topics")
    .select("id, author, content, source_date, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="container">
      <div className="row spread" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="sparkle" style={{ margin: 0 }}>
            N의 상자
          </h1>
          <p className="muted small" style={{ margin: "4px 0 0" }}>
            카톡 공지 댓글로 모인 뜬구름 주제들. 방에서 골라 토론해요.
          </p>
        </div>
      </div>
      <TopicList initialTopics={(topics ?? []) as Topic[]} isLoggedIn={!!user} />
    </main>
  );
}
