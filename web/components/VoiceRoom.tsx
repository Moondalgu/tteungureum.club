"use client";

import { useEffect, useRef, useState } from "react";
import {
  TrackToggle,
  VideoTrack,
  useChat,
  useIsSpeaking,
  useParticipants,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import { Track, type Participant } from "livekit-client";

// 음성 + 화면공유 + 휘발성 채팅 (LiveKit) 조각들.
// LiveKitRoom 컨텍스트는 RoomShell 이 제공한다. 화면공유 영상은 왼쪽 스테이지에,
// 음성 컨트롤/참가자/채팅은 우측 레일에 분리 배치된다.

function initial(name: string) {
  return name.trim().charAt(0) || "?";
}

// 우측 레일: 마이크/공유 토글 + 나가기 + 참가자 칩
export function VoiceRail() {
  const room = useRoomContext();
  const participants = useParticipants();

  return (
    <div className="card">
      <div className="row spread">
        <h4 style={{ margin: 0, fontSize: 13 }}>🎙️ 음성 ({participants.length})</h4>
        <span className="small muted">발언 중 = 라임 링</span>
      </div>

      <div className="pchips">
        {participants.map((p) => (
          <ParticipantChip key={p.identity} p={p} />
        ))}
      </div>

      <div className="ctrlbar">
        <TrackToggle source={Track.Source.Microphone} className="btn sm" showIcon={false}>
          🎙️ 마이크
        </TrackToggle>
        <TrackToggle source={Track.Source.ScreenShare} className="btn sm" showIcon={false}>
          🖥️ 공유
        </TrackToggle>
        <button className="btn sm" onClick={() => room.disconnect()}>
          나가기
        </button>
      </div>
    </div>
  );
}

function ParticipantChip({ p }: { p: Participant }) {
  const speaking = useIsSpeaking(p);
  const name = p.name || p.identity;
  return (
    <span className={`pchip ${speaking ? "spk" : ""}`}>
      <span className="av">{initial(name)}</span>
      {name}
      {p.isLocal ? "(나)" : ""} {p.isMicrophoneEnabled ? "🎙️" : "🔇"}
    </span>
  );
}

// 왼쪽 스테이지: 화면공유 영상. 공유 트랙 유무를 부모에 알려 compact 모드 동기화.
export function ShareStage({
  onSharingChange,
}: {
  onSharingChange: (active: boolean) => void;
}) {
  const room = useRoomContext();
  const tracks = useTracks([Track.Source.ScreenShare], {
    onlySubscribed: false,
  });

  useEffect(() => {
    onSharingChange(tracks.length > 0);
  }, [tracks.length, onSharingChange]);

  if (tracks.length === 0) return null;

  return (
    <>
      {tracks.map((t) => (
        <div className="share-stage" key={t.publication?.trackSid ?? t.participant.identity}>
          {t.participant.isLocal && (
            <button
              className="sharestop"
              onClick={() => room.localParticipant.setScreenShareEnabled(false)}
            >
              ✕ 공유 종료
            </button>
          )}
          <VideoTrack trackRef={t} />
        </div>
      ))}
    </>
  );
}

// 우측 레일: 휘발성 채팅
export function VoiceChat() {
  const { chatMessages, send, isSending } = useChat();
  const [text, setText] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  // 채팅 로그 컨테이너 내부만 맨 아래로 스크롤(페이지 전체 점프 방지).
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || isSending) return;
    setText("");
    await send(t);
  }

  return (
    <div className="card">
      <h4 style={{ margin: "0 0 10px", fontSize: 13 }}>💬 채팅</h4>
      <div className="chat-log" ref={logRef}>
        {chatMessages.length === 0 && (
          <div className="muted small">아직 메시지가 없어요.</div>
        )}
        {chatMessages.map((m, i) => (
          <div key={m.id ?? i} className="m">
            <strong>{m.from?.name || m.from?.identity || "익명"}</strong>: {m.message}
          </div>
        ))}
      </div>
      <form className="row" style={{ gap: 6, marginTop: 8 }} onSubmit={onSubmit}>
        <input
          className="field"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="메시지 입력..."
        />
        <button className="btn primary sm" type="submit" disabled={isSending}>
          전송
        </button>
      </form>
    </div>
  );
}
