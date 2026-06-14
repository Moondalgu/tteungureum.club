"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  TrackToggle,
  VideoTrack,
  useChat,
  useIsSpeaking,
  useParticipants,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import { Track, type Participant } from "livekit-client";

// 음성 + 화면공유 + 휘발성 채팅 (LiveKit). 기존 사이트 디자인(card/btn)에 맞춘 커스텀 UI.
// "음성 참여" 버튼 클릭 시 토큰을 받아 연결(자동 입장 X — 마이크 권한/대역폭 절약).
// 입장 시 기본 음소거(audio=false): 마이크 버튼을 눌러야 발언 시작.
export function VoiceRoom({
  roomId,
  isLoggedIn,
}: {
  roomId: number;
  isLoggedIn: boolean;
}) {
  const [conn, setConn] = useState<{ token: string; serverUrl: string } | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (!isLoggedIn) {
    return (
      <div className="card">
        <span className="muted">로그인하면 음성 토론에 참여할 수 있어요.</span>
      </div>
    );
  }

  if (!conn) {
    return (
      <div className="card row spread">
        <span className="muted small">🎙️ 마이크와 화면공유로 함께 토론해요</span>
        <div className="row" style={{ gap: 8 }}>
          {error && (
            <span className="small" style={{ color: "var(--pink-deep)" }}>
              {error}
            </span>
          )}
          <button className="btn primary" onClick={join} disabled={loading}>
            {loading ? "연결 중..." : "음성 참여"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={conn.token}
      serverUrl={conn.serverUrl}
      connect={true}
      audio={false}
      video={false}
      onDisconnected={() => setConn(null)}
      onError={(e) => setError(e.message)}
      style={{ display: "contents" }}
    >
      <RoomAudioRenderer />
      <VoiceRoomInner />
    </LiveKitRoom>
  );
}

function VoiceRoomInner() {
  const room = useRoomContext();
  const participants = useParticipants();
  const screenTracks = useTracks([Track.Source.ScreenShare], {
    onlySubscribed: true,
  });

  return (
    <div className="card grid" style={{ gap: 14 }}>
      <div className="row spread">
        <div className="row" style={{ gap: 8 }}>
          <TrackToggle source={Track.Source.Microphone} className="btn" showIcon={false}>
            🎙️ 마이크
          </TrackToggle>
          <TrackToggle source={Track.Source.ScreenShare} className="btn" showIcon={false}>
            🖥️ 화면공유
          </TrackToggle>
        </div>
        <button className="btn" onClick={() => room.disconnect()}>
          나가기
        </button>
      </div>

      {screenTracks.length > 0 && (
        <div className="grid" style={{ gap: 8 }}>
          {screenTracks.map((t) => (
            <VideoTrack
              key={t.publication?.trackSid}
              trackRef={t}
              style={{
                width: "100%",
                borderRadius: 8,
                border: "3px solid var(--ink)",
                boxShadow: "var(--shadow)",
                background: "#000",
              }}
            />
          ))}
        </div>
      )}

      <div className="vr-cols">
        <div>
          <h4 style={{ margin: "0 0 8px" }}>참가자 ({participants.length})</h4>
          <div className="grid" style={{ gap: 6 }}>
            {participants.map((p) => (
              <ParticipantRow key={p.identity} p={p} />
            ))}
          </div>
        </div>
        <ChatPanel />
      </div>
    </div>
  );
}

function ParticipantRow({ p }: { p: Participant }) {
  const speaking = useIsSpeaking(p);
  return (
    <div
      className="row"
      style={{
        gap: 8,
        padding: "6px 10px",
        border: "3px solid var(--ink)",
        borderRadius: 8,
        background: speaking ? "var(--lime)" : "rgba(255,255,255,0.6)",
        boxShadow: "2px 2px 0 var(--ink)",
      }}
    >
      <span>{p.isMicrophoneEnabled ? "🎙️" : "🔇"}</span>
      <span>
        {p.name || p.identity}
        {p.isLocal ? " (나)" : ""}
      </span>
    </div>
  );
}

function ChatPanel() {
  const { chatMessages, send, isSending } = useChat();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || isSending) return;
    setText("");
    await send(t);
  }

  return (
    <div className="grid" style={{ gap: 8 }}>
      <h4 style={{ margin: 0 }}>채팅</h4>
      <div
        style={{
          height: 180,
          overflowY: "auto",
          border: "3px solid var(--ink)",
          borderRadius: 8,
          background: "#fff",
          padding: 8,
        }}
      >
        {chatMessages.length === 0 && (
          <div className="muted small">아직 메시지가 없어요.</div>
        )}
        {chatMessages.map((m, i) => (
          <div key={m.id ?? i} className="small" style={{ marginBottom: 4 }}>
            <strong>{m.from?.name || m.from?.identity || "익명"}</strong>:{" "}
            {m.message}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form className="row" style={{ gap: 6 }} onSubmit={onSubmit}>
        <input
          className="field"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="메시지 입력..."
        />
        <button className="btn primary" type="submit" disabled={isSending}>
          전송
        </button>
      </form>
    </div>
  );
}
