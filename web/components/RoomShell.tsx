"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { RoomTopics } from "./RoomTopics";
import { Whiteboard } from "./Whiteboard";
import { FloatingTimer } from "./Countdown";
import { VoiceRail, ShareStage } from "./VoiceRoom";
import { RoomChat } from "./RoomChat";
import { createClient } from "@/lib/supabase/client";
import type { RoomMessage, RoomTopic, Stroke, Topic } from "@/lib/types";

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
  userId,
  nickname,
  initialMessages,
}: {
  roomId: number;
  initialTopics: RoomTopic[];
  boxTopics: Topic[];
  strokes: Stroke[];
  isLoggedIn: boolean;
  userId: string | null;
  nickname: string | null;
  initialMessages: RoomMessage[];
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

  // 음성/화면공유는 옵션. 입장 시 자동 연결하지 않고 "음성 참여" 버튼으로만 연결한다.
  // 채팅은 LiveKit 연결과 무관하게 항상 동작한다(아래 rail 참고).

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
            <h4 style={{ margin: 0, fontSize: 13 }}>🎨 화이트보드</h4>
            <button className="btn sm" onClick={() => setWhiteboard(false)}>
              ✕ 닫기
            </button>
          </div>
          <Whiteboard roomId={roomId} initialStrokes={strokes} />
        </div>
      )}
    </div>
  );

  // 채팅은 음성 연결과 무관하게 항상 표시한다.
  const rail = (
    <div className="room-rail">
      {conn ? (
        <VoiceRail />
      ) : (
        <div className="card grid" style={{ gap: 10 }}>
          <h4 style={{ margin: 0, fontSize: 13 }}>🎙️ 음성 · 화면공유</h4>
          {isLoggedIn ? (
            <>
              <span className="muted small">
                참여하면 마이크는 꺼진 채로 연결돼요. 마이크·화면공유는 따로 켤 수 있어요.
              </span>
              {error && (
                <span className="small" style={{ color: "var(--pink-deep)" }}>
                  {error}
                </span>
              )}
              <button className="btn primary" onClick={join} disabled={loading}>
                {loading ? "연결 중..." : "음성·화면공유 참여"}
              </button>
            </>
          ) : (
            <span className="muted small">로그인하면 음성 토론에 참여할 수 있어요.</span>
          )}
        </div>
      )}
      <RoomChat
        roomId={roomId}
        userId={userId}
        nickname={nickname}
        initialMessages={initialMessages}
        isLoggedIn={isLoggedIn}
      />
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
