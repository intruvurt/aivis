import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Search } from "lucide-react";

type CheckLevel = "pass" | "warn" | "fail";

type ReadinessState = {
  loading: boolean;
  robotsReachable: boolean;
  sitemapReachable: boolean;
  robotsHasSitemapPointer: boolean;
  sitemapHasCorePublicPages: boolean;
  sitemapMissing: string[];
  checkedAt: string | null;
  error: string | null;
};

const CORE_PUBLIC_PATHS = ["/", "/pricing", "/about", "/compliance", "/faq"];

function levelStyle(level: CheckLevel): string {
  if (level === "pass") return "border-emerald-300/25 bg-emerald-500/10 text-emerald-100";
  if (level === "warn") return "border-amber-300/25 bg-amber-500/10 text-amber-100";
  return "border-red-300/25 bg-red-500/10 text-red-100";
}

function levelIcon(level: CheckLevel): React.ReactNode {
  if (level === "pass") return <CheckCircle2 className="h-4 w-4" />;
  return <AlertCircle className="h-4 w-4" />;
}

export default function IndexingReadinessCard() {
  const [state, setState] = useState<ReadinessState>({
    loading: true,
    robotsReachable: false,
    sitemapReachable: false,
    robotsHasSitemapPointer: false,
    sitemapHasCorePublicPages: false,
    sitemapMissing: [],
    checkedAt: null,
    error: null,
  });

  useEffect(() => {
    let active = true;

    const run = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const origin = window.location.origin;
        const robotsUrl = `${origin}/robots.txt`;
        const sitemapUrl = `${origin}/sitemap.xml`;

        const [robotsRes, sitemapRes] = await Promise.allSettled([
          fetch(robotsUrl, { cache: "no-store" }),
          fetch(sitemapUrl, { cache: "no-store" }),
        ]);

        const robotsReachable = robotsRes.status === "fulfilled" && robotsRes.value.ok;
        const sitemapReachable = sitemapRes.status === "fulfilled" && sitemapRes.value.ok;

        const robotsText = robotsReachable ? await robotsRes.value.text() : "";
        const sitemapText = sitemapReachable ? await sitemapRes.value.text() : "";

        const robotsHasSitemapPointer = /sitemap:\s*https?:\/\/[^\s]+\/sitemap\.xml/i.test(robotsText);
        const missingPaths = CORE_PUBLIC_PATHS.filter((path) => {
          const loc = `${origin}${path === "/" ? "/" : path}`;
          return !sitemapText.includes(`<loc>${loc}</loc>`);
        });

        const sitemapHasCorePublicPages = sitemapReachable && missingPaths.length === 0;

        if (!active) return;

        setState({
          loading: false,
          robotsReachable,
          sitemapReachable,
          robotsHasSitemapPointer,
          sitemapHasCorePublicPages,
          sitemapMissing: missingPaths,
          checkedAt: new Date().toISOString(),
          error: null,
        });
      } catch (error: any) {
        if (!active) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error?.message || "Failed to run indexing checks",
          checkedAt: new Date().toISOString(),
        }));
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo(() => {
    const items: Array<{ label: string; detail: string; level: CheckLevel }> = [
      {
        label: "robots.txt reachable",
        detail: state.robotsReachable ? "Found and fetchable" : "Missing or not fetchable",
        level: state.robotsReachable ? "pass" : "fail",
      },
      {
        label: "sitemap.xml reachable",
        detail: state.sitemapReachable ? "Found and fetchable" : "Missing or not fetchable",
        level: state.sitemapReachable ? "pass" : "fail",
      },
      {
        label: "robots references sitemap",
        detail: state.robotsHasSitemapPointer ? "Sitemap pointer present" : "No sitemap pointer line found",
        level: state.robotsHasSitemapPointer ? "pass" : "warn",
      },
      {
        label: "core public pages in sitemap",
        detail:
          state.sitemapMissing.length === 0
            ? "Core pages present"
            : `Missing: ${state.sitemapMissing.join(", ")}`,
        level: state.sitemapHasCorePublicPages ? "pass" : "warn",
      },
    ];

    return items;
  }, [state]);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-white/10 bg-charcoal-light p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-white/75" />
            <h3 className="text-sm font-semibold text-white">Indexing Readiness</h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/60">
            <a
              href="/robots.txt"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-white"
            >
              robots.txt <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a
              href="/sitemap.xml"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-white"
            >
              sitemap.xml <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {state.loading ? (
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking robots and sitemap...
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <div
                key={row.label}
                className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2 text-xs ${levelStyle(row.level)}`}
              >
                <div>
                  <p className="font-medium">{row.label}</p>
                  <p className="opacity-85">{row.detail}</p>
                </div>
                <span className="mt-0.5">{levelIcon(row.level)}</span>
              </div>
            ))}
            {state.error ? <p className="text-xs text-red-200">{state.error}</p> : null}
            {state.checkedAt ? (
              <p className="pt-1 text-[11px] text-white/45">
                Last checked: {new Date(state.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
