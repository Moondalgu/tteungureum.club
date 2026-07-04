"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "./ConfirmDialog";
import type { Stroke, StrokePayload } from "@/lib/types";

// 내부 캔버스 해상도(고정). 화면에는 CSS 로 늘려서 표시.
const W = 1280;
const H = 720;
const COLORS = ["#111111", "#e03131", "#1971c2", "#2f9e44", "#f08c00", "#ae3ec9"];

export function Whiteboard({
  roomId,
  initialStrokes,
}: {
  roomId: number;
  initialStrokes: Stroke[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawing = useRef(false);
  const current = useRef<StrokePayload | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(4);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  // 전체 지우기는 방 전원의 보드 + DB 획을 삭제(복구 불가) — 반드시 확인
  const [confirmClear, setConfirmClear] = useState(false);

  // 한 획 그리기 (erase=true 면 지우개: 픽셀 제거)
  function drawStroke(ctx: CanvasRenderingContext2D, s: StrokePayload) {
    if (s.points.length === 0) return;
    ctx.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (let i = 1; i < s.points.length; i++) {
      ctx.lineTo(s.points[i].x, s.points[i].y);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }

  function redrawAll(strokes: StrokePayload[]) {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    strokes.forEach((s) => drawStroke(ctx, s));
  }

  useEffect(() => {
    const canvas = canvasRef.current!;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctxRef.current = ctx;

    // 기존 획 렌더
    redrawAll(initialStrokes.map((s) => s.payload));

    // Realtime 구독
    const supabase = createClient();
    const channel = supabase.channel(`whiteboard-${roomId}`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "stroke" }, ({ payload }) => {
        drawStroke(ctx, payload as StrokePayload);
      })
      .on("broadcast", { event: "clear" }, () => {
        ctx.clearRect(0, 0, W, H);
      })
      .subscribe();
    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // 화면 좌표 → 내부 좌표
  function toLocal(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  function onDown(e: React.PointerEvent) {
    drawing.current = true;
    const erase = tool === "eraser";
    current.current = {
      points: [toLocal(e)],
      color,
      size: erase ? size * 4 : size,
      erase,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onMove(e: React.PointerEvent) {
    if (!drawing.current || !current.current) return;
    const p = toLocal(e);
    const pts = current.current.points;
    pts.push(p);
    // 즉시 로컬 렌더(마지막 선분만)
    const ctx = ctxRef.current!;
    ctx.globalCompositeOperation = current.current.erase
      ? "destination-out"
      : "source-over";
    ctx.strokeStyle = current.current.color;
    ctx.lineWidth = current.current.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }

  async function onUp() {
    if (!drawing.current || !current.current) return;
    drawing.current = false;
    const stroke = current.current;
    current.current = null;
    if (stroke.points.length < 1) return;

    // 다른 사용자에게 실시간 전송
    channelRef.current?.send({
      type: "broadcast",
      event: "stroke",
      payload: stroke,
    });
    // 영속화(새로 입장하는 사람이 볼 수 있게)
    const supabase = createClient();
    await supabase.from("strokes").insert({ room_id: roomId, payload: stroke });
  }

  async function clearBoard() {
    const ctx = ctxRef.current!;
    ctx.clearRect(0, 0, W, H);
    channelRef.current?.send({ type: "broadcast", event: "clear", payload: {} });
    const supabase = createClient();
    await supabase.from("strokes").delete().eq("room_id", roomId);
  }

  return (
    <div className="wb-wrap">
      <div className="wb-tools">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => {
              setColor(c);
              setTool("pen");
            }}
            title={c}
            className={`swatch ${tool === "pen" && color === c ? "active" : ""}`}
            style={{ background: c }}
          />
        ))}
        <button
          className={`btn ${tool === "pen" ? "primary" : ""}`}
          onClick={() => setTool("pen")}
        >
          펜
        </button>
        <button
          className={`btn ${tool === "eraser" ? "primary" : ""}`}
          onClick={() => setTool("eraser")}
        >
          지우개
        </button>
        <label className="small row" style={{ gap: 6 }}>
          굵기
          <input
            type="range"
            min={1}
            max={20}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          />
        </label>
        <button className="btn" onClick={() => setConfirmClear(true)}>
          전체 지우기
        </button>
      </div>
      <ConfirmDialog
        open={confirmClear}
        title="보드를 전부 지울까요?"
        message="방에 있는 모두의 화이트보드가 지워지고 되돌릴 수 없어요."
        confirmText="전체 지우기"
        danger
        onConfirm={() => {
          setConfirmClear(false);
          clearBoard();
        }}
        onCancel={() => setConfirmClear(false)}
      />
      <canvas
        ref={canvasRef}
        className="whiteboard"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      />
    </div>
  );
}
