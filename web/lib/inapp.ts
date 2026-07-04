// 카카오톡 인앱브라우저 감지/탈출 유틸.
// 인앱 웹뷰는 마이크 권한(getUserMedia)이 불안정해 음성 참여만 외부 브라우저로 유도한다.
// 모임 열람/투표/채팅은 인앱에서 그대로 동작한다.

export function isKakaoInApp(): boolean {
  if (typeof navigator === "undefined") return false;
  return /KAKAOTALK/i.test(navigator.userAgent);
}

// 카톡 인앱 전용 스킴 — Android/iOS 공통으로 기본 브라우저를 띄운다.
export function openExternalBrowser(url?: string) {
  const target = url ?? window.location.href;
  window.location.href =
    "kakaotalk://web/openExternal?url=" + encodeURIComponent(target);
}
