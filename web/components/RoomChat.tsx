"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RoomMessage } from "@/lib/types";

// 방 채팅(DB 영구 저장 + 실시간). LiveKit 음성 연결과 무관하게 항상 동작한다.
// 초기 메시지는 서버에서 받아오고, 이후 room_messages INSERT 를 구독해 갱신한다.
export function RoomChat({
  roomId,
  userId,
  nickname,
  initialMessages,
  isLoggedIn,
  visible = true,
}: {
  roomId: number;
  userId: string | null;
  nickname: string | null;
  initialMessages: RoomMessage[];
  isLoggedIn: boolean;
  /** 모바일 탭 전환 등으로 표시 상태가 바뀔 때 스크롤을 다시 맞추기 위한 신호 */
  visible?: boolean;
}) {
  const [messages, setMessages] = useState<RoomMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const [supabase] = useState(() => createClient());

  // 새 메시지 도착/전송 시 로그 컨테이너만 맨 아래로(페이지 점프 방지).
  // display:none 상태에선 scrollHeight 가 0이라 무효 — visible 이 true 로
  // 바뀌는 순간(모바일 채팅 탭 진입) 다시 실행해 최신 메시지로 맞춘다.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, visible]);

  // 실시간 구독: 이 방의 새 메시지 INSERT
  useEffect(() => {
    const ch = supabase
      .channel(`room-messages-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const m = payload.new as RoomMessage;
          setMessages((prev) =>
            prev.some((x) => x.id === m.id) ? prev : [...prev, m]
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [roomId, supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending || !userId) return;
    setSending(true);
    setText("");
    const { error } = await supabase.from("room_messages").insert({
      room_id: roomId,
      user_id: userId,
      name: nickname || "익명",
      content: t,
    });
    setSending(false);
    if (error) setText(t); // 실패 시 입력 복원
  }

  return (
    <div className="card">
      <h4 style={{ margin: "0 0 10px" }}>💬 채팅</h4>
      <div className="chat-log" ref={logRef}>
        {messages.length === 0 && (
          <div className="muted small">아직 메시지가 없어요.</div>
        )}
        {messages.map((m) => (
          <div key={m.id} className="m">
            <strong>{m.name}</strong>: {m.content}
          </div>
        ))}
      </div>
      {isLoggedIn ? (
        <form className="row chat-form" style={{ gap: 6, marginTop: 8 }} onSubmit={onSubmit}>
          <input
            className="field"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="메시지 입력..."
          />
          <button className="btn primary sm" type="submit" disabled={sending}>
            전송
          </button>
        </form>
      ) : (
        <div className="muted small" style={{ marginTop: 8 }}>
          로그인하면 채팅에 참여할 수 있어요.
        </div>
      )}
    </div>
  );
}
