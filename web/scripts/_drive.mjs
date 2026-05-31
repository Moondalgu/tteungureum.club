import { chromium } from "playwright";

const browser = await chromium.connectOverCDP("http://localhost:9222");
const ctx = browser.contexts()[0];
const page = ctx.pages()[0];
page.on("dialog", (d) => d.accept().catch(() => {}));
await page.setViewportSize({ width: 1000, height: 760 });

await page.goto("http://localhost:3000/box", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.screenshot({ path: "scripts/_final_box.png" });

await page.goto("http://localhost:3000/profile", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: "scripts/_final_profile.png" });
console.log("done");
