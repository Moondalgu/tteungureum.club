const T = process.env.SB_TOKEN;
const REF = "vqtdgifbxmibbmaniize";
const H = { Authorization: `Bearer ${T}`, "Content-Type": "application/json" };
const URL = `https://api.supabase.com/v1/projects/${REF}/config/auth`;

const cur = await (await fetch(URL, { headers: H })).json();
console.log("BEFORE site_url:", cur.site_url);
console.log("BEFORE uri_allow_list:", cur.uri_allow_list);

const site = "https://tteungureum-club.vercel.app";
const allow = [
  "https://tteungureum-club.vercel.app/**",
  "https://tteungureum.club/**",
  "http://localhost:3000/**",
].join(",");

const r = await fetch(URL, {
  method: "PATCH",
  headers: H,
  body: JSON.stringify({ site_url: site, uri_allow_list: allow }),
});
console.log("PATCH status:", r.status);
const after = await r.json();
console.log("AFTER site_url:", after.site_url);
console.log("AFTER uri_allow_list:", after.uri_allow_list);
