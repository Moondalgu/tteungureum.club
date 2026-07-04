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
      <TopicList initialTopics={(topics ?? []) as Topic[]} isLoggedIn={!!user} />
    </main>
  );
}
