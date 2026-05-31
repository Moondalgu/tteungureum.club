"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const PRESETS = [1, 3, 5, 10]; // 분

function fmt(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function Countdown({ roomId }: { roomId: number }) {
  // endsAt: 종료 시각(epoch ms). null 이면 정지.
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [minutes, setMinutes] = useState(5);
  const channelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  // 1초 틱
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // 실시간 동기화: 같은 방의 모두가 동일 종료시각 공유
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`timer-${roomId}`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "set" }, ({ payload }) => {
        setEndsAt((payload as { endsAt: number | null }).endsAt);
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  function broadcast(value: number | null) {
    setEndsAt(value);
    channelRef.current?.send({
      type: "broadcast",
      event: "set",
      payload: { endsAt: value },
    });
  }

  function start() {
    broadcast(Date.now() + minutes * 60 * 1000);
  }
  function stop() {
    broadcast(null);
  }

  const remaining = endsAt ? endsAt - now : 0;
  const running = endsAt !== null && remaining > 0;
  const finished = endsAt !== null && remaining <= 0;

  return (
    <div className="card" style={{ display: "grid", gap: 12 }}>
      <div className="row spread">
        <h3 style={{ margin: 0 }}>⏳ 카운트다운</h3>
        <div className="row" style={{ gap: 6 }}>
          {PRESETS.map((m) => (
            <button
              key={m}
              className={`btn ${minutes === m ? "primary" : ""}`}
              onClick={() => setMinutes(m)}
            >
              {m}분
            </button>
          ))}
        </div>
      </div>

      <div
        className="countdown"
        style={finished ? { color: "var(--pink)" } : undefined}
      >
        {finished ? "00:00 ⏰" : fmt(remaining)}
      </div>

      <div className="row" style={{ gap: 8, justifyContent: "center" }}>
        <button className="btn primary" onClick={start}>
          {running ? "다시 시작" : "시작"}
        </button>
        <button className="btn" onClick={stop} disabled={endsAt === null}>
          정지
        </button>
      </div>
    </div>
  );
}
