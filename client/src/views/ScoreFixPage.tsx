import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, Sparkles, Search, BadgeCheck, Link2, Workflow, ClipboardList, ArrowLeft } from "lucide-react";
import useFeatureStatus from "../hooks/useFeatureStatus";
import { useAuthStore } from "../stores/authStore";
import { API_URL } from "../config";
import { Card, CardContent } from "@/components/ui/Card";
import { ScoreFixIcon, ContentBlueprintIcon, AuditEngineIcon } from "../components/icons";
import { buildBreadcrumbSchema, buildFaqSchema, buildOrganizationRef, buildWebPageSchema } from "../lib/seoSchema";
import UpgradeWall from "../components/UpgradeWall";

const blockerRows = [
  {
    blocker: "Weak entity clarity",
    evidence: "AI systems cannot confidently resolve what the business is, who it serves, or what exact service the page represents.",
    fix: "Automated PR: rewrites hero, H1, intro copy, and service framing with exact category language and audience definition.",
    lift: "Higher extraction confidence and better citation eligibility",
  },
  {
    blocker: "Thin answer blocks",
    evidence: "Critical buyer questions are buried in long-form copy instead of concise retrieval-friendly sections.",
    fix: "Automated PR: adds direct answers, structured FAQs, comparison blocks, and concise extraction sections.",
    lift: "Better answer-engine summarization and snippet reuse",
  },
  {
    blocker: "Missing proof layer",
    evidence: "Claims exist without enough visible evidence such as examples, diff notes, validation, or remediation detail.",
    fix: "Automated PR: adds proof strips, issue-level notes, remediation details, and before/after examples.",
    lift: "Stronger trust signals and claim credibility",
  },
  {
    blocker: "Schema-content mismatch",
    evidence: "Structured data is absent, incomplete, or disconnected from visible page content.",
    fix: "Automated PR: deploys aligned JSON-LD for Organization, WebSite, WebPage, Service, BreadcrumbList, FAQPage.",
    lift: "More reliable machine-readable interpretation",
  },
  {
    blocker: "Weak topical reinforcement",
    evidence: "The page is not sufficiently supported by internal links to related entities, methods, pricing, or proof pages.",
    fix: "Automated PR: adds internal links to pricing, audits, reports, FAQ, methodology using exact topical anchors.",
    lift: "Stronger topic graph and contextual support",
  },
  {
    blocker: "No freshness signal",
    evidence: "There is no visible recency marker, update signal, or change log to reinforce active maintenance.",
    fix: "Automated PR: adds last-updated notes, validation timestamps, and optional revision history.",
    lift: "Improved trust and temporal relevance",
  },
];

const deliverables = [
  "Automated GitHub PR with entity rewrites for H1, hero copy, service framing, and audience clarity",
  "Automated GitHub PR with answer-block patches for buyer questions and AI extraction",
  "Automated GitHub PR with evidence-linked proof snippets and before/after structure",
  "Automated GitHub PR with aligned JSON-LD schema recommendations",
  "Automated GitHub PR with internal link mapping and anchor structure",
  "Automated GitHub PR with trust language for methodology and compliance",
  "Priority remediation order based on impact, clarity, and crawl value",
  "10-25 credits per automated PR depending on fix complexity",
];

const bestFor = [
  "Dev teams that want automated schema and content PRs instead of manual edits",
  "SaaS teams with weak AI summarization needing fast GitHub-based remediation",
  "Agencies that need white-label automated remediation via MCP",
  "Service businesses with strong offers but weak machine-readable clarity",
];

const proofCards = [
  {
    label: "Before",
    title: "Score too soft to trust",
    text: "Vague service framing, missing FAQ structure, weak evidence, incomplete schema, thin internal support.",
  },
  {
    label: "After",
    title: "Built for extraction",
    text: "Clear category language, retrieval-friendly answers, aligned schema, proof-backed remediation, stronger support graph.",
  },
  {
    label: "Example lift",
    title: "54 → 91",
    text: "Representative score movement after structural edits, evidence additions, schema alignment, and internal reinforcement.",
  },
  {
    label: "Validation",
    title: "Issue-level recheck",
    text: "Re-review the same blockers after implementation to confirm whether extraction quality and evidence posture improved.",
  },
];

