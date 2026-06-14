import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";

// 음성방 접속용 LiveKit 토큰 발급
// 로그인한 사용자만 발급(비로그인 401). identity=user.id, 표시이름=프로필 닉네임.
// LiveKit room 이름은 "room-<roomId>" 규칙으로 방과 1:1 매핑.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomId = Number(searchParams.get("room"));
  if (!Number.isFinite(roomId)) {
    return NextResponse.json({ error: "room 파라미터가 필요합니다." }, { status: 400 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if (!apiKey || !apiSecret || !serverUrl) {
    return NextResponse.json(
      { error: "LiveKit 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  // 표시 이름: 프로필 닉네임 → 카카오 메타데이터 → 기본값
  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", user.id)
    .single();
  const name =
    profile?.nickname ||
    (user.user_metadata?.name as string | undefined) ||
    (user.user_metadata?.nickname as string | undefined) ||
    "익명";

  const roomName = `room-${roomId}`;
  const at = new AccessToken(apiKey, apiSecret, {
    identity: user.id,
    name,
  });
  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  const token = await at.toJwt();
  return NextResponse.json({ token, serverUrl });
}
