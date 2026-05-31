import { readFileSync } from "node:fs";

const TOKEN = process.env.SB_TOKEN;
const REF = "vqtdgifbxmibbmaniize";
const API = "https://api.supabase.com/v1";

const H = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

async function j(label, res) {
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  console.log(`\n=== ${label} [${res.status}] ===`);
  console.log(typeof body === "string" ? body : JSON.stringify(body, null, 2));
  return { ok: res.ok, body };
}

const step = process.argv[2] ?? "all";

if (step === "verify" || step === "all") {
  const r = await fetch(`${API}/projects/${REF}`, { headers: H });
  await j("PROJECT", r);
}

if (step === "schema" || step === "all") {
  const sql = readFileSync(
    new URL("../supabase/schema.sql", import.meta.url),
    "utf8"
  );
  const r = await fetch(`${API}/projects/${REF}/database/query`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ query: sql }),
  });
  await j("RUN schema.sql", r);
}

if (step === "auth" || step === "all") {
  const r = await fetch(`${API}/projects/${REF}/config/auth`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({
      site_url: "http://localhost:3000",
      uri_allow_list: [
        "http://localhost:3000/**",
        "http://localhost:3001/**",
        "https://tteungureum.club/**",
        "https://*.vercel.app/**",
      ].join(","),
    }),
  });
  await j("AUTH config (site_url + redirect allow list)", r);
}

if (step === "kakao") {
  const r = await fetch(`${API}/projects/${REF}/config/auth`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({
      external_kakao_enabled: true,
      external_kakao_client_id: process.env.KAKAO_ID,
      external_kakao_secret: process.env.KAKAO_SECRET,
    }),
  });
  const { body } = await j("KAKAO provider", r);
  console.log("\nenabled:", body.external_kakao_enabled);
  console.log("client_id:", body.external_kakao_client_id);
}

if (step === "keys" || step === "all") {
  const r = await fetch(`${API}/projects/${REF}/api-keys?reveal=true`, {
    headers: H,
  });
  await j("API KEYS", r);
}
