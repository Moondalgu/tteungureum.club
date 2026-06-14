import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { MeetingList } from "@/components/MeetingList";
import type { Meeting } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { data: meetings } = await supabase
    .from("meetings")
    .select(
      "id, title, description, mode, vote_deadline, status, confirmed_date, room_id, created_at"
    )
    .order("created_at", { ascending: false });

  return (
    <main className="container">
      <MeetingList
        initialMeetings={(meetings ?? []) as Meeting[]}
        isLoggedIn={!!user}
        defaultOpen={sp?.new === "1"}
      />
    </main>
  );
}
