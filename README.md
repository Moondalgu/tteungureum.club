# 뜬구름클럽 ☁

MBTI N들이 모여 뜬구름 잡는 주제로 토론하는 모임 커뮤니티 툴.

- **N의 상자** — 카톡 오픈채팅 공지 댓글을 수집해 만든 주제 풀
- **모임** — 후보 날짜에 투표 → 마감되면 자동 확정 → 토론 방 생성
- **방** — 주제를 골라 토론, 진행완료 체크, 실시간 화이트보드 + 카운트다운
- **카카오 로그인** + 닉네임/프로필 설정
- 디자인: Y2K 픽셀 (Galmuri 폰트)

## 구성

```
web/      Next.js (App Router) — Vercel 배포, Supabase 연동
reader/   PC 카카오톡 데스크톱 수집기 (Python, uiautomation)
```

## 스택
- **FE/SSR**: Next.js 15 (App Router, TypeScript) → Vercel
- **DB/Auth/Realtime/Storage**: Supabase (Postgres, Kakao OAuth)
- **음성/화면공유**: LiveKit Cloud (WebRTC)
- **수집기**: Python `uiautomation` (Windows 전용)

---

## 1. Supabase 설정

1. [supabase.com](https://supabase.com) 에서 프로젝트 생성
2. **SQL Editor** → `web/supabase/schema.sql` 내용 전체 붙여넣고 실행
3. **Settings > API** 에서 아래 값 확인
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` 키 → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` 키 → `SUPABASE_SERVICE_ROLE_KEY` (서버 전용, 절대 노출 금지)
4. **Storage** → `avatars` 버킷 생성(공개 읽기). 프로필 이미지 업로드용
5. **Authentication > Providers > Kakao** 활성화
   - 아래 카카오 설정에서 받은 REST API 키 / Client Secret 입력
   - Callback URL 은 Supabase가 알려주는 값 사용

## 2. 카카오 로그인 설정

1. [Kakao Developers](https://developers.kakao.com) → 앱 생성
2. **카카오 로그인** 활성화
3. **Redirect URI** = Supabase가 알려준 콜백 주소
   (`https://YOUR-PROJECT.supabase.co/auth/v1/callback`)
4. 동의 항목에서 닉네임/프로필 이미지 설정(범위 제한 시 앱 내에서 직접 설정)

## 3. 웹 로컬 실행 / 배포

```bash
cd web
cp .env.example .env.local   # 값 채우기
npm install
npm run dev                  # http://localhost:3000
```

**Vercel 배포**: 레포 연결 → `web` 디렉터리를 루트로 지정 → 환경변수 입력
(`.env.example` 의 모든 키) → 커스텀 도메인 연결 후 `NEXT_PUBLIC_SITE_URL` 설정.

## 4. PC 카톡 수집기 (Windows)

PC 카카오톡에 부계정으로 로그인 후 대상 오픈채팅방을 열어둔 상태로 실행.

```bash
cd reader
pip install -r requirements.txt
copy config.example.json config.json   # 값 채우기
python kakao_reader.py            # 폴링 시작
python kakao_reader.py --once     # 1회만 수집
python kakao_reader.py --dump     # UI 트리 디버그 출력
```

`config.json` 키:
| 키 | 설명 |
|----|------|
| `api_url` | 배포 주소 + `/api/ingest` |
| `secret` | web 의 `INGEST_SECRET` 과 동일 |
| `room_name` | 오픈채팅방 창 제목(정규식 매칭) |
| `notice_keyword` | 공지 식별 키워드 (기본 "공지") |
| `poll_interval` | 폴링 주기(초) |

> ⚠️ 카톡 자동화는 비공식 방식으로 약관 리스크가 있습니다. **부계정** 사용을 권장하며,
> 카톡 업데이트 시 UI 구조 변경으로 리더 수정이 필요할 수 있습니다.

---

## 사용 흐름

1. 카톡 공지 댓글 → 수집기 → **N의 상자**(`/box`)에 주제 자동 적재
2. **모임**(`/`) 생성 → 후보 날짜 + 투표 마감일시 설정
3. 모임원들이 가능한 날짜에 투표(여러 개 선택 가능)
4. 마감 시각이 지나 페이지 접속 시 자동 확정 → 토론 방 자동 생성
5. **방**(`/rooms/[id]`) 입장 → N의 상자에서 주제 꺼내기 / 직접 추가
6. 주제 진행 후 ✔ 체크, 화이트보드로 함께 그리기, 카운트다운으로 시간 관리
