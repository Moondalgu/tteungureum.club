// 픽셀 구름 도트 작업 파이프라인
// - ASCII 그리드('#'=흰 픽셀)로 구름을 찍고 → 행 단위 run-length 병합 rect 로 SVG 생성
// - 1셀 = 8px (기존 타일과 동일한 블록 그리드)
// - 타일 400×300 배치, 경계 걸침은 자동 랩어라운드
// 사용: node clouds.mjs <outdir> → catalog.html, tile2x2.html, tile.dataurl.txt

import { writeFileSync } from "node:fs";

const CELL = 8;

// ── 구름 도트 ──
// 규칙: 평평한 바닥(+모서리 1셀 라운딩), 울퉁불퉁 윗면, 혹 3~4개 비대칭(최고점 40% 지점),
// 혹 사이 1셀 노치, 비율 ~2.5:1

// 대형 랜드마크 18×6 (144×48px): 혹 4개(peak/x5-7, x11-12, x15-16) + 좌측 어깨
const BIG = `
.....###..........
...######..##.....
.#############.##.
##################
##################
.################.
`;

// 중형 10×4 (80×32px): 혹 3개, 최고점 왼쪽
const MID = `
...##.....
.#####.##.
##########
.########.
`;

// 중형 변형 10×4: 최고점 오른쪽
const MID2 = `
......##..
.##..#####
##########
.########.
`;

// 소형 7×3 (56×24px): 혹 2셀 이상 — 1셀 혹은 점처럼 자잘해 보임
const SMALL = `
.##.##.
#######
.#####.
`;

// 소형 변형 7×3
const SMALL2 = `
.###.##
#######
.#####.
`;

function parse(art) {
  return art
    .split("\n")
    .map((r) => r.trimEnd())
    .filter((r) => r.length > 0);
}

function toRects(art) {
  const rows = parse(art);
  const rects = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] === "#") {
        let w = 1;
        while (row[x + w] === "#") w++;
        rects.push({ x, y, w });
        x += w;
      } else x++;
    }
  });
  return rects;
}

function shapeSvg(art, px = 0, py = 0) {
  return toRects(art)
    .map(
      (r) =>
        `<rect x='${px + r.x * CELL}' y='${py + r.y * CELL}' width='${r.w * CELL}' height='${CELL}'/>`
    )
    .join("");
}

function shapeSize(art) {
  const rows = parse(art);
  return { w: Math.max(...rows.map((r) => r.length)) * CELL, h: rows.length * CELL };
}

// ── 타일 배치 (480×360): 대1 + 중3 + 소4 — 주기를 키워 반복 체감 감소 ──
const TILE_W = 480;
const TILE_H = 360;

const PLACEMENTS = [
  { art: BIG, x: 56, y: 176 },     // 랜드마크 (좌중하)
  { art: MID, x: 300, y: 40 },     // 우상
  { art: MID2, x: 430, y: 250 },   // 우하 — 오른쪽 경계 랩어라운드
  { art: MID, x: 150, y: 310 },    // 중하
  { art: SMALL, x: 16, y: 64 },    // 좌상
  { art: SMALL2, x: 250, y: 140 }, // 중앙
  { art: SMALL, x: 370, y: 332 },  // 우하단 (세로 걸침 없음 — 화면 상단 잘림 방지)
  { art: SMALL2, x: 180, y: 24 },  // 상단 (타일 위 가장자리에서 띄움)
];
// 주의: 세로 랩어라운드는 쓰지 않는다 — 뷰포트 최상단(헤더 밑)에 몸통 없는
// 구름 밑동 조각이 노출된다. 이음새 은폐가 필요한 건 드리프트 방향(가로)뿐.

function tileUses() {
  let out = "";
  for (const p of PLACEMENTS) {
    const { w, h } = shapeSize(p.art);
    const copies = [[p.x, p.y]];
    if (p.x + w > TILE_W) copies.push([p.x - TILE_W, p.y]);
    if (p.y + h > TILE_H) copies.push([p.x, p.y - TILE_H]);
    if (p.x + w > TILE_W && p.y + h > TILE_H) copies.push([p.x - TILE_W, p.y - TILE_H]);
    for (const [cx, cy] of copies) out += shapeSvg(p.art, cx, cy);
  }
  return out;
}

function tileSvg() {
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${TILE_W}' height='${TILE_H}' shape-rendering='crispEdges'><g fill='white'>${tileUses()}</g></svg>`;
}

function coverage() {
  let cells = 0;
  for (const p of PLACEMENTS) cells += toRects(p.art).reduce((s, r) => s + r.w, 0);
  return (((cells * CELL * CELL) / (TILE_W * TILE_H)) * 100).toFixed(1);
}

const out = process.argv[2] ?? ".";

// 1) 카탈로그 (3배 확대)
const shapes = [
  ["BIG", BIG],
  ["MID", MID],
  ["MID2", MID2],
  ["SMALL", SMALL],
  ["SMALL2", SMALL2],
];
let cx = 20;
let catalogBody = "";
for (const [name, art] of shapes) {
  const { w } = shapeSize(art);
  catalogBody += `<g fill='white'>${shapeSvg(art, cx, 40)}</g>`;
  catalogBody += `<text x='${cx}' y='26' font-size='12' fill='#21133a'>${name}</text>`;
  cx += w + 32;
}
const catalogSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='${cx}' height='110' shape-rendering='crispEdges'><rect width='${cx}' height='110' fill='#8fd3ff'/>${catalogBody}</svg>`;
writeFileSync(
  `${out}/catalog.html`,
  `<body style="margin:0;background:#666"><div style="image-rendering:pixelated;width:${cx * 3}px">${catalogSvg.replace("<svg ", `<svg style='width:${cx * 3}px;height:330px;image-rendering:pixelated' `)}</div></body>`
);

// 2) 타일 2×2 반복 (이음새/줄무늬 검사, 빨간 점선 = 타일 경계)
const t = tileUses();
let grid = "";
for (const [ox, oy] of [[0, 0], [TILE_W, 0], [0, TILE_H], [TILE_W, TILE_H]]) {
  grid += `<g fill='white' transform='translate(${ox},${oy})'>${t}</g>`;
}
const tile2x2 = `<svg xmlns='http://www.w3.org/2000/svg' width='${TILE_W * 2}' height='${TILE_H * 2}' shape-rendering='crispEdges'><rect width='${TILE_W * 2}' height='${TILE_H * 2}' fill='#8fd3ff'/>${grid}<line x1='${TILE_W}' y1='0' x2='${TILE_W}' y2='${TILE_H * 2}' stroke='red' stroke-dasharray='4' opacity='.4'/><line x1='0' y1='${TILE_H}' x2='${TILE_W * 2}' y2='${TILE_H}' stroke='red' stroke-dasharray='4' opacity='.4'/></svg>`;
writeFileSync(`${out}/tile2x2.html`, `<body style="margin:0">${tile2x2}</body>`);

// 3) CSS data URI
const enc = encodeURIComponent(tileSvg()).replace(/'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29");
writeFileSync(`${out}/tile.dataurl.txt`, `url("data:image/svg+xml,${enc}")`);

console.log(`coverage: ${coverage()}% (목표 13~20)`);
console.log("written: catalog.html, tile2x2.html, tile.dataurl.txt");