const faq = [
  {
    q: "What is Score Fix AutoPR?",
    a: "Score Fix AutoPR is the automated remediation layer after an AI visibility audit. It connects to your GitHub repo via MCP and generates pull requests with real structural, content, schema, and internal-link changes designed to improve extraction clarity and citation readiness.",
  },
  {
    q: "How many credits does each fix cost?",
    a: "Each automated GitHub PR costs 10-25 credits depending on fix complexity. Simple schema patches cost fewer credits; multi-file content rewrites with FAQ blocks cost more. A 250-credit pack typically covers 10-25 full remediation PRs.",
  },
  {
    q: "Who is this for?",
    a: "It is built for dev teams, SaaS teams, agencies, and service operators who want automated GitHub-based remediation rather than manual content edits. Connect your repo via MCP and Score Fix handles the rest.",
  },
  {
    q: "What does an automated PR contain?",
    a: "Each PR includes concrete fixes tied to audit evidence: JSON-LD schema patches, H1 rewrites, FAQ blocks, answer sections, and internal link additions. Every change references the triggering evidence IDs.",
  },
  {
    q: "Can Score Fix guarantee citations?",
    a: "No legitimate service can guarantee citations. What Score Fix does is improve the underlying clarity, evidence, and machine-readable structure that make a page more trustworthy and easier for answer engines to interpret.",
  },
  {
    q: "What happens after the PRs are merged?",
    a: "After merging the automated PRs, re-check your pages against the original issues to measure whether clarity, structure, and evidence depth improved. Score Fix tracks issue-level progress across audits.",
  },
];

const scoreModel = [
  ["Entity clarity", "15/15"],
  ["Heading structure", "14/15"],
  ["Answer blocks", "15/15"],
  ["Evidence depth", "14/15"],
  ["Schema alignment", "12/15"],
  ["Internal links", "10/10"],
  ["Freshness", "5/5"],
  ["Trust signals", "10/10"],
];

const SITE_URL = "https://aivis.biz";
const PAGE_URL = `${SITE_URL}/score-fix`;
const PAGE_TITLE = "AI Visibility Score Fix AutoPR | AiVIS - Ai Visibility Intelligence Audits";
const PAGE_DESCRIPTION =
  "AI Visibility Score Fix AutoPR from AiVIS connects to your GitHub repo via MCP and generates automated pull requests with schema patches, H1 rewrites, FAQ blocks, and structural fixes — 10-25 credits per automated remediation PR.";
const OG_IMAGE = `${SITE_URL}/og/aivis-score-fix.jpg`;

const scoreFixFaqEntities = faq.map((item) => ({
  question: item.q,
  answer: item.a,
}));

const scoreFixJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      ...buildWebPageSchema({
        path: "/score-fix",
        name: PAGE_TITLE,
        description: PAGE_DESCRIPTION,
        mainEntityId: `${PAGE_URL}#service`,
      }),
      breadcrumb: {
        "@id": `${PAGE_URL}#breadcrumb`,
      },
      inLanguage: "en-US",
      dateModified: "2026-03-11",
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": `${PAGE_URL}#service`,
      name: "AI Visibility Score Fix AutoPR",
      serviceType: "Automated GitHub PR remediation via MCP",
      description:
        "An automated remediation service that connects to GitHub repos via MCP and generates pull requests with schema patches, H1 rewrites, FAQ blocks, and structural fixes at 10-25 credits per PR.",
      provider: buildOrganizationRef(),
      areaServed: "Worldwide",
      audience: {
        "@type": "Audience",
        audienceType: "Dev teams, SaaS teams, agencies, and service operators",
      },
      url: PAGE_URL,
    },
    {
      ...buildFaqSchema(scoreFixFaqEntities),
      "@id": `${PAGE_URL}#faq`,
    },
    {
      ...buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Score Fix", path: "/score-fix" },
      ]),
      "@id": `${PAGE_URL}#breadcrumb`,
    },
  ],
};

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element?.setAttribute(key, value);
  });
}

function upsertLink(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement("link");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element?.setAttribute(key, value);
  });
}

const sectionFade = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.18 },
  transition: { duration: 0.45 },
};

