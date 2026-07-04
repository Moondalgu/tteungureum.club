"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// 중첩 모달 대응:
// - 스크롤 잠금은 refcount 로 관리해 어떤 순서로 닫혀도 정확히 복원된다.
// - Esc/Tab 은 스택 최상단 오버레이만 처리한다 (한 번의 Esc 로 전부 닫히지 않게).
const overlayStack: symbol[] = [];
let scrollLocks = 0;
let savedOverflow = "";

function lockScroll() {
  if (scrollLocks++ === 0) {
    const scroller = document.querySelector<HTMLElement>(".app-scroll");
    if (scroller) {
      savedOverflow = scroller.style.overflow;
      scroller.style.overflow = "hidden";
    }
  }
}
function unlockScroll() {
  if (--scrollLocks === 0) {
    const scroller = document.querySelector<HTMLElement>(".app-scroll");
    if (scroller) scroller.style.overflow = savedOverflow;
  }
}

// 모달 공용 셸: 배경 클릭/Esc 닫기 + 포커스 트랩 + 배경 스크롤 잠금 + 닫힐 때 포커스 복귀.
// 모바일에선 CSS(.overlay 미디어쿼리)가 바텀시트로 바꿔준다.
export function Overlay({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const idRef = useRef<symbol>(undefined as unknown as symbol);
  if (!idRef.current) idRef.current = Symbol("overlay");
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // 다이얼로그 안에서 시작한 드래그(텍스트 선택)가 배경에서 끝나면 click 이
  // 배경으로 버블되는데, 그때 닫히면 폼 입력이 날아간다 — 시작점을 추적한다.
  const downOnBackdrop = useRef(false);

  useEffect(() => {
    const overlay = ref.current;
    if (!overlay) return;
    const id = idRef.current;
    overlayStack.push(id);
    const prevFocus = document.activeElement as HTMLElement | null;
    lockScroll();

    // 첫 포커스는 다이얼로그 안으로
    overlay.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    function onKey(e: KeyboardEvent) {
      // 중첩 시 최상단 오버레이만 반응
      if (overlayStack[overlayStack.length - 1] !== id) return;
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const els = Array.from(overlay!.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const i = overlayStack.indexOf(id);
      if (i >= 0) overlayStack.splice(i, 1);
      unlockScroll();
      prevFocus?.focus();
    };
  }, []);

  return (
    <div
      className="overlay"
      ref={ref}
      onPointerDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (downOnBackdrop.current && e.target === e.currentTarget) {
          onCloseRef.current();
        }
        downOnBackdrop.current = false;
      }}
    >
      {children}
    </div>
  );
}
