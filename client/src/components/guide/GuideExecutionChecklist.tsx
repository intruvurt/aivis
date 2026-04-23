import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckSquare, Clock3, Square } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { GuideChecklistItem, GuidePriority } from './guideTypes';

interface GuideExecutionChecklistProps {
  items: GuideChecklistItem[];
  storageKey?: string;
}

const PRIORITY_STYLES: Record<GuidePriority, string> = {
  critical: 'border-rose-400/25 bg-rose-500/10 text-rose-200',
  high: 'border-cyan-400/25 bg-cyan-500/10 text-cyan-200',
  medium: 'border-white/20 bg-white/5 text-white/75',
};

export default function GuideExecutionChecklist({
  items,
  storageKey = 'aivis_guide_checklist_v1',
}: GuideExecutionChecklistProps) {
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setCompletedIds(parsed.filter((id): id is string => typeof id === 'string'));
      }
    } catch {
      setCompletedIds([]);
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, JSON.stringify(completedIds));
  }, [completedIds, storageKey]);

  const completedCount = completedIds.length;
  const progress = items.length === 0 ? 0 : Math.round((completedCount / items.length) * 100);

  const completedSet = useMemo(() => new Set(completedIds), [completedIds]);

  const toggleItem = (id: string) => {
    setCompletedIds((current) =>
      current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]
    );
  };

  return (
    <section
      id="execution-checklist"
      className="section-anchor mb-6 rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-white/45">Execution checklist</p>
          <h2 className="mt-1 text-xl brand-title">Ship one complete audit cycle this week</h2>
        </div>
        <div className="rounded-lg border border-white/10 bg-charcoal-deep px-3 py-2 text-xs text-white/70">
          {completedCount}/{items.length} complete
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-charcoal-deep p-3">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-white/45">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-white/10">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-orange-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item, index) => {
          const checked = completedSet.has(item.id);
          return (
            <article
              key={item.id}
              className="rounded-xl border border-white/10 bg-charcoal-deep p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  className="inline-flex items-center gap-1 text-xs text-white/80 transition-colors hover:text-white"
                  aria-pressed={checked}
                >
                  {checked ? (
                    <CheckSquare className="h-4 w-4 text-cyan-300" />
                  ) : (
                    <Square className="h-4 w-4 text-white/55" />
                  )}
                  Step {index + 1}
                </button>
                <span
                  className={`rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wide ${PRIORITY_STYLES[item.priority]}`}
                >
                  {item.priority}
                </span>
              </div>

              <h3 className="mt-2 text-sm font-semibold text-white/90">{item.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-white/65">{item.detail}</p>

              <div className="mt-3 flex items-center gap-1 text-[11px] uppercase tracking-wide text-white/45">
                <Clock3 className="h-3 w-3" />
                {item.eta}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={`#${item.anchorId}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] font-medium text-white/80 transition-colors hover:border-white/30 hover:text-white"
                >
                  Open step
                  <ArrowRight className="h-3 w-3" />
                </a>
                {item.actionTo && item.actionLabel && (
                  <Link
                    to={item.actionTo}
                    className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] font-medium text-cyan-200 transition-colors hover:border-cyan-300/40 hover:text-cyan-100"
                  >
                    {item.actionLabel}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
