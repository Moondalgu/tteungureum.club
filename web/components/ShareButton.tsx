"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { IconShare } from "./icons";

// 방 링크를 클립보드에 복사하는 버튼.
// path 를 주면 origin + path (예: /rooms/12) 를, 없으면 현재 페이지 URL을 복사한다.
export function ShareButton({
  path,
  label,
  className = "btn sm cyan",
  style,
}: {
  path?: string;
  label?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = path ? `${window.location.origin}${path}` : window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // 비보안 컨텍스트 등에서의 폴백
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* noop */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={copy}
      aria-label="방 링크 복사"
    >
      {copied ? (
        "복사됨!"
      ) : (
        label ?? (
          <>
            <IconShare size={12} /> 공유
          </>
        )
      )}
    </button>
  );
}
