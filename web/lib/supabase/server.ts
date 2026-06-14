import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { createClient as createSbClient } from "@supabase/supabase-js";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

// 서버 컴포넌트 / route handler 에서 쓰는 (로그인 세션 인지) 클라이언트
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // 서버 컴포넌트에서 set 호출 시 무시(미들웨어/route 에서만 유효)
          }
        },
      },
    }
  );
}

// 한 요청 안에서 getUser() 호출을 한 번으로 합친다(React cache).
// layout 과 각 page 가 같은 요청에서 각각 getUser 를 부르면 토큰 검증
// 네트워크 왕복이 중복되는데, cache 로 묶으면 요청당 1회만 실행된다.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// 서버 전용: RLS 를 우회하는 service_role 클라이언트 (ingest / 방 생성용)
export function createAdminClient() {
  return createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
