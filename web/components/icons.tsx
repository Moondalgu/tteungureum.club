import type { SVGProps } from "react";

// ── 픽셀 아이콘 시스템 ──
// 12×12 정수 그리드에 fill 전용 <rect>로만 작도 (stroke 금지, 서브픽셀 좌표 금지).
// 획 굵기는 그리드 1유닛 고정 — 24px(2×) 렌더 시 2px 획이 되어
// Galmuri(1px 획, 12px 기준) 옆에서 광학적으로 균형이 맞는다.
// 표시 크기는 반드시 12의 정수배(12/24/36…)만 사용할 것 — 비정수배는 픽셀이 뭉개진다.
// 색은 루트 svg 의 fill="currentColor" 하나로 제어 (활성/비활성 = CSS color 스왑).

type PixelIconProps = SVGProps<SVGSVGElement> & {
  /** 12의 배수만 (12, 24, 36…) */
  size?: number;
};

function Px({
  size = 24,
  children,
  ...rest
}: PixelIconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 12 12"
      width={size}
      height={size}
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

/* 구름 (홈) — 배경 구름과 같은 실루엣 언어 */
export function IconCloud(props: PixelIconProps) {
  return (
    <Px {...props}>
      <rect x="5" y="2" width="3" height="1" />
      <rect x="4" y="3" width="1" height="1" />
      <rect x="8" y="3" width="1" height="1" />
      <rect x="2" y="4" width="2" height="1" />
      <rect x="9" y="4" width="1" height="1" />
      <rect x="1" y="5" width="1" height="3" />
      <rect x="10" y="5" width="1" height="3" />
      <rect x="1" y="8" width="10" height="1" />
    </Px>
  );
}

export function IconCloudFill(props: PixelIconProps) {
  return (
    <Px {...props}>
      <rect x="5" y="2" width="3" height="1" />
      <rect x="4" y="3" width="5" height="1" />
      <rect x="2" y="4" width="8" height="1" />
      <rect x="1" y="5" width="10" height="4" />
    </Px>
  );
}

/* 상자 (N의 상자) — 뚜껑 + 손잡이 슬롯 */
export function IconBox(props: PixelIconProps) {
  return (
    <Px {...props}>
      <rect x="1" y="2" width="10" height="1" />
      <rect x="1" y="3" width="1" height="2" />
      <rect x="10" y="3" width="1" height="2" />
      <rect x="2" y="4" width="8" height="1" />
      <rect x="2" y="5" width="1" height="5" />
      <rect x="9" y="5" width="1" height="5" />
      <rect x="2" y="10" width="8" height="1" />
      <rect x="4" y="6" width="4" height="1" />
    </Px>
  );
}

export function IconBoxFill(props: PixelIconProps) {
  return (
    <Px {...props}>
      <rect x="1" y="2" width="10" height="3" />
      <rect x="2" y="5" width="8" height="1" />
      <rect x="2" y="6" width="2" height="1" />
      <rect x="8" y="6" width="2" height="1" />
      <rect x="2" y="7" width="8" height="4" />
    </Px>
  );
}

/* 사람 (프로필) */
export function IconUser(props: PixelIconProps) {
  return (
    <Px {...props}>
      <rect x="5" y="1" width="2" height="1" />
      <rect x="4" y="2" width="1" height="2" />
      <rect x="7" y="2" width="1" height="2" />
      <rect x="5" y="4" width="2" height="1" />
      <rect x="4" y="7" width="4" height="1" />
      <rect x="3" y="8" width="1" height="1" />
      <rect x="8" y="8" width="1" height="1" />
      <rect x="2" y="9" width="1" height="1" />
      <rect x="9" y="9" width="1" height="1" />
      <rect x="2" y="10" width="8" height="1" />
    </Px>
  );
}

export function IconUserFill(props: PixelIconProps) {
  return (
    <Px {...props}>
      <rect x="5" y="1" width="2" height="1" />
      <rect x="4" y="2" width="4" height="2" />
      <rect x="5" y="4" width="2" height="1" />
      <rect x="4" y="7" width="4" height="1" />
      <rect x="3" y="8" width="6" height="1" />
      <rect x="2" y="9" width="8" height="2" />
    </Px>
  );
}

/* 말풍선 + 점점점 (토론) — 꼬리 왼쪽 */
export function IconTalk(props: PixelIconProps) {
  return (
    <Px {...props}>
      <rect x="2" y="1" width="8" height="1" />
      <rect x="1" y="2" width="1" height="5" />
      <rect x="10" y="2" width="1" height="5" />
      <rect x="2" y="7" width="8" height="1" />
      <rect x="3" y="8" width="2" height="1" />
      <rect x="3" y="9" width="1" height="1" />
      <rect x="3" y="4" width="1" height="1" />
      <rect x="5" y="4" width="1" height="1" />
      <rect x="7" y="4" width="1" height="1" />
    </Px>
  );
}

/* 말풍선 + 글줄 (채팅) — 꼬리 오른쪽 */
export function IconChat(props: PixelIconProps) {
  return (
    <Px {...props}>
      <rect x="2" y="1" width="8" height="1" />
      <rect x="1" y="2" width="1" height="5" />
      <rect x="10" y="2" width="1" height="5" />
      <rect x="2" y="7" width="8" height="1" />
      <rect x="7" y="8" width="2" height="1" />
      <rect x="8" y="9" width="1" height="1" />
      <rect x="3" y="3" width="6" height="1" />
      <rect x="3" y="5" width="4" height="1" />
    </Px>
  );
}

/* 모니터 (온라인) */
export function IconMonitor(props: PixelIconProps) {
  return (
    <Px {...props}>
      <rect x="1" y="2" width="10" height="1" />
      <rect x="1" y="3" width="1" height="4" />
      <rect x="10" y="3" width="1" height="4" />
      <rect x="1" y="7" width="10" height="1" />
      <rect x="5" y="8" width="2" height="2" />
      <rect x="3" y="10" width="6" height="1" />
    </Px>
  );
}

/* 맵핀 (오프라인) */
export function IconPin(props: PixelIconProps) {
  return (
    <Px {...props}>
      <rect x="4" y="1" width="4" height="1" />
      <rect x="3" y="2" width="2" height="2" />
      <rect x="7" y="2" width="2" height="2" />
      <rect x="3" y="4" width="6" height="1" />
      <rect x="4" y="5" width="4" height="2" />
      <rect x="5" y="7" width="2" height="3" />
    </Px>
  );
}

/* 반짝이 (확정/축하) */
export function IconStar(props: PixelIconProps) {
  return (
    <Px {...props}>
      <rect x="5" y="1" width="2" height="3" />
      <rect x="5" y="8" width="2" height="3" />
      <rect x="1" y="5" width="3" height="2" />
      <rect x="8" y="5" width="3" height="2" />
      <rect x="4" y="4" width="4" height="4" />
    </Px>
  );
}

/* 마이크 */
export function IconMic(props: PixelIconProps) {
  return (
    <Px {...props}>
      <rect x="5" y="1" width="2" height="1" />
      <rect x="4" y="2" width="4" height="3" />
      <rect x="5" y="5" width="2" height="1" />
      <rect x="2" y="4" width="1" height="2" />
      <rect x="9" y="4" width="1" height="2" />
      <rect x="3" y="6" width="6" height="1" />
      <rect x="5" y="7" width="2" height="2" />
      <rect x="3" y="9" width="6" height="1" />
    </Px>
  );
}

/* 시계 (타이머) */
export function IconClock(props: PixelIconProps) {
  return (
    <Px {...props}>
      <rect x="3" y="1" width="6" height="1" />
      <rect x="2" y="2" width="1" height="1" />
      <rect x="9" y="2" width="1" height="1" />
      <rect x="1" y="3" width="1" height="6" />
      <rect x="10" y="3" width="1" height="6" />
      <rect x="2" y="9" width="1" height="1" />
      <rect x="9" y="9" width="1" height="1" />
      <rect x="3" y="10" width="6" height="1" />
      <rect x="5" y="3" width="1" height="3" />
      <rect x="6" y="6" width="2" height="1" />
    </Px>
  );
}

/* 연필 (화이트보드) */
export function IconBrush(props: PixelIconProps) {
  return (
    <Px {...props}>
      <rect x="8" y="1" width="2" height="2" />
      <rect x="7" y="3" width="2" height="1" />
      <rect x="6" y="4" width="2" height="1" />
      <rect x="5" y="5" width="2" height="1" />
      <rect x="4" y="6" width="2" height="1" />
      <rect x="3" y="7" width="2" height="1" />
      <rect x="2" y="8" width="2" height="1" />
      <rect x="2" y="9" width="1" height="1" />
    </Px>
  );
}

/* 체크 (완료) */
export function IconCheck(props: PixelIconProps) {
  return (
    <Px {...props}>
      <rect x="8" y="3" width="2" height="1" />
      <rect x="7" y="4" width="2" height="1" />
      <rect x="6" y="5" width="2" height="1" />
      <rect x="5" y="6" width="2" height="1" />
      <rect x="4" y="7" width="2" height="1" />
      <rect x="2" y="5" width="2" height="1" />
      <rect x="3" y="6" width="2" height="1" />
    </Px>
  );
}

/* 공유 (위로 나가는 화살표 + 트레이) */
export function IconShare(props: PixelIconProps) {
  return (
    <Px {...props}>
      <rect x="5" y="1" width="2" height="1" />
      <rect x="3" y="2" width="2" height="1" />
      <rect x="7" y="2" width="2" height="1" />
      <rect x="5" y="2" width="2" height="6" />
      <rect x="1" y="6" width="1" height="4" />
      <rect x="10" y="6" width="1" height="4" />
      <rect x="1" y="10" width="10" height="1" />
    </Px>
  );
}

/* 뒤로가기 셰브론 */
export function IconChevronLeft(props: PixelIconProps) {
  return (
    <Px {...props}>
      <rect x="6" y="1" width="2" height="1" />
      <rect x="5" y="2" width="2" height="1" />
      <rect x="4" y="3" width="2" height="1" />
      <rect x="3" y="4" width="2" height="1" />
      <rect x="2" y="5" width="2" height="2" />
      <rect x="3" y="7" width="2" height="1" />
      <rect x="4" y="8" width="2" height="1" />
      <rect x="5" y="9" width="2" height="1" />
      <rect x="6" y="10" width="2" height="1" />
    </Px>
  );
}

/* 플러스 (도구/추가) */
export function IconPlus(props: PixelIconProps) {
  return (
    <Px {...props}>
      <rect x="5" y="2" width="2" height="8" />
      <rect x="2" y="5" width="8" height="2" />
    </Px>
  );
}

/* 브랜드 구름 — 로고 텍스트(흰색+잉크 아웃라인)와 같은 2톤 처리라 색 고정 */
export function BrandCloud({ size = 24 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 12 12"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden
    >
      <g fill="#fff">
        <rect x="5" y="3" width="3" height="1" />
        <rect x="4" y="4" width="5" height="1" />
        <rect x="2" y="5" width="8" height="3" />
      </g>
      <g fill="#21133a">
        <rect x="5" y="2" width="3" height="1" />
        <rect x="4" y="3" width="1" height="1" />
        <rect x="8" y="3" width="1" height="1" />
        <rect x="2" y="4" width="2" height="1" />
        <rect x="9" y="4" width="1" height="1" />
        <rect x="1" y="5" width="1" height="3" />
        <rect x="10" y="5" width="1" height="3" />
        <rect x="1" y="8" width="10" height="1" />
      </g>
    </svg>
  );
}
