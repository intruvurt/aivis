import React from 'react';

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
  maxWidthClass = 'max-w-7xl',
}: AppPageFrameProps) {
  return (
    <div className={`mx-auto w-full ${maxWidthClass} space-y-6 text-white animate-fade-up`}>
      <section className="relative overflow-hidden rounded-[30px] border border-[#f4b860]/15 bg-[linear-gradient(145deg,rgba(28,22,18,0.95),rgba(13,11,10,0.98))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.32)] sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,138,61,0.14),transparent_28%),radial-gradient(circle_at_85%_0%,rgba(86,195,182,0.1),transparent_24%)]" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              {icon ? (
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-[#f4b860]/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] text-[#ffe5c1] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  {icon}
                </div>
              ) : null}
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#f4b860]/70">
                  Operator workspace
                </div>
                <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#fff4e6] sm:text-3xl">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/68 sm:text-[15px]">
                    {subtitle}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {actions ? (
            <div className="relative z-[1] flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      </section>

      {children}
    </div>
  );
}
