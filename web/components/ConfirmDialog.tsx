"use client";

// 재사용 확인 모달. 오버레이 클릭/취소 → onCancel, 확인 → onConfirm.
export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "확인",
  cancelText = "취소",
  danger = false,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="overlay" onClick={onCancel}>
      <div
        className="card dialog"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: 0 }}>{title}</h3>
        {message && (
          <p className="muted small" style={{ margin: 0 }}>
            {message}
          </p>
        )}
        {error && (
          <p className="small" style={{ margin: 0, color: "var(--pink-deep)" }}>
            {error}
          </p>
        )}
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="btn" onClick={onCancel} disabled={busy}>
            {cancelText}
          </button>
          <button
            className={`btn ${danger ? "danger" : "primary"}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "처리 중..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
