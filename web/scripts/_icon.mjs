import sharp from "sharp";
import { writeFileSync } from "node:fs";

const INK = "#21133a";

// 구름 도형(겹치는 원 + 바닥 슬랩). r/크기를 부풀려 외곽선 그룹을 만든다.
function cloud(grow = 0, fill = "#ffffff") {
  const c = (cx, cy, r) =>
    `<circle cx="${cx}" cy="${cy}" r="${r + grow}" fill="${fill}"/>`;
  const slab = `<rect x="${150 - grow}" y="${250 - grow}" width="${
    210 + grow * 2
  }" height="${70 + grow * 2}" rx="${38 + grow}" fill="${fill}"/>`;
  return (
    slab +
    c(192, 252, 56) +
    c(252, 222, 72) +
    c(320, 248, 60) +
    c(356, 270, 46)
  );
}

function sparkle(x, y, s) {
  // 픽셀 반짝이: 십자 형태(흰색 + 진한 외곽)
  const o = s + 5;
  const cross = (a, c) =>
    `<rect x="${x - a}" y="${y - a / 3}" width="${a * 2}" height="${
      (a * 2) / 3
    }" fill="${c}"/>` +
    `<rect x="${x - a / 3}" y="${y - a}" width="${(a * 2) / 3}" height="${
      a * 2
    }" fill="${c}"/>`;
  return cross(o, INK) + cross(s, "#fff");
}

const svg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7fccff"/>
      <stop offset="0.5" stop-color="#aae0ff"/>
      <stop offset="1" stop-color="#dff3ff"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="104" fill="url(#sky)"/>
  <rect x="11" y="11" width="490" height="490" rx="94" fill="none" stroke="${INK}" stroke-width="22"/>

  <!-- 작은 보조 구름 (좌상단, 완전히 내부) -->
  <g transform="translate(18,34) scale(0.34)" opacity="0.85">
    ${cloud(13, INK)}
    ${cloud(0, "#ffffff")}
  </g>

  <!-- 메인 구름: 그림자 -> 외곽선 -> 흰색 -->
  <g transform="translate(0,18)">
    <g transform="translate(14,22)" opacity="0.22">${cloud(13, INK)}</g>
    ${cloud(13, INK)}
    ${cloud(0, "#ffffff")}
  </g>

  <!-- 반짝이 -->
  ${sparkle(402, 150, 17)}
  ${sparkle(120, 360, 13)}
</svg>`;

writeFileSync(new URL("./_icon.svg", import.meta.url), svg);

const outDesktop = "C:/Users/Jeongmin Moon/Desktop/app-icon.png";
await sharp(Buffer.from(svg)).png().resize(512, 512).toFile(outDesktop);
console.log("saved:", outDesktop);
