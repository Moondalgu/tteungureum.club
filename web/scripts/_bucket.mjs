const TOKEN = process.env.SB_TOKEN;
const REF = "vqtdgifbxmibbmaniize";
const API = "https://api.supabase.com/v1";
const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

const sql = `
insert into storage.buckets (id, name, public)
values ('avatars','avatars',true)
on conflict (id) do update set public = true;

drop policy if exists "avatars_public_read" on storage.objects;
drop policy if exists "avatars_auth_insert" on storage.objects;
drop policy if exists "avatars_auth_update" on storage.objects;
drop policy if exists "avatars_auth_delete" on storage.objects;

create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars_auth_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars');
create policy "avatars_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'avatars');
create policy "avatars_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'avatars');
`;

const r = await fetch(`${API}/projects/${REF}/database/query`, {
  method: "POST",
  headers: H,
  body: JSON.stringify({ query: sql }),
});
console.log("status", r.status);
console.log(await r.text());
