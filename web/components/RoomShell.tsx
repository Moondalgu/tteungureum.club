"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { AudioPresets, type RoomOptions } from "livekit-client";
import { RoomTopics } from "./RoomTopics";
import { Whiteboard } from "./Whiteboard";
import { FloatingTimer } from "./Countdown";
import { VoiceRail, ShareStage } from "./VoiceRoom";
import { RoomChat } from "./RoomChat";
import { createClient } from "@/lib/supabase/client";
import { isKakaoInApp, openExternalBrowser } from "@/lib/inapp";
import { IconChat, IconPlus, IconTalk } from "./icons";
import type { RoomMessage, RoomTopic, Stroke, Topic } from "@/lib/types";

// LiveKit 연결 옵션 — 모바일/손실 네트워크 음질 튜닝.
// - adaptiveStream/dynacast: 화면공유 영상이 셀룰러 대역폭을 독식해 음성이 끊기는 것 방지
// - audioCaptureDefaults: 에코제거/노이즈억제/자동게인 명시(브라우저별 편차 제거) → 동시 발화 안정
// - publishDefaults: RED(중복 인코딩)+DTX 명시로 패킷손실 ~20-30% 복구, 무음 구간 대역폭 절약
const roomOptions: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  publishDefaults: {
    red: true,
    dtx: true,
    audioPreset: AudioPresets.music, // 48kbps mono — 음성 명료도/모바일 안정 균형점
  },
};

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
  // 모바일(<768px) 전용 탭: 토론(스테이지) ↔ 채팅. 데스크톱은 항상 병렬 표시.
  const [pane, setPane] = useState<"stage" | "chat">("stage");
  // 카톡 인앱브라우저 여부 — SSR 하이드레이션 불일치를 피하려 마운트 후 판정
  const [inApp, setInApp] = useState(false);
  useEffect(() => {
    setInApp(isKakaoInApp());
  }, []);

  // 도구(화이트보드 등) 열림 상태를 방 전체에 공유하는 realtime 채널
  const toolsChan = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  const compact = sharing || wbOpen;

  const join = useCallback(async () => {
    // 카톡 인앱 웹뷰는 마이크 권한이 불안정 — 음성 참여는 외부 브라우저로 넘긴다
    if (isKakaoInApp()) {
      openExternalBrowser();
      return;
    }
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
    <div className={`room-stage ${pane === "stage" ? "" : "pane-off"}`}>
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
            <h4>🎨 화이트보드</h4>
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
    <div className={`room-rail ${pane === "chat" ? "" : "pane-off"}`}>
      <RoomChat
        roomId={roomId}
        userId={userId}
        nickname={nickname}
        initialMessages={initialMessages}
        isLoggedIn={isLoggedIn}
        visible={pane === "chat"}
      />
    </div>
  );

  // 음성 상태 바 — 방 상단 상시 노출. 모바일에선 sticky 로 고정되어
  // 어떤 탭에 있어도 음소거/나가기가 항상 가능하다.
  const voiceBar = (
    <div className="voice-bar">
      {conn ? (
        <VoiceRail />
      ) : (
        <>
          <h4>🎙️ 음성 · 화면공유</h4>
          {isLoggedIn ? (
            <>
              {inApp ? (
                <span className="muted small">
                  카톡 브라우저에선 음성이 불안정해요 — 참여하면 외부 브라우저로
                  열려요.
                </span>
              ) : (
                <span className="muted small">
                  참여하면 마이크는 꺼진 채로 연결돼요.
                </span>
              )}
              {error && <span className="small err">{error}</span>}
              <button
                className="btn sm primary"
                style={{ marginLeft: "auto" }}
                onClick={join}
                disabled={loading}
              >
                {loading ? "연결 중..." : "참여하기"}
              </button>
            </>
          ) : (
            <span className="muted small" style={{ marginLeft: "auto" }}>
              로그인하면 음성 토론에 참여할 수 있어요.
            </span>
          )}
        </>
      )}
    </div>
  );

  const grid = (
    <>
      <div className="room-sticky">
        {voiceBar}
        {/* role=tab 은 tabpanel 연결·키보드 규약까지 요구하므로
            단순 토글 버튼 의미론(aria-pressed)을 쓴다 */}
        <div className="pane-tabs mobile-only" aria-label="방 화면 전환">
          <button
            aria-pressed={pane === "stage"}
            className={pane === "stage" ? "on" : ""}
            onClick={() => setPane("stage")}
          >
            <IconTalk /> 토론
          </button>
          <button
            aria-pressed={pane === "chat"}
            className={pane === "chat" ? "on" : ""}
            onClick={() => setPane("chat")}
          >
            <IconChat /> 채팅
          </button>
        </div>
      </div>
      <div className="room-grid">
        {stage}
        {rail}
      </div>
    </>
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
          options={roomOptions}
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

      {/* 도구 런처 (＋ 도구) — 타이머/화이트보드는 토론 탭 소속이므로
          모바일 채팅 탭에선 숨겨 입력창을 가리지 않게 한다 */}
      <div className={`launcher ${pane === "chat" ? "desktop-only" : ""}`}>
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
          <IconPlus size={12} /> 도구
        </button>
      </div>

      {/* 타이머도 토론 탭 소속 — 모바일 채팅 탭에선 함께 숨긴다
          (display:none 부모는 fixed 자식도 숨긴다) */}
      <div className={pane === "chat" ? "desktop-only" : undefined}>
        <FloatingTimer
          roomId={roomId}
          open={timerOpen}
          onClose={() => setTimerOpen(false)}
        />
      </div>
    </>
  );
}
