import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Centered modal width (ignored for drawer) */
  maxWidthClass?: string; // e.g., "max-w-4xl"
  /** "modal" (centered) or "drawer-right" (slide-in panel) */
  variant?: "modal" | "drawer-right";
  /** Hide the top-right close (X) button */
  hideClose?: boolean;
  /** Controls max width when variant = modal */
  size?: 'sm' | 'md' | 'lg';
};

export default function Modal({
  open,
  title,
  onClose,
  children,
  maxWidthClass = "max-w-4xl",   // smaller than before
  variant = "modal",             // DEFAULT → CENTERED MODAL
  hideClose = false,
  size = 'md',
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      aria-modal="true"
      role="dialog"
      className="fixed inset-0 z-50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/40" />

      {variant === "modal" ? (
        <div className="relative z-10 h-full flex items-center justify-center p-4 re-modal">
          <div
            ref={dialogRef}
            tabIndex={-1}
            className={`w-full ${maxWidthClass || ''} ${!maxWidthClass ? (size === 'sm' ? 'max-w-[480px]' : size === 'lg' ? 'max-w-[1024px]' : 'max-w-[720px]') : ''} mx-auto rounded-2xl bg-white shadow-xl`}
          >
            <Header title={title} onClose={onClose} hideClose={hideClose} />
            <div className="p-3 overflow-y-auto max-h-[80vh]">{children}</div>
          </div>
        </div>
      ) : (
        <div className="absolute inset-y-0 right-0 z-10 h-full w-full sm:w-[520px] bg-white shadow-xl re-modal">
          <div ref={dialogRef} tabIndex={-1} className="h-full flex flex-col">
            <Header title={title} onClose={onClose} hideClose={hideClose} />
            <div className="p-3 overflow-y-auto grow">{children}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Header({ title, onClose, hideClose }: { title?: string; onClose: () => void; hideClose?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {!hideClose && (
        <button aria-label="Close" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
          <X className="w-5 h-5 text-slate-500" />
        </button>
      )}
    </div>
  );
}
