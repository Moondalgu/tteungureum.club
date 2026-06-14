"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { RoomTopics } from "./RoomTopics";
import { Whiteboard } from "./Whiteboard";
import { FloatingTimer } from "./Countdown";
import { VoiceRail, VoiceChat, ShareStage } from "./VoiceRoom";
import { createClient } from "@/lib/supabase/client";
import type { RoomTopic, Stroke, Topic } from "@/lib/types";

// 방 화면 오케스트레이터.
// - 좌측 스테이지: 주제 히어로(상시) + 화면공유 영상/화이트보드(소환 시)
// - 우측 레일: 음성 컨트롤·참가자·채팅
// - 우하단 "＋ 도구" 런처로 타이머(플로팅)·화이트보드(스테이지) 소환
// LiveKitRoom 컨텍스트를 그리드 전체에 제공해 화면공유 영상(좌)과
// 음성 컨트롤(우)이 같은 컨텍스트를 공유한다.
export function RoomShell({
  roomId,
  initialTopics,
  boxTopics,
  strokes,
  isLoggedIn,
}: {
  roomId: number;
  initialTopics: RoomTopic[];
  boxTopics: Topic[];
  strokes: Stroke[];
  isLoggedIn: boolean;
}) {
  const [conn, setConn] = useState<{ token: string; serverUrl: string } | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sharing, setSharing] = useState(false);
  const [wbOpen, setWbOpen] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // 도구(화이트보드 등) 열림 상태를 방 전체에 공유하는 realtime 채널
  const toolsChan = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  const compact = sharing || wbOpen;

  const join = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/livekit-token?room=${roomId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `토큰 발급 실패 (${res.status})`);
      }
      const data = (await res.json()) as { token: string; serverUrl: string };
      setConn({ token: data.token, serverUrl: data.serverUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : "연결에 실패했어요.");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  // 로그인 사용자는 입장 시 자동으로 LiveKit 방에 연결(마이크는 끈 채 청취/구독만).
  // 이렇게 해야 화면공유 트랙이 모두에게 즉시 전달된다.
  useEffect(() => {
    if (isLoggedIn && !conn && !loading) join();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  // 화이트보드 열림 상태 공유: 누가 도구를 꺼내면 모두 화면에 보이게 한다.
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel(`tools-${roomId}`, {
      config: { broadcast: { self: false } },
    });
    ch.on("broadcast", { event: "wb" }, ({ payload }) => {
      setWbOpen(!!(payload as { open?: boolean }).open);
    }).subscribe();
    toolsChan.current = ch;
    return () => {
      supabase.removeChannel(ch);
    };
  }, [roomId]);

  // 화이트보드 열기/닫기 — 로컬 상태 변경 + 방 전체 브로드캐스트
  const setWhiteboard = useCallback((open: boolean) => {
    setWbOpen(open);
    toolsChan.current?.send({
      type: "broadcast",
      event: "wb",
      payload: { open },
    });
  }, []);

  const onSharingChange = useCallback((active: boolean) => {
    setSharing(active);
  }, []);

  const stage = (
    <div className="room-stage">
      <RoomTopics
        roomId={roomId}
        initialTopics={initialTopics}
        boxTopics={boxTopics}
        isLoggedIn={isLoggedIn}
        compact={compact}
      />

      {conn && <ShareStage onSharingChange={onSharingChange} />}

      {wbOpen && (
        <div className="card">
          <div className="row spread" style={{ marginBottom: 10 }}>
            <h4 style={{ margin: 0, fontSize: 13 }}>🎨 화이트보드 (실시간 공동편집)</h4>
            <button className="btn sm" onClick={() => setWhiteboard(false)}>
              ✕ 닫기
            </button>
          </div>
          <Whiteboard roomId={roomId} initialStrokes={strokes} />
        </div>
      )}
    </div>
  );

  const rail = conn ? (
    <div className="room-rail">
      <VoiceRail />
      <VoiceChat />
    </div>
  ) : (
    <div className="room-rail">
      <div className="card grid" style={{ gap: 10 }}>
        <h4 style={{ margin: 0, fontSize: 13 }}>🎙️ 음성 · 화면공유</h4>
        {isLoggedIn ? (
          <>
            <span className="muted small">마이크와 화면공유로 함께 토론해요</span>
            {error && (
              <span className="small" style={{ color: "var(--pink-deep)" }}>
                {error}
              </span>
            )}
            <button className="btn primary" onClick={join} disabled={loading}>
              {loading ? "연결 중..." : "음성 참여"}
            </button>
          </>
        ) : (
          <span className="muted small">로그인하면 음성 토론에 참여할 수 있어요.</span>
        )}
      </div>
    </div>
  );

  const grid = (
    <div className="room-grid">
      {stage}
      {rail}
    </div>
  );

  return (
    <>
      {conn ? (
        <LiveKitRoom
          token={conn.token}
          serverUrl={conn.serverUrl}
          connect={true}
          audio={false}
          video={false}
          onDisconnected={() => {
            setConn(null);
            setSharing(false);
          }}
          onError={(e) => setError(e.message)}
          style={{ display: "contents" }}
        >
          <RoomAudioRenderer />
          {grid}
        </LiveKitRoom>
      ) : (
        grid
      )}

      {/* 도구 런처 (＋ 도구) */}
      <div className="launcher">
        {menuOpen && (
          <div className="toolmenu">
            <span className="mh">도구 추가</span>
            <div
              className="mi"
              onClick={() => {
                setTimerOpen(true);
                setMenuOpen(false);
              }}
            >
              ⏳ <span>타이머</span>
            </div>
            <div
              className="mi"
              onClick={() => {
                setWhiteboard(true);
                setMenuOpen(false);
              }}
            >
              🎨 <span>화이트보드</span>
            </div>
          </div>
        )}
        <button className="fab" onClick={() => setMenuOpen((v) => !v)}>
          ＋ 도구
        </button>
      </div>

      <FloatingTimer
        roomId={roomId}
        open={timerOpen}
        onClose={() => setTimerOpen(false)}
      />
    </>
  );
}
