import React from "react";

interface AppPageFrameProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  maxWidthClass?: string;
}

export default function AppPageFrame({
  icon,
  title,
  subtitle,
  actions,
  children,
  maxWidthClass = "max-w-7xl",
}: AppPageFrameProps) {
  return (
    <div className={`mx-auto w-full ${maxWidthClass} space-y-6 text-white animate-fade-up`}>
      <section className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(12,18,33,0.92))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              {icon ? (
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  {icon}
                </div>
              ) : null}
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h1>
                {subtitle ? <p className="mt-1 max-w-3xl text-sm leading-relaxed text-white/60">{subtitle}</p> : null}
              </div>
            </div>
          </div>

          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </section>

      {children}
    </div>
  );
}