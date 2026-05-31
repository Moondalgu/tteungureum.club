"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MAX_TOPICS_PER_ROOM, type RoomTopic, type Topic } from "@/lib/types";

export function RoomTopics({
  roomId,
  initialTopics,
  boxTopics,
  isLoggedIn,
}: {
  roomId: number;
  initialTopics: RoomTopic[];
  boxTopics: Topic[];
  isLoggedIn: boolean;
}) {
  const supabase = createClient();

  const [items, setItems] = useState<RoomTopic[]>(initialTopics);
  const [box, setBox] = useState<Topic[]>(boxTopics);
  const [showBox, setShowBox] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [error, setError] = useState("");

  const usedTopicIds = new Set(items.map((i) => i.topic_id).filter(Boolean));
  const availableBox = box.filter((t) => !usedTopicIds.has(t.id));

  async function toggleDone(rt: RoomTopic) {
    if (!isLoggedIn) return;
    const next = !rt.done;
    setItems((prev) =>
      prev.map((i) => (i.id === rt.id ? { ...i, done: next } : i))
    );
    const { error } = await supabase
      .from("room_topics")
      .update({ done: next })
      .eq("id", rt.id);
    if (error) setError(`상태 변경 실패: ${error.message}`);

    // 원본 N의 상자 주제도 done 동기화
    if (rt.topic_id) {
      await supabase
        .from("topics")
        .update({ status: next ? "done" : "selected" })
        .eq("id", rt.topic_id);
    }
  }

  async function addFromBox(t: Topic) {
    if (!isLoggedIn) return setError("로그인이 필요합니다.");
    if (items.length >= MAX_TOPICS_PER_ROOM)
      return setError(`주제는 최대 ${MAX_TOPICS_PER_ROOM}개까지 담을 수 있어요.`);
    setError("");
    const position = items.length;
    const { data, error } = await supabase
      .from("room_topics")
      .insert({
        room_id: roomId,
        topic_id: t.id,
        content: t.content,
        author: t.author,
        position,
        done: false,
      })
      .select("id, room_id, topic_id, content, author, position, done")
      .single();
    if (error || !data) return setError(`담기 실패: ${error?.message ?? ""}`);

    setItems((prev) => [...prev, data as RoomTopic]);
    setBox((prev) => prev.filter((b) => b.id !== t.id));
    await supabase.from("topics").update({ status: "selected" }).eq("id", t.id);
  }

  async function addSelfMade() {
    const content = newContent.trim();
    if (!content) return;
    if (!isLoggedIn) return setError("로그인이 필요합니다.");
    if (items.length >= MAX_TOPICS_PER_ROOM)
      return setError(`주제는 최대 ${MAX_TOPICS_PER_ROOM}개까지 담을 수 있어요.`);
    setError("");
    const position = items.length;
    const { data, error } = await supabase
      .from("room_topics")
      .insert({
        room_id: roomId,
        topic_id: null,
        content,
        author: "방에서 추가",
        position,
        done: false,
      })
      .select("id, room_id, topic_id, content, author, position, done")
      .single();
    if (error || !data) return setError(`추가 실패: ${error?.message ?? ""}`);
    setItems((prev) => [...prev, data as RoomTopic]);
    setNewContent("");
  }

  async function remove(rt: RoomTopic) {
    if (!isLoggedIn) return;
    setItems((prev) => prev.filter((i) => i.id !== rt.id));
    await supabase.from("room_topics").delete().eq("id", rt.id);
    if (rt.topic_id) {
      await supabase
        .from("topics")
        .update({ status: "pending" })
        .eq("id", rt.topic_id);
      // 다시 박스 후보로 복귀
      setBox((prev) =>
        prev.some((b) => b.id === rt.topic_id)
          ? prev
          : [
              {
                id: rt.topic_id!,
                author: rt.author,
                content: rt.content,
                source_date: null,
                status: "pending",
                created_at: new Date().toISOString(),
              },
              ...prev,
            ]
      );
    }
  }

  return (
    <section style={{ marginBottom: 20 }}>
      <div className="row spread" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>주제 ({items.length})</h3>
        {isLoggedIn && (
          <button className="btn cyan" onClick={() => setShowBox((v) => !v)}>
            N의 상자에서 꺼내기
          </button>
        )}
      </div>

      {/* N의 상자 picker */}
      {showBox && (
        <div className="card" style={{ marginBottom: 12 }}>
          {availableBox.length === 0 ? (
            <p className="muted small" style={{ margin: 0 }}>
              꺼낼 수 있는 주제가 없어요.
            </p>
          ) : (
            <div className="grid">
              {availableBox.map((t) => (
                <div key={t.id} className="row spread">
                  <span className="small">{t.content}</span>
                  <button className="btn" onClick={() => addFromBox(t)}>
                    + 담기
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 담긴 주제 리스트 */}
      {items.length === 0 ? (
        <p className="muted">아직 담긴 주제가 없어요. 위에서 꺼내거나 직접 추가하세요.</p>
      ) : (
        items.map((rt, i) => (
          <div key={rt.id} className={`topic ${rt.done ? "" : ""}`}>
            <input
              className="checkbox"
              type="checkbox"
              checked={rt.done}
              disabled={!isLoggedIn}
              onChange={() => toggleDone(rt)}
            />
            <div>
              <div
                className="content"
                style={{ textDecoration: rt.done ? "line-through" : "none", opacity: rt.done ? 0.6 : 1 }}
              >
                {i + 1}. {rt.content}
              </div>
              <div className="row meta" style={{ gap: 10 }}>
                <span>✍️ {rt.author}</span>
                {rt.done && <span className="badge done">✔ 진행완료</span>}
                {isLoggedIn && (
                  <button
                    className="small"
                    style={{
                      border: "none",
                      background: "none",
                      color: "var(--pink-deep)",
                      cursor: "pointer",
                      padding: 0,
                    }}
                    onClick={() => remove(rt)}
                  >
                    빼기
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      )}

      {/* 자체 생성 */}
      {isLoggedIn && (
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <input
            className="field"
            placeholder="방에서 바로 주제 추가"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSelfMade()}
          />
          <button className="btn primary" onClick={addSelfMade}>
            추가
          </button>
        </div>
      )}

      {error && <p className="small" style={{ color: "var(--pink-deep)" }}>{error}</p>}
    </section>
  );
}
