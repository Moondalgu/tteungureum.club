"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePersistentToggle } from "@/lib/usePersistentToggle";
import type { Topic } from "@/lib/types";

export function TopicList({
  initialTopics,
  isLoggedIn,
}: {
  initialTopics: Topic[];
  isLoggedIn: boolean;
}) {
  const supabase = createClient();

  const [topics, setTopics] = useState<Topic[]>(initialTopics);
  const [hideDone, setHideDone] = usePersistentToggle("hideDoneTopics", true);
  const [adding, setAdding] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [error, setError] = useState("");

  const visible = useMemo(
    () => (hideDone ? topics.filter((t) => t.status !== "done") : topics),
    [topics, hideDone]
  );

  async function addTopic() {
    const content = newContent.trim();
    if (!content) return;
    setError("");
    const { data, error } = await supabase
      .from("topics")
      .insert({ content, author: "직접추가", status: "pending" })
      .select("id, author, content, source_date, status, created_at")
      .single();
    if (error) {
      setError(`추가 실패: ${error.message}`);
      return;
    }
    setTopics((prev) => [data as Topic, ...prev]);
    setNewContent("");
    setAdding(false);
  }

  return (
    <>
      {/* 필터 / 추가 바 */}
      <div className="row spread" style={{ marginBottom: 12 }}>
        <label className="row small">
          <input
            type="checkbox"
            checked={hideDone}
            onChange={(e) => setHideDone(e.target.checked)}
          />
          진행 완료한 주제 숨기기
        </label>
        {isLoggedIn && (
          <button className="btn primary" onClick={() => setAdding((v) => !v)}>
            + 주제 추가
          </button>
        )}
      </div>

      {adding && (
        <div className="card" style={{ marginBottom: 12, display: "grid", gap: 10 }}>
          <textarea
            className="field"
            rows={2}
            placeholder="새 뜬구름 주제를 입력하세요"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
          />
          {error && <span className="small err">{error}</span>}
          <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
            <button className="btn" onClick={() => setAdding(false)}>
              취소
            </button>
            <button className="btn primary" onClick={addTopic}>
              추가
            </button>
          </div>
        </div>
      )}

      {/* 주제 리스트 */}
      {visible.length === 0 ? (
        <p className="muted">아직 주제가 없습니다. 카톡 공지 댓글이나 + 버튼으로 채워보세요.</p>
      ) : (
        visible.map((t) => {
          const isDone = t.status === "done";
          const isSelected = t.status === "selected";
          return (
            <div key={t.id} className="topic">
              <span style={{ fontSize: 18 }}>{isDone ? "✔" : "☁"}</span>
              <div>
                <div className="content">{t.content}</div>
                <div className="row meta" style={{ gap: 10 }}>
                  <span>{t.author}</span>
                  <span>{(t.source_date ?? t.created_at)?.slice(0, 10)}</span>
                  {isDone && <span className="badge done">✔ 진행완료</span>}
                  {isSelected && <span className="badge selected">방에 담김</span>}
                </div>
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
