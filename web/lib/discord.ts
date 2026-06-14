// Discord REST API 로 텍스트 채널 생성
// 봇에 "채널 관리(Manage Channels)" 권한이 있어야 함.

const DISCORD_API = "https://discord.com/api/v10";

// 디스코드 채널명 규칙: 소문자, 공백→하이픈, 허용문자만, 최대 100자
export function toChannelName(parts: string[]): string {
  return parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

export interface CreatedChannel {
  id: string;
  url: string;
}

export async function createDiscordChannel(name: string): Promise<CreatedChannel> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token || !guildId) {
    throw new Error("DISCORD_BOT_TOKEN / DISCORD_GUILD_ID 가 설정되지 않았습니다.");
  }

  const body: Record<string, unknown> = {
    name,
    type: 0, // 0 = GUILD_TEXT
  };
  if (process.env.DISCORD_CATEGORY_ID) {
    body.parent_id = process.env.DISCORD_CATEGORY_ID;
  }

  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord 채널 생성 실패 (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { id: string; guild_id: string };
  return {
    id: data.id,
    url: `https://discord.com/channels/${data.guild_id}/${data.id}`,
  };
}

// 채널 삭제 (방 삭제 시 정리). best-effort — 실패해도 방 삭제는 진행.
export async function deleteDiscordChannel(channelId: string): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return;
  const res = await fetch(`${DISCORD_API}/channels/${channelId}`, {
    method: "DELETE",
    headers: { Authorization: `Bot ${token}` },
  });
  if (!res.ok) {
    console.error("[discord delete]", res.status, await res.text());
  }
}

// 채널에 메시지 전송 (날짜 확정 알림 등)
export async function postDiscordMessage(
  channelId: string,
  content: string
): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return;
  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    console.error("[discord message]", res.status, await res.text());
  }
}
