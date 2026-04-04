import React from "react";
import { X } from "lucide-react";

interface ModalPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  maxWidthClass?: string;
  zIndexClass?: string;
  contentClassName?: string;
  headerActions?: React.ReactNode;
}

export default function ModalPanel({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  maxWidthClass = "max-w-2xl",
  zIndexClass = "z-[220]",
  contentClassName = "",
  headerActions,
}: ModalPanelProps) {
  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-4`}>
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close modal"
      />

      <div className={`relative w-full ${maxWidthClass} overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(12,18,33,0.92))] shadow-[0_32px_90px_rgba(0,0,0,0.45)]`}>
        {(title || subtitle || icon || headerActions) ? (
          <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                {icon ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/80">
                    {icon}
                  </div>
                ) : null}
                <div className="min-w-0">
                  {title ? <h2 className="text-lg font-semibold text-white">{title}</h2> : null}
                  {subtitle ? <p className="mt-1 text-sm leading-relaxed text-white/55">{subtitle}</p> : null}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {headerActions}
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        <div className={`max-h-[80vh] overflow-y-auto px-6 py-5 ${contentClassName}`}>{children}</div>
      </div>
    </div>
  );
}