"use client";

import { useEffect } from "react";
import {
  TrackToggle,
  VideoTrack,
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

