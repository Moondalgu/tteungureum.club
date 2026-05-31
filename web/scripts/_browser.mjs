import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const TARGET =
  process.argv[2] ??
  "https://developers.kakao.com/console/app/1473534/config/platform-key";

const userDataDir = fileURLToPath(new URL("./.userdata", import.meta.url));

const ctx = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  viewport: null,
  args: ["--remote-debugging-port=9222"],
});

// auto-accept any JS dialogs so they don't crash the session
ctx.on("page", (p) => p.on("dialog", (d) => d.accept().catch(() => {})));

const page = ctx.pages()[0] ?? (await ctx.newPage());
page.on("dialog", (d) => d.accept().catch(() => {}));
await page.goto(TARGET, { waitUntil: "domcontentloaded" });

console.log("OPENED:", TARGET);
console.log("CDP: http://localhost:9222");
console.log("Log in if needed, then leave open.");

await new Promise(() => {});
