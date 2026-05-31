"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
        return;
      }
      setUserId(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("nickname, avatar_url")
        .eq("id", user.id)
        .single();
      setNickname(profile?.nickname ?? "");
      setAvatarUrl(profile?.avatar_url ?? null);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function uploadAvatar(file: File) {
    if (!userId) return;
    setMsg("이미지 업로드 중...");
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (error) {
      setMsg(`업로드 실패: ${error.message}`);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setMsg("이미지 업로드 완료. 저장을 눌러주세요.");
  }

  async function save() {
    if (!userId) return;
    setSaving(true);
    setMsg("");
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      nickname: nickname.trim() || null,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      setMsg(`저장 실패: ${error.message}`);
      return;
    }
    setMsg("저장되었습니다.");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="container">
        <p className="muted">불러오는 중...</p>
      </main>
    );
  }

  return (
    <main className="container">
      <h1>프로필 설정</h1>
      <div className="card" style={{ display: "grid", gap: 16, maxWidth: 480 }}>
        <div className="row">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="avatar"
              src={avatarUrl}
              alt="프로필"
              style={{ width: 72, height: 72 }}
            />
          ) : (
            <span className="avatar" style={{ width: 72, height: 72 }} />
          )}
          <button className="btn" onClick={() => fileRef.current?.click()}>
            이미지 변경
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadAvatar(f);
            }}
          />
        </div>

        <label>
          <div className="small muted" style={{ marginBottom: 6 }}>
            닉네임
          </div>
          <input
            className="field"
            value={nickname}
            maxLength={20}
            placeholder="표시할 닉네임"
            onChange={(e) => setNickname(e.target.value)}
          />
        </label>

        <div className="row spread">
          <span className="small muted">{msg}</span>
          <button className="btn primary" onClick={save} disabled={saving}>
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </main>
  );
}
