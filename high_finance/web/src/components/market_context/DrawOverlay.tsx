import { useEffect } from "react";

export function DrawerOverlay({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 40,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(2px)",
        display: "flex",
        justifyContent: "flex-end",
      }}
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title || "Details"}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          height: "100%",
          background: "#0f0f0f",
          borderLeft: "1px solid #333",
          padding: 20,
          overflowY: "auto",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}