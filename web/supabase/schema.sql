-- 뜬구름클럽 DB 스키마 (N 모임 · 날짜투표 · 방 · 화이트보드)
-- Supabase 대시보드 > SQL Editor 에 붙여넣어 실행하세요.

-- ───────────────────────── profiles ─────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────── topics ('N의 상자') ────────────────────
-- 카톡 수집 또는 수동(+)으로 추가되는 토론 주제 풀.
-- status: pending(미진행) | selected(방에 담김) | done(진행완료)
create table if not exists public.topics (
  id bigint generated always as identity primary key,
  author text not null default '익명',
  content text not null,
  source_date date,
  status text not null default 'pending' check (status in ('pending','selected','done')),
  msg_hash text unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists topics_status_idx on public.topics(status);

-- ───────────────────────── meetings ─────────────────────────
-- 모임 일정. 후보 날짜에 투표 → 마감일시 자동 확정 → 방 생성.
create table if not exists public.meetings (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  mode text not null default 'offline' check (mode in ('online','offline')),
  vote_deadline timestamptz not null,
  status text not null default 'voting' check (status in ('voting','confirmed')),
  confirmed_date date,
  room_id bigint,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.meeting_dates (
  id bigint generated always as identity primary key,
  meeting_id bigint not null references public.meetings(id) on delete cascade,
  d date not null
);

create table if not exists public.meeting_votes (
  meeting_date_id bigint not null references public.meeting_dates(id) on delete cascade,
  meeting_id bigint not null references public.meetings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (meeting_date_id, user_id)
);

-- ───────────────────────── rooms ────────────────────────────
create table if not exists public.rooms (
  id bigint generated always as identity primary key,
  title text not null,
  date date not null default current_date,
  mode text not null default 'offline' check (mode in ('online','offline')),
  discord_channel_id text,
  discord_url text,
  meeting_id bigint references public.meetings(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 방에 담긴 주제 (순서 보존 + 진행완료 체크)
create table if not exists public.room_topics (
  id bigint generated always as identity primary key,
  room_id bigint not null references public.rooms(id) on delete cascade,
  topic_id bigint references public.topics(id) on delete set null,
  content text not null,          -- 자체생성/스냅샷용 텍스트
  author text not null default '익명',
  position int not null default 0,
  done boolean not null default false
);
create index if not exists room_topics_room_idx on public.room_topics(room_id, position);

-- ───────────────────────── strokes ──────────────────────────
create table if not exists public.strokes (
  id bigint generated always as identity primary key,
  room_id bigint not null references public.rooms(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists strokes_room_idx on public.strokes(room_id, id);

-- ─────────────────────── room_messages ──────────────────────
-- 방 채팅(영구 저장). 방 삭제 시 함께 삭제(cascade).
create table if not exists public.room_messages (
  id bigint generated always as identity primary key,
  room_id bigint not null references public.rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null default '익명',
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists room_messages_room_idx on public.room_messages(room_id, id);

-- ───────────── 신규 가입 시 프로필 자동 생성 ─────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nickname, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'nickname'),
    new.raw_user_meta_data->>'avatar_url'
  ) on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────── RLS ────────────────────────────
alter table public.profiles      enable row level security;
alter table public.topics        enable row level security;
alter table public.meetings      enable row level security;
alter table public.meeting_dates enable row level security;
alter table public.meeting_votes enable row level security;
alter table public.rooms         enable row level security;
alter table public.room_topics   enable row level security;
alter table public.strokes       enable row level security;
alter table public.room_messages enable row level security;

-- 읽기 공개
create policy "p_read"  on public.profiles      for select using (true);
create policy "t_read"  on public.topics        for select using (true);
create policy "m_read"  on public.meetings      for select using (true);
create policy "md_read" on public.meeting_dates for select using (true);
create policy "mv_read" on public.meeting_votes for select using (true);
create policy "r_read"  on public.rooms         for select using (true);
create policy "rt_read" on public.room_topics   for select using (true);
create policy "s_read"  on public.strokes       for select using (true);
create policy "rm_read" on public.room_messages for select using (true);

-- 프로필: 본인만
create policy "p_ins" on public.profiles for insert with check (auth.uid() = id);
create policy "p_upd" on public.profiles for update using (auth.uid() = id);

-- 주제: 로그인 사용자 추가/수정
create policy "t_ins" on public.topics for insert with check (auth.uid() is not null);
create policy "t_upd" on public.topics for update using (auth.uid() is not null);

-- 모임: 로그인 사용자 생성
create policy "m_ins"  on public.meetings      for insert with check (auth.uid() is not null);
create policy "md_ins" on public.meeting_dates for insert with check (auth.uid() is not null);

-- 투표: 본인 표만 추가/삭제
create policy "mv_ins" on public.meeting_votes for insert with check (auth.uid() = user_id);
create policy "mv_del" on public.meeting_votes for delete using (auth.uid() = user_id);

-- 방 내 주제: 로그인 사용자 추가/수정
create policy "rt_ins" on public.room_topics for insert with check (auth.uid() is not null);
create policy "rt_upd" on public.room_topics for update using (auth.uid() is not null);
create policy "rt_del" on public.room_topics for delete using (auth.uid() is not null);

-- 화이트보드 획: 로그인 사용자 추가/삭제
create policy "s_ins" on public.strokes for insert with check (auth.uid() is not null);
create policy "s_del" on public.strokes for delete using (auth.uid() is not null);

-- 방 채팅: 로그인 사용자가 본인 이름으로만 작성
create policy "rm_ins" on public.room_messages for insert with check (auth.uid() = user_id);

-- 방/모임 확정·삭제는 서버(service_role)에서 처리 → RLS 우회.

-- Realtime publication
alter publication supabase_realtime add table public.strokes;
alter publication supabase_realtime add table public.room_messages;
