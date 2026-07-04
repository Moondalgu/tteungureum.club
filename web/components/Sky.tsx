"use client";

import { useEffect } from "react";

// 픽셀 하늘 배경 (3레이어 파랄랙스) + 구름 퍼프 이스터에그.
//
// 레이어 구조: 원경(작고 연함) / 중경 / 근경(크고 진함), 속도비 1:2:4,
// 같은 방향 등속 — 다방향 파랄랙스는 전정기관 트리거라 금지.
// 모션 설정: localStorage "skyMotion" = "on"(모션최소화보다 우선 재생) | "off"(정지).
// 미설정 시 OS prefers-reduced-motion 을 따른다. 토글은 프로필 페이지에.

// 브랜드 픽셀 구름 (흰 몸통 + 잉크 아웃라인) — 퍼프 스프라이트
const PUFF_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" width="24" height="24" shape-rendering="crispEdges"><g fill="#fff"><rect x="5" y="3" width="3" height="1"/><rect x="4" y="4" width="5" height="1"/><rect x="2" y="5" width="8" height="3"/></g><g fill="#21133a"><rect x="5" y="2" width="3" height="1"/><rect x="4" y="3" width="1" height="1"/><rect x="8" y="3" width="1" height="1"/><rect x="2" y="4" width="2" height="1"/><rect x="9" y="4" width="1" height="1"/><rect x="1" y="5" width="1" height="3"/><rect x="10" y="5" width="1" height="3"/><rect x="1" y="8" width="10" height="1"/></g></svg>`;

// 퍼프를 띄우지 않을 영역 — 콘텐츠/인터랙티브 요소 위 탭은 순수 여백이 아니다
const PUFF_EXCLUDE =
  "button, a, input, textarea, select, label, canvas, header, " +
  ".card, .meeting-item, .topic, .topic-hero, .rhead, .date-chip, " +
  ".modal, .dialog, .overlay, .tabbar, .pane-tabs, .voice-mini, " +
  ".chat-log, .launcher, .float-timer, .toolbar, .share-stage";

function spawnPuff(x: number, y: number) {
  const el = document.createElement("div");
  el.className = "puff";
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.innerHTML = PUFF_SVG;
  document.body.appendChild(el);
  // reduced-motion 등으로 애니메이션이 즉시 끝나도 반드시 제거되게 이중 안전망
  el.addEventListener("animationend", () => el.remove());
  setTimeout(() => el.remove(), 1000);
}

export function Sky() {
  // 저장된 모션 설정 복원
  useEffect(() => {
    const v = localStorage.getItem("skyMotion");
    if (v === "on" || v === "off") document.documentElement.dataset.sky = v;
  }, []);

  // 구름 퍼프: 여백을 "탭"(move 없는 짧은 터치/클릭)했을 때만.
  // 사용자 트리거 모션이라 WCAG 2.2.2/주의력 문제와 무관하다.
  useEffect(() => {
    let sx = 0;
    let sy = 0;
    let st = 0;
    function onDown(e: PointerEvent) {
      sx = e.clientX;
      sy = e.clientY;
      st = Date.now();
    }
    function onUp(e: PointerEvent) {
      if (Date.now() - st > 350) return; // 길게 누름 제외
      if (Math.hypot(e.clientX - sx, e.clientY - sy) > 8) return; // 드래그/스크롤 제외
      const t = e.target as HTMLElement | null;
      if (!t || t.closest(PUFF_EXCLUDE)) return;
      spawnPuff(e.clientX, e.clientY);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", onUp);
    };
  }, []);

  return (
    <div className="sky" aria-hidden>
      <div className="cl far" />
      <div className="cl mid" />
      <div className="cl near" />
    </div>
  );
}
