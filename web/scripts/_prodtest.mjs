import { chromium } from "playwright";

const SITE = "https://tteungureum-club.vercel.app";
const browser = await chromium.connectOverCDP("http://localhost:9222");
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
page.on("dialog", (d) => d.accept().catch(() => {}));
await page.setViewportSize({ width: 1000, height: 760 });

await page.goto(SITE, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

// try to find a login button
const loginBtn = page.getByText(/카카오|로그인/).first();
const hasLogin = await loginBtn.count();
console.log("login button count:", hasLogin);

if (hasLogin) {
  await loginBtn.click().catch((e) => console.log("click err", e.message));
  await page.waitForTimeout(3000);
  // kakao consent if shown
  for (const label of ["전체 동의", "전체 선택", "동의하고 계속", "동의", "계속"]) {
    const b = page.getByText(new RegExp(label)).first();
    if (await b.count()) {
      await b.click().catch(() => {});
      await page.waitForTimeout(1500);
    }
  }
  await page.waitForTimeout(3000);
}

console.log("final url:", page.url());
const body = await page.evaluate(() => document.body.innerText.slice(0, 300));
console.log("body:", body);
await page.screenshot({ path: "scripts/_prod_home.png" });
console.log("done");
