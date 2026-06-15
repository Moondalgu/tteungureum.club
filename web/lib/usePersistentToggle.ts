"use client";

import { useEffect, useRef, useState } from "react";

// boolean 토글 상태를 localStorage 에 저장/복원한다.
// SSR/hydration 안전: 서버·첫 렌더는 defaultValue 로 그리고,
// 마운트 후 저장값이 있으면 덮어쓴다(없으면 default 유지).
export function usePersistentToggle(key: string, defaultValue: boolean) {
  const [value, setValue] = useState(defaultValue);
  const loaded = useRef(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(key);
    if (saved !== null) setValue(saved === "1");
    loaded.current = true;
  }, [key]);

  useEffect(() => {
    if (!loaded.current) return;
    window.localStorage.setItem(key, value ? "1" : "0");
  }, [key, value]);

  return [value, setValue] as const;
}