type LiveRecommendation = {
  title?: string;
  description?: string;
  priority?: string;
  category?: string;
  implementation?: string;
  evidence_ids?: string[];
};

type LiveEvidenceItem = {
  id?: string;
  label?: string;
  status?: string;
  value?: string;
  source?: string;
};

export default function ScoreFixPage() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { status: featureStatus } = useFeatureStatus();
  const packCreditsBalance = Math.max(0, Number(featureStatus?.credits?.packCreditsRemaining ?? 0));
  const hasAccess = isAuthenticated && packCreditsBalance > 0;
  const [liveRecommendations, setLiveRecommendations] = useState<LiveRecommendation[]>([]);
  const [liveEvidenceById, setLiveEvidenceById] = useState<Record<string, LiveEvidenceItem>>({});
  const [liveEvidenceState, setLiveEvidenceState] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");

  useEffect(() => {
    document.title = PAGE_TITLE;

    upsertMeta('meta[name="description"]', {
      name: "description",
      content: PAGE_DESCRIPTION,
    });

    upsertMeta('meta[name="robots"]', {
      name: "robots",
      content: "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1",
    });

    upsertLink('link[rel="canonical"]', {
      rel: "canonical",
      href: PAGE_URL,
    });

    upsertMeta('meta[property="og:type"]', {
      property: "og:type",
      content: "website",
    });

    upsertMeta('meta[property="og:site_name"]', {
      property: "og:site_name",
      content: "Aivis",
    });

    upsertMeta('meta[property="og:title"]', {
      property: "og:title",
      content: PAGE_TITLE,
    });

    upsertMeta('meta[property="og:description"]', {
      property: "og:description",
      content: PAGE_DESCRIPTION,
    });

    upsertMeta('meta[property="og:url"]', {
      property: "og:url",
      content: PAGE_URL,
    });

    upsertMeta('meta[property="og:image"]', {
      property: "og:image",
      content: OG_IMAGE,
    });

    upsertMeta('meta[property="og:image:alt"]', {
      property: "og:image:alt",
      content: "Aivis AI Visibility Score Fix page preview",
    });

    upsertMeta('meta[name="twitter:card"]', {
      name: "twitter:card",
      content: "summary_large_image",
    });

    upsertMeta('meta[name="twitter:title"]', {
      name: "twitter:title",
      content: PAGE_TITLE,
    });

    upsertMeta('meta[name="twitter:description"]', {
      name: "twitter:description",
      content: PAGE_DESCRIPTION,
    });

    upsertMeta('meta[name="twitter:image"]', {
      name: "twitter:image",
      content: OG_IMAGE,
    });
  }, []);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const fetchLiveEvidence = async () => {
      if (!isAuthenticated || !token) {
        setLiveEvidenceState("unavailable");
        setLiveRecommendations([]);
        setLiveEvidenceById({});
        return;
      }

      setLiveEvidenceState("loading");

      try {
        const base = (API_URL || "").replace(/\/+$/, "");
        const auditsRes = await fetch(`${base}/api/audits?limit=1`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
        });

        if (!auditsRes.ok) {
          setLiveEvidenceState("unavailable");
          return;
        }

        const auditsPayload = (await auditsRes.json().catch(() => ({}))) as { audits?: Array<{ id?: string }> };
        const latestAuditId = String(auditsPayload?.audits?.[0]?.id || "").trim();
        if (!latestAuditId) {
          setLiveEvidenceState("unavailable");
          return;
        }

        const detailRes = await fetch(`${base}/api/audits/${encodeURIComponent(latestAuditId)}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
        });

        if (!detailRes.ok) {
          setLiveEvidenceState("unavailable");
          return;
        }

        const detail = (await detailRes.json().catch(() => ({}))) as {
          result?: {
            recommendations?: LiveRecommendation[];
            evidence_ledger?: Record<string, LiveEvidenceItem>;
          };
        };

        if (cancelled) return;

        const recommendations = Array.isArray(detail?.result?.recommendations)
          ? detail.result!.recommendations!
          : [];
        const evidenceLedger = detail?.result?.evidence_ledger && typeof detail.result.evidence_ledger === "object"
          ? detail.result.evidence_ledger
          : {};

        setLiveRecommendations(recommendations);
        setLiveEvidenceById(evidenceLedger as Record<string, LiveEvidenceItem>);
        setLiveEvidenceState(recommendations.length > 0 ? "ready" : "unavailable");
      } catch {
        if (!cancelled) setLiveEvidenceState("unavailable");
      }
    };

    void fetchLiveEvidence();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, token]);

  const liveEvidenceRows = useMemo(() => {
    return liveRecommendations.map((rec, idx) => {
      const evidenceIds = Array.isArray(rec.evidence_ids) ? rec.evidence_ids.slice(0, 3) : [];
      const evidence = evidenceIds
        .map((id) => ({ id, item: liveEvidenceById[id] }))
        .filter((row) => Boolean(row.item));

      return {
        key: `${rec.title || rec.category || "rec"}-${idx}`,
        recommendation: rec,
        evidence,
      };
    });
  }, [liveRecommendations, liveEvidenceById]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(scoreFixJsonLd).replace(/</g, "\\u003c") }}
      />
      {/* ── Standard page header ─────────────────────────────── */}
      <header className="border-b border-white/10 bg-charcoal-deep sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="rounded-full p-2 transition-colors hover:bg-white/8" type="button" aria-label="Go back">
            <ArrowLeft className="h-5 w-5 text-white/55" />
          </button>
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-xl brand-title">
              <Sparkles className="h-5 w-5 text-amber-400" />
              Score Fix
            </h2>
            <p className="text-sm text-white/60 leading-relaxed">Automated GitHub PR remediation via MCP — 10-25 credits per fix</p>
          </div>
        </div>
      </header>
      {!hasAccess ? (
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
          <UpgradeWall
            feature="Score Fix"
            description="Purchase a Score Fix credit pack to unlock automated GitHub PR remediations via MCP (10-25 credits per fix)."
            requiredTier="scorefix"
            icon={<Sparkles className="w-12 h-12 text-amber-400" />}
            featurePreview={[
              "Auto-generate GitHub PRs containing schema patches and content fixes",
              "Each PR references the exact audit finding that triggered it",
              "Review and merge — no manual editing required",
            ]}
          />
        </div>
      ) : (
      <div className="min-h-screen text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <motion.section
          {...sectionFade}
          className="relative overflow-hidden rounded-[24px] border border-white/10 bg-white/5 p-4 shadow-2xl sm:p-6 lg:p-7"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(251,191,36,0.14),transparent_20%),radial-gradient(circle_at_15%_85%,rgba(168,85,247,0.12),transparent_22%)]" />
          <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs font-medium tracking-[0.18em] text-amber-200">
                <Sparkles className="h-3.5 w-3.5" />
                SCORE FIX
              </div>
              <h1 className="mt-3 max-w-4xl text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl lg:leading-[1.08]">
                Score Fix AutoPR — Automated GitHub Remediation for AI Visibility
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-[15px]">
                Score Fix connects to your GitHub repo via MCP and generates pull requests with real fixes — schema patches, H1 rewrites, FAQ blocks, and structural improvements. Each automated PR costs 10-25 credits depending on complexity. No manual content editing required.
              </p>

              {packCreditsBalance > 0 && (
                <div className="flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-200 w-fit mb-4">
                  <Sparkles className="h-3 w-3" />
                  {packCreditsBalance} credit{packCreditsBalance !== 1 ? "s" : ""} remaining in your Score Fix pack
                </div>
              )}
              {packCreditsBalance === 0 && (
                <div className="flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200/70 w-fit mb-4">
                  <Sparkles className="h-3 w-3" />
                  Score Fix credits: 0 (purchase a 250-credit pack to get started)
                </div>
              )}
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Link to="/pricing?intent=score-fix&plan=score-fix&source=score-fix-page" className="inline-flex items-center rounded-xl bg-white px-4 py-3 text-sm font-medium text-black hover:bg-slate-100">
                  Start Score Fix
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link to="/guide?section=audit-criteria&source=score-fix-page" className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10">
                  View audit criteria
                </Link>
              </div>

              <div className="mt-6 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { icon: AuditEngineIcon, label: "Goal", value: "Automated PR generation" },
                  { icon: Search, label: "Focus", value: "GitHub MCP remediation" },
                  { icon: Workflow, label: "Method", value: "Evidence to automated PR" },
                  { icon: ScoreFixIcon, label: "Cost", value: "10-25 credits per fix" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Card key={item.label} className="rounded-[18px] border-white/10 bg-slate-950/50 text-white shadow-xl">
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-2.5">
                            <Icon className="h-4 w-4 text-amber-300" />
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{item.label}</div>
                            <div className="mt-1 text-sm font-medium leading-6 text-slate-100">{item.value}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <Card className="rounded-[22px] border-white/10 bg-slate-950/65 text-white shadow-2xl">
              <CardContent className="p-4 sm:p-5">
                <div className="mb-5 overflow-hidden rounded-2xl border border-white/10">
                  <img
                    src="/score-fix.png"
                    alt="Score Fix remediation workflow preview"
                    className="h-32 w-full object-cover object-center"
                    loading="lazy"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <ContentBlueprintIcon className="h-5 w-5 text-amber-300" />
                  <BadgeCheck className="h-5 w-5 text-emerald-300" />
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Target score model</div>
                    <div className="mt-1 text-lg font-semibold">Built for high-confidence page structure</div>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {scoreModel.map(([label, score]) => (
                    <div key={label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <span className="text-sm text-slate-300">{label}</span>
                      <span className="text-sm font-semibold text-white">{score}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-50">
                  Direct answer: a 90+ page is easy to identify, easy to summarize, easy to verify, and easy to connect to supporting evidence.
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.section>

        <motion.section {...sectionFade} className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-[22px] border-white/10 bg-white/5 text-white shadow-2xl">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <AuditEngineIcon className="h-5 w-5 text-violet-300" />
                <ContentBlueprintIcon className="h-5 w-5 text-amber-300" />
                <h2 className="text-2xl brand-title">What Score Fix AutoPR does</h2>
              </div>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                Score Fix AutoPR connects to your GitHub repo via MCP. It translates audit findings into automated pull requests containing schema patches, content rewrites, and structural fixes. Each PR references evidence IDs so you can verify exactly which audit signal drove each change. No manual editing — just review and merge.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  "Generates PRs with schema patches",
                  "Rewrites H1 and hero copy automatically",
                  "Adds FAQ blocks and answer sections",
                  "Links evidence IDs to every change",
                  "Adds internal links via topical anchors",
                  "10-25 credits per fix (complexity-based)",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    <span className="text-sm leading-6 text-slate-200">{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[22px] border-white/10 bg-white/5 text-white shadow-2xl">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <ScoreFixIcon className="h-5 w-5 text-amber-300" />
                <AuditEngineIcon className="h-5 w-5 text-violet-300" />
                <h2 className="text-2xl brand-title">Best fit</h2>
              </div>
              <div className="mt-6 space-y-3">
                {bestFor.map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm leading-6 text-slate-200">
                    {item}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.section>

        <motion.section {...sectionFade} className="mt-6">
          <Card className="rounded-[22px] border-white/10 bg-white/5 text-white shadow-2xl">
            <CardContent className="p-4 sm:p-5 lg:p-6">
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-2.5">
                  <ClipboardList className="h-5 w-5 text-amber-300" />
                </div>
                <h2 className="text-2xl brand-title">Blocker → Evidence → Fix → Expected lift</h2>
              </div>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                This is the spine of the page. Each issue is named, each weakness is explained, and each remediation path is tied to a practical reason it matters.
              </p>

              <div className="mt-6 hidden overflow-hidden rounded-[24px] border border-white/10 lg:block">
                <div className="grid grid-cols-[1fr_1.1fr_1.1fr_0.9fr] bg-white/5 text-sm font-medium text-slate-200">
                  <div className="border-r border-white/10 p-3">Blocker</div>
                  <div className="border-r border-white/10 p-3">Evidence</div>
                  <div className="border-r border-white/10 p-3">Fix</div>
                  <div className="p-3">Expected lift</div>
                </div>
                {blockerRows.map((row, idx) => (
                  <div key={row.blocker} className={`grid grid-cols-[1fr_1.1fr_1.1fr_0.9fr] ${idx !== blockerRows.length - 1 ? "border-t border-white/10" : ""}`}>
                    <div className="border-r border-white/10 bg-slate-950/55 p-3 text-sm font-medium text-white">{row.blocker}</div>
                    <div className="border-r border-white/10 bg-slate-950/35 p-3 text-sm leading-6 text-slate-300">{row.evidence}</div>
                    <div className="border-r border-white/10 bg-slate-950/35 p-3 text-sm leading-6 text-slate-300">{row.fix}</div>
                    <div className="bg-slate-950/35 p-3 text-sm leading-6 text-slate-200">{row.lift}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-4 lg:hidden">
                {blockerRows.map((row) => (
                  <div key={row.blocker} className="rounded-[20px] border border-white/10 bg-slate-950/55 p-4">
                    <h3 className="text-lg font-semibold">{row.blocker}</h3>
                    <div className="mt-4 space-y-3 text-sm leading-6">
                      <p><span className="font-medium text-white">Evidence:</span> <span className="text-slate-300">{row.evidence}</span></p>
                      <p><span className="font-medium text-white">Fix:</span> <span className="text-slate-300">{row.fix}</span></p>
                      <p><span className="font-medium text-white">Expected lift:</span> <span className="text-slate-300">{row.lift}</span></p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.section>

        <motion.section {...sectionFade} className="mt-6">
          <Card className="rounded-[22px] border-white/10 bg-white/5 text-white shadow-2xl">
            <CardContent className="p-4 sm:p-5 lg:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl brand-title">Live recommendation evidence linkage</h2>
                <span className="text-xs px-2.5 py-1 rounded-full border border-white/10 bg-charcoal-light text-white/70">
                  {liveEvidenceState === "loading"
                    ? "Loading"
                    : liveEvidenceState === "ready"
                      ? "Live"
                      : "Unavailable"}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Score Fix recommendations are tied to evidence IDs from your latest stored audit whenever available.
                This keeps remediation grounded in measured findings, not generic copy edits.
              </p>

              {liveEvidenceState === "loading" && (
                <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-300">
                  Pulling your latest audit evidence…
                </div>
              )}

              {liveEvidenceState !== "loading" && liveEvidenceRows.length === 0 && (
                <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-300">
                  No live audit evidence is available on this account yet. Run an audit, then return to map recommendations to evidence.
                </div>
              )}

              {liveEvidenceRows.length > 0 && (
                <div className="mt-4 grid gap-3">
                  {liveEvidenceRows.map((row) => (
                    <div key={row.key} className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-white">{row.recommendation.title || "Recommendation"}</h3>
                        <span className="text-[11px] text-slate-400 uppercase tracking-[0.14em]">{row.recommendation.priority || "priority"}</span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-300">{row.recommendation.description || row.recommendation.implementation || "No description provided."}</p>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {(Array.isArray(row.recommendation.evidence_ids) ? row.recommendation.evidence_ids.slice(0, 3) : []).map((id) => {
                          const ev = liveEvidenceById[id];
                          return (
                            <div key={id} className="rounded-lg border border-white/10 bg-charcoal-light/40 px-2.5 py-2">
                              <div className="text-[11px] font-medium text-cyan-200">{id}</div>
                              <div className="text-[11px] text-slate-300 mt-0.5">{ev?.label || ev?.source || "Evidence item"}</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">{String(ev?.value || ev?.status || "Linked")}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.section>

        <motion.section {...sectionFade} className="mt-6 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="rounded-[22px] border-white/10 bg-white/5 text-white shadow-2xl">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-2.5">
                  <Link2 className="h-5 w-5 text-cyan-300" />
                </div>
                <h2 className="text-2xl brand-title">What each automated PR contains</h2>
              </div>
              <div className="mt-6 space-y-3">
                {deliverables.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    <span className="text-sm leading-6 text-slate-200">{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[22px] border-white/10 bg-white/5 text-white shadow-2xl">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-2.5">
                  <AuditEngineIcon className="h-5 w-5 text-amber-300" />
                </div>
                <h2 className="text-2xl brand-title">Proof structure</h2>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {proofCards.map((card) => (
                  <div key={card.label} className="rounded-[20px] border border-white/10 bg-slate-950/55 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{card.label}</div>
                    <div className="mt-2 text-lg font-semibold text-white">{card.title}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{card.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.section>

        <motion.section {...sectionFade} className="mt-6 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <Card className="rounded-[22px] border-white/10 bg-white/5 text-white shadow-2xl">
            <CardContent className="p-4 sm:p-5">
              <h2 className="text-2xl brand-title">Implementation checklist</h2>
              <div className="mt-6 grid gap-3">
                {[
                  "Exact H1 aligned to service intent",
                  "Hero copy with audience and outcome clarity",
                  "Direct answer section near top of page",
                  "Proof-backed claim sections",
                  "Concise FAQ answers",
                  "Schema aligned to visible copy",
                  "Internal links to pricing, reports, methodology, and proof pages",
                  "Freshness marker or last updated signal",
                  "Clear remediation CTA",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm leading-6 text-slate-200">
                    {item}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[22px] border-white/10 bg-white/5 text-white shadow-2xl">
            <CardContent className="p-4 sm:p-5">
              <h2 className="text-2xl brand-title">FAQ for retrieval and buyer clarity</h2>
              <div className="mt-6 space-y-4">
                {faq.map((item) => (
                  <div key={item.q} className="rounded-[20px] border border-white/10 bg-slate-950/55 p-4">
                    <h3 className="text-lg font-medium text-white">{item.q}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-300">{item.a}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.section>

        <motion.section {...sectionFade} className="mt-6">
          <Card className="rounded-[22px] border-amber-400/20 bg-amber-400/10 text-white shadow-2xl">
            <CardContent className="p-4 sm:p-5 lg:p-6">
              <h2 className="text-2xl font-semibold tracking-tight text-amber-100">Structured data and trust notes</h2>
              <p className="mt-4 max-w-5xl text-sm leading-7 text-amber-50/90 sm:text-base">
                Deploy Organization, WebSite, WebPage, Service, BreadcrumbList, and FAQPage schema where appropriate. Keep all values aligned to what the page visibly says. Do not claim entities, offers, or facts in JSON-LD that the page itself does not support. For trust posture, reinforce methodology, evidence source clarity, and visible last-updated signals.
              </p>
            </CardContent>
          </Card>
        </motion.section>

        <motion.section {...sectionFade} className="mt-6">
          <Card className="overflow-hidden rounded-[22px] border-white/10 bg-white/5 text-white shadow-2xl">
            <CardContent className="relative p-4 sm:p-5 lg:p-6">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(251,191,36,0.16),transparent_22%),radial-gradient(circle_at_10%_90%,rgba(59,130,246,0.14),transparent_20%)]" />
              <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-3xl">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Ready to fix the weak points</div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                    Turn the audit into real page changes
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-slate-200 sm:text-base">
                  Score Fix is for pages that need stronger machine-readable clarity, trust posture, and evidence density. Connect your GitHub repo via MCP and let Score Fix generate the PRs automatically.
                </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    to="/pricing?intent=score-fix&plan=score-fix&source=score-fix-cta-bottom"
                    className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-medium bg-charcoal text-white border-2 border-black/85 hover:bg-charcoal-light transition-all duration-200"
                  >
                    Get Score Fix AutoPR
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                  <Link
                    to="/pricing?source=score-fix-compare"
                    className="inline-flex items-center justify-center rounded-2xl border-2 border-black/85 bg-transparent hover:bg-charcoal-light text-white/80 px-5 py-3 text-sm transition-all duration-200"
                  >
                    Compare audit tiers
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        <footer className="px-1 pb-6 pt-8 text-sm text-slate-500">
          Last updated: March 2026 · Evidence-validated remediation for enterprise white-label delivery.
        </footer>
      </div>
    </div>
      )}
    </>
  );
}

export const scoreFixSeo = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  canonical: PAGE_URL,
  robots: "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1",
  openGraph: {
    type: "website",
    url: PAGE_URL,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    siteName: "AiVIS",
    images: [
      {
        url: OG_IMAGE,
        alt: "AiVIS AI Visibility Score Fix page preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    image: OG_IMAGE,
  },
};

export { scoreFixJsonLd };
