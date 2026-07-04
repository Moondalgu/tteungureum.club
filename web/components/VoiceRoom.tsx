"use client";

import { useEffect } from "react";
import {
  TrackToggle,
  VideoTrack,
  useIsSpeaking,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import { useKrispNoiseFilter } from "@livekit/components-react/krisp";
import { Track, type Participant } from "livekit-client";
import { IconMic } from "./icons";

// 음성 + 화면공유 + 휘발성 채팅 (LiveKit) 조각들.
// LiveKitRoom 컨텍스트는 RoomShell 이 제공한다. 화면공유 영상은 왼쪽 스테이지에,
// 음성 컨트롤/참가자/채팅은 우측 레일에 분리 배치된다.

function initial(name: string) {
  return name.trim().charAt(0) || "?";
}

// Krisp AI 노이즈 제거(LiveKit Cloud 내장) — 키보드/생활소음 제거로 음성 명료도 향상.
// 미지원 브라우저(구형 iOS 등)에선 조용히 건너뛰고 브라우저 기본 noiseSuppression 사용.
// UI 없이 연결당 1회만 마운트한다 (RoomShell 의 LiveKitRoom 바로 아래).
export function KrispSetup() {
  const krisp = useKrispNoiseFilter();
  const setKrisp = krisp.setNoiseFilterEnabled;
  useEffect(() => {
    Promise.resolve(setKrisp(true)).catch(() => {});
  }, [setKrisp]);
  return null;
}

// 참가자 프레즌스 칩 — 주제 히어로 헤더 우측에 조용히(ambient) 노출.
// 줄바꿈 없이 최대 5명 + "+N" 오버플로 (아바타 그룹 표준 관례).
const MAX_CHIPS = 5;

export function VoicePresence() {
  const participants = useParticipants();
  const shown = participants.slice(0, MAX_CHIPS);
  const extra = participants.length - shown.length;
  return (
    <div className="pchips">
      {shown.map((p) => (
        <ParticipantChip key={p.identity} p={p} />
      ))}
      {extra > 0 && <span className="pchip">+{extra}</span>}
    </div>
  );
}

// 세션 컨트롤 — 주제 히어로 푸터(.voice-dock)에 배치.
// 마이크가 첫 번째(가장 빈번한 토글), 나가기는 우측 끝에 danger 로 격리(오클릭 방지).
// 상태는 색(라임)+텍스트("켬/꺼짐") 이중 부호화 — 색만으로는 색약 사용자가 오인한다.
export function VoiceControls() {
  const room = useRoomContext();
  const { isMicrophoneEnabled, isScreenShareEnabled } = useLocalParticipant();
  return (
    <>
      <TrackToggle source={Track.Source.Microphone} className="btn sm" showIcon={false}>
        <IconMic size={12} /> 마이크 {isMicrophoneEnabled ? "켬" : "꺼짐"}
      </TrackToggle>
      <TrackToggle source={Track.Source.ScreenShare} className="btn sm" showIcon={false}>
        화면공유 {isScreenShareEnabled ? "중" : ""}
      </TrackToggle>
      <button
        className="btn sm danger"
        style={{ marginLeft: "auto" }}
        onClick={() => room.disconnect()}
      >
        나가기
      </button>
    </>
  );
}

// 모바일 채팅 탭용 미니 컨트롤 — 음소거는 어떤 화면에서도 사라지면 안 된다
// (Zoom auto-hide 의 교훈). 채팅 탭에서도 sticky 영역에 남는다.
export function VoiceMini() {
  const room = useRoomContext();
  const participants = useParticipants();
  const { isMicrophoneEnabled } = useLocalParticipant();
  return (
    <div className="voice-mini">
      <span className="small row" style={{ gap: 4 }}>
        <IconMic size={12} /> {participants.length}명
      </span>
      <TrackToggle source={Track.Source.Microphone} className="btn sm" showIcon={false}>
        마이크 {isMicrophoneEnabled ? "켬" : "꺼짐"}
      </TrackToggle>
      <button
        className="btn sm"
        style={{ marginLeft: "auto" }}
        onClick={() => room.disconnect()}
      >
        나가기
      </button>
    </div>
  );
}

function ParticipantChip({ p }: { p: Participant }) {
  const speaking = useIsSpeaking(p);
  const name = p.name || p.identity;
  return (
    <span className={`pchip ${speaking ? "spk" : ""}`}>
      <span className="av">{initial(name)}</span>
      <span className="pname">
        {name}
        {p.isLocal ? "(나)" : ""}
      </span>
      {p.isMicrophoneEnabled ? "🎙️" : "🔇"}
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

