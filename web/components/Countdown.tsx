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

// 플로팅 타이머 위젯. "+ 도구" 런처로 소환되며(open), 같은 방의 모두가
// 동일 종료시각을 공유한다. 다른 참가자가 시작하면 자동으로 떠오른다.
export function FloatingTimer({
  roomId,
  open,
  onClose,
}: {
  roomId: number;
  open: boolean;
  onClose: () => void;
}) {
  // endsAt: 종료 시각(epoch ms). null 이면 정지.
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [minutes, setMinutes] = useState(5);
  const [show, setShow] = useState(false);
  const channelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  // 런처에서 열면 위젯 표시
  useEffect(() => {
    if (open) setShow(true);
  }, [open]);

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
        const next = (payload as { endsAt: number | null }).endsAt;
        setEndsAt(next);
        if (next) setShow(true); // 누군가 시작하면 자동 표시
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
  function close() {
    setShow(false);
    onClose();
  }

  if (!show) return null;

  const remaining = endsAt ? endsAt - now : 0;
  const active = endsAt !== null;
  const finished = active && remaining <= 0;

  return (
    <div className="float-timer">
      <div className="fh">
        <b>⏳ 타이머</b>
        <button className="xbtn" onClick={close} title="닫기">
          ✕
        </button>
      </div>

      {!active ? (
        <>
          <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {PRESETS.map((m) => (
              <button
                key={m}
                className={`pbtn ${minutes === m ? "on" : ""}`}
                onClick={() => setMinutes(m)}
              >
                {m}분
              </button>
            ))}
          </div>
          <button
            className="btn primary sm"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={start}
          >
            시작
          </button>
        </>
      ) : (
        <>
          <div className={`float-clock ${remaining <= 30000 ? "warn" : ""}`}>
            {finished ? "00:00" : fmt(remaining)}
          </div>
          <div className="row" style={{ gap: 6, marginTop: 8 }}>
            <button
              className="btn sm"
              style={{ flex: 1, justifyContent: "center" }}
              onClick={stop}
            >
              정지
            </button>
            <button
              className="btn sm"
              style={{ flex: 1, justifyContent: "center" }}
              onClick={close}
            >
              닫기
            </button>
          </div>
        </>
      )}
    </div>
  );
}
