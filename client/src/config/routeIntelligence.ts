import type { CanonicalTier } from "@shared/types";

export type NavTier = "observer" | "starter" | "alignment" | "signal" | "scorefix";

export interface NavItem {
    to: string;
    labelKey: string;
    iconName:
    | "LayoutDashboard"
    | "Search"
    | "BarChart3"
    | "FileText"
    | "Target"
    | "Users"
    | "FlaskConical"
    | "Brain"
    | "Wrench"
    | "Globe"
    | "Shield"
    | "Settings"
    | "CreditCard"
    | "Zap"
    | "Cpu"
    | "ArrowLeftRight"
    | "Eye"
    | "Layers"
    | "HelpCircle"
    | "Network"
    | "Code2"
    | "TrendingUp"
    | "Award"
    | "FileSearch"
    | "BookOpen"
    | "Languages"
    | "Database";
    minTier?: NavTier;
}

export interface NavGroup {
    key: string;
    titleKey: string;
    iconClass: string;
    iconBg: string;
    items: NavItem[];
}

export const APP_NAV_GROUPS: NavGroup[] = [
    // ── 1. SCAN: submit URL, review history, queue fixes ─────────────────
    {
        key: "scan",
        titleKey: "sidebar.scan",
        iconClass: "text-[#22ff6e]",
        iconBg: "bg-[#22ff6e]/10",
        items: [
            { to: "/app/scan", labelKey: "sidebar.seeVisibility", iconName: "Search" },
            { to: "/app/reports", labelKey: "sidebar.reports", iconName: "FileText" },
            { to: "/app/score-fix", labelKey: "sidebar.scorefix", iconName: "Zap" },
        ],
    },
    // ── 2. EVIDENCE: ledger data produced by scans ────────────────────────
    {
        key: "evidence",
        titleKey: "sidebar.evidence",
        iconClass: "text-[#ffb830]",
        iconBg: "bg-[#ffb830]/10",
        items: [
            { to: "/app/analytics", labelKey: "sidebar.analytics", iconName: "BarChart3" },
            { to: "/app/evidence", labelKey: "sidebar.evidenceRegistry", iconName: "Database", minTier: "alignment" },
            { to: "/app/citations", labelKey: "sidebar.citations", iconName: "FlaskConical", minTier: "alignment" },
            { to: "/app/competitors", labelKey: "sidebar.competitors", iconName: "Users", minTier: "alignment" },
        ],
    },
    // ── 3. REGISTRY: derived signals that consume ledger data ─────────────
    {
        key: "registry",
        titleKey: "sidebar.registry",
        iconClass: "text-[#22ff6e]",
        iconBg: "bg-[#22ff6e]/10",
        items: [
            { to: "/app/prompt-intelligence", labelKey: "sidebar.queryGaps", iconName: "Brain", minTier: "alignment" },
            { to: "/app/answer-presence", labelKey: "sidebar.answerPresence", iconName: "Eye", minTier: "alignment" },
            { to: "/app/brand-integrity", labelKey: "sidebar.brandIntegrity", iconName: "Shield", minTier: "alignment" },
            { to: "/app/reverse-engineer", labelKey: "sidebar.reverseEngineer", iconName: "ArrowLeftRight", minTier: "alignment" },
        ],
    },
    // ── 4. SETTINGS: identity, billing, operator access ───────────────────
    {
        key: "account",
        titleKey: "sidebar.account",
        iconClass: "text-[color:var(--text-dim)]",
        iconBg: "bg-[rgba(17,24,20,0.92)]",
        items: [
            { to: "/app/billing", labelKey: "sidebar.billing", iconName: "CreditCard" },
            { to: "/app/settings", labelKey: "sidebar.settings", iconName: "Settings" },
        ],
    },
];

export interface RouteGuide {
    title: string;
    section: string;
    summary: string;
    nextStep: string;
    instructions?: string[];
    primaryActionPath?: string;
    primaryActionLabel?: string;
    minTier?: CanonicalTier;
}

const TIER_GATE_LABELS: Record<CanonicalTier, string> = {
    observer: "Free",
    starter: "Starter+",
    alignment: "Alignment+",
    signal: "Signal+",
    scorefix: "Score Fix",
};

export function formatTierGateLabel(tier: CanonicalTier): string {
    return TIER_GATE_LABELS[tier] ?? tier;
}

interface RouteGuideRule {
    match: "exact" | "prefix";
    path: string;
    guide: RouteGuide;
}

interface PublicRouteGuideRule {
    match: "exact" | "prefix";
    path: string;
    guide: RouteGuide;
}

const ROUTE_GUIDES: RouteGuideRule[] = [
    {
        match: "exact",
        path: "/app",
        guide: {
            title: "Command Center",
            section: "Core",
            summary: "Your operating dashboard for audit status, trend health, and next priority fixes.",
            nextStep: "Run a fresh audit or open the lowest-score report to route into remediation.",
            instructions: [
                "Review weakest account score first.",
                "Jump into its report evidence.",
                "Route blockers into Score Fix.",
            ],
            primaryActionPath: "/app/scan",
            primaryActionLabel: "Run Audit",
        },
    },
    {
        match: "exact",
        path: "/app/scan",
        guide: {
            title: "Scan Entry",
            section: "Scan",
            summary: "Submit a URL. The pipeline extracts entity signals, runs typed queries against live AI and web responses, and writes every result to the citation ledger.",
            nextStep: "After the scan completes, review the evidence record and route gaps into Score Fix.",
            instructions: [
                "Enter a canonical URL and submit.",
                "Watch the evidence pipeline run.",
                "Route detected gaps into the fix queue.",
            ],
            primaryActionPath: "/app/reports",
            primaryActionLabel: "Scan History",
        },
    },
    {
        match: "exact",
        path: "/app/overview",
        guide: {
            title: "Legacy Overview",
            section: "Scan",
            summary: "Historical overview of your audit runs. The primary flow is now Scan → Evidence → Registry.",
            nextStep: "Run a new scan to produce fresh citation ledger entries.",
            instructions: [
                "Review past audit scores here.",
                "Use Scan History for evidence-linked reports.",
                "Run a new scan to generate fresh ledger data.",
            ],
            primaryActionPath: "/app/scan",
            primaryActionLabel: "Run Scan",
        },
    },
    {
        match: "exact",
        path: "/app/snapshot",
        guide: {
            title: "Snapshot Capture",
            section: "Core",
            summary: "Capture a point-in-time evidence state so score movement and drift can be measured objectively.",
            nextStep: "Store a baseline before major content or schema changes, then compare after deployment.",
            instructions: [
                "Capture baseline before changes.",
                "Ship implementation updates.",
                "Compare before vs after deltas.",
            ],
            primaryActionPath: "/app/reports",
            primaryActionLabel: "Open Reports",
        },
    },
    {
        match: "exact",
        path: "/app/reports",
        guide: {
            title: "Evidence Reports",
            section: "Core",
            summary: "Review all audits with evidence criteria passed, opportunities, and blocking issues.",
            nextStep: "Sort by weakest score and convert each blocker into an implementation task.",
            instructions: [
                "Filter by lowest score first.",
                "Review evidence excerpts and gaps.",
                "Open Score Fix for execution.",
            ],
            primaryActionPath: "/app/score-fix",
            primaryActionLabel: "Open Score Fix",
        },
    },
    {
        match: "exact",
        path: "/app/analytics",
        guide: {
            title: "Visibility Intelligence",
            section: "Evidence",
            summary: "Track visibility state, AI interpretation drift, and remediation impact across audit cycles.",
            nextStep: "Review blocker patterns, verify active fixes, and prioritize the next lift cycle.",
            instructions: [
                "Compare baseline vs latest visibility state.",
                "Identify structural blockers behind score movement.",
                "Validate remediation impact with evidence-linked deltas.",
            ],
            primaryActionPath: "/app/reports",
            primaryActionLabel: "Compare Reports",
        },
    },
    {
        match: "exact",
        path: "/app/evidence",
        guide: {
            title: "Evidence Registry",
            section: "Evidence",
            summary: "Review verified patterns extracted from audits, including mandatory SEO blockers and citation opportunities.",
            nextStep: "Filter by category, prioritize verified patterns, and route top blockers into Score Fix.",
            instructions: [
                "Review verified patterns first.",
                "Prioritize mandatory SEO failures.",
                "Convert patterns into implementation tasks.",
            ],
            primaryActionPath: "/app/score-fix",
            primaryActionLabel: "Open Score Fix",
            minTier: "alignment",
        },
    },
    {
        match: "exact",
        path: "/app/prompt-intelligence",
        guide: {
            title: "Prompt Intelligence",
            section: "Extensions",
            summary: "Map prompt clusters to missing answer blocks and retrieval gaps.",
            nextStep: "Prioritize uncovered prompts and build pages that answer those intents directly.",
            instructions: [
                "Group prompts by intent kernel.",
                "Map missing answer blocks.",
                "Ship entity-anchored updates.",
            ],
            primaryActionPath: "/app/keywords",
            primaryActionLabel: "Open Keywords",
            minTier: "alignment",
        },
    },
    {
        match: "exact",
        path: "/app/answer-presence",
        guide: {
            title: "Answer Presence",
            section: "Extensions",
            summary: "Measure when your brand appears in AI answers and who displaces you.",
            nextStep: "Track presence by query group, then close weak categories with evidence-rich updates.",
            instructions: [
                "Track visibility by query cluster.",
                "Identify displacement competitors.",
                "Prioritize category recovery work.",
            ],
            primaryActionPath: "/app/competitors",
            primaryActionLabel: "Compare Competitors",
            minTier: "alignment",
        },
    },
    {
        match: "exact",
        path: "/app/score-fix",
        guide: {
            title: "Score Fix",
            section: "Core",
            summary: "Execute remediation using evidence-linked fix paths and implementation actions.",
            nextStep: "Apply highest-impact fixes first, then rerun audit to verify score movement.",
            instructions: [
                "Work CRITICAL and HIGH blockers first.",
                "Implement exact fix checklist.",
                "Re-audit and confirm score lift.",
            ],
            primaryActionPath: "/app/scan",
            primaryActionLabel: "Re-analyze",
        },
    },
    {
        match: "exact",
        path: "/app/site-crawl",
        guide: {
            title: "Site Crawl",
            section: "Core",
            summary: "Scan page-level technical and extractability issues across your site to find systemic blockers.",
            nextStep: "Prioritize recurring blockers across templates, then fix globally before rerunning crawl + audit.",
            instructions: [
                "Group issues by template type.",
                "Fix highest-frequency blockers first.",
                "Verify reduction in crawl errors.",
            ],
            primaryActionPath: "/app/score-fix",
            primaryActionLabel: "Route to Score Fix",
        },
    },
    {
        match: "exact",
        path: "/app/keywords",
        guide: {
            title: "Keyword & Intent Coverage",
            section: "Extensions",
            summary: "Map high-value prompts to pages with explicit answer blocks and evidence anchors.",
            nextStep: "Close uncovered intents by publishing deterministic, entity-locked content units.",
            instructions: [
                "Select high-impact intent kernels.",
                "Map each kernel to a destination page.",
                "Publish answer-first sections with entity anchors.",
            ],
            primaryActionPath: "/app/prompt-intelligence",
            primaryActionLabel: "View Prompt Gaps",
        },
    },
    {
        match: "exact",
        path: "/app/competitors",
        guide: {
            title: "Competitor Evidence Comparison",
            section: "Evidence",
            summary: "Benchmark your citation footprint against competitors across shared query vectors.",
            nextStep: "Turn competitor wins into explicit fix tickets with measurable evidence targets.",
            instructions: [
                "Compare overlap in answer surfaces.",
                "Find where competitors outrank your entity.",
                "Convert gaps into implementation tickets.",
            ],
            primaryActionPath: "/app/score-fix",
            primaryActionLabel: "Route Fixes",
            minTier: "alignment",
        },
    },
    {
        match: "exact",
        path: "/app/citations",
        guide: {
            title: "Citation Testing",
            section: "Evidence",
            summary: "Verify whether AI engines cite your pages and detect attribution drift early.",
            nextStep: "Run tests per cluster and log citation outcomes into CITE LEDGER evidence trails.",
            instructions: [
                "Run citation tests by query cluster.",
                "Log result and source confidence.",
                "Escalate unstable citations for fixes.",
            ],
            primaryActionPath: "/app/reports",
            primaryActionLabel: "Open Evidence Reports",
            minTier: "alignment",
        },
    },
    {
        match: "exact",
        path: "/app/brand-integrity",
        guide: {
            title: "Brand Integrity",
            section: "Extensions",
            summary: "Track entity naming consistency so models retain a single canonical brand identity.",
            nextStep: "Fix alias drift and enforce exact entity anchors across all high-traffic pages.",
            instructions: [
                "Audit all entity variants in content.",
                "Enforce canonical names in schema and copy.",
                "Re-test with answer engines for drift.",
            ],
            primaryActionPath: "/app/answer-presence",
            primaryActionLabel: "Track Presence",
            minTier: "alignment",
        },
    },
    {
        match: "exact",
        path: "/app/reverse-engineer",
        guide: {
            title: "Reverse Engineer",
            section: "Extensions",
            summary: "Inspect model output patterns and isolate what structures produce stable citations.",
            nextStep: "Translate observed winning structures into deterministic publishing templates.",
            instructions: [
                "Capture high-performing answer patterns.",
                "Extract stable structure signatures.",
                "Apply signatures in content factory workflows.",
            ],
            primaryActionPath: "/app/pipeline",
            primaryActionLabel: "Open Pipeline",
            minTier: "alignment",
        },
    },
    {
        match: "exact",
        path: "/app/pipeline",
        guide: {
            title: "Entity-Locked Generation Pipeline",
            section: "Platform",
            summary: "Operate a controlled content lattice: stable entity cores, topic kernels, and deterministic structural mutations.",
            nextStep: "Publish only schema-safe outputs and log every generated artifact into CITE LEDGER.",
            instructions: [
                "Freeze entity core anchors.",
                "Generate kernels x structural mutations.",
                "Publish, verify, and ledger-log each output.",
            ],
            primaryActionPath: "/app/dataset",
            primaryActionLabel: "Open Dataset Studio",
        },
    },
    {
        match: "exact",
        path: "/app/dataset",
        guide: {
            title: "Dataset Studio",
            section: "Agency",
            summary: "Curate deterministic post batches and semantic fingerprints for anti-duplication control.",
            nextStep: "Keep kernel/template/entity signatures unique and reroute collisions into regeneration.",
            instructions: [
                "Build semantic fingerprint per output.",
                "Block duplicate lattice collisions.",
                "Export clean batches for publication.",
            ],
            primaryActionPath: "/app/pipeline",
            primaryActionLabel: "Back to Pipeline",
            minTier: "signal",
        },
    },
    {
        match: "exact",
        path: "/app/workflow",
        guide: {
            title: "Execution Workflow",
            section: "Platform",
            summary: "Run the evidence loop from audit signals to implementation, verification, and ledger closure.",
            nextStep: "Move each blocker through fix, validation, and publication with no orphan tasks.",
            instructions: [
                "Create fix tasks from evidence.",
                "Ship changes in production.",
                "Verify and close in ledger.",
            ],
            primaryActionPath: "/app/reports",
            primaryActionLabel: "Open Reports",
        },
    },
    {
        match: "exact",
        path: "/app/benchmarks",
        guide: {
            title: "Benchmark Index",
            section: "Evidence",
            summary: "Track how your AI visibility compares against category-level expectations.",
            nextStep: "Use benchmark deltas to prioritize which systems need immediate hardening.",
            instructions: [
                "Read benchmark baseline.",
                "Measure your current variance.",
                "Prioritize highest-impact variance fixes.",
            ],
            primaryActionPath: "/app/analytics",
            primaryActionLabel: "Open Visibility Intelligence",
        },
    },
    {
        match: "exact",
        path: "/app/niche-discovery",
        guide: {
            title: "Niche Discovery",
            section: "Extensions",
            summary: "Identify underserved query clusters where your entity can gain citation share fastest.",
            nextStep: "Launch focused lattice batches into low-competition query windows.",
            instructions: [
                "Find under-covered query clusters.",
                "Map cluster to entity-safe templates.",
                "Publish and measure citation pickup.",
            ],
            primaryActionPath: "/app/pipeline",
            primaryActionLabel: "Generate Batch",
        },
    },
    {
        match: "exact",
        path: "/app/domain-rating",
        guide: {
            title: "Domain Rating",
            section: "Platform Tools",
            summary: "Evaluate authority and trust signals that influence retrieval confidence.",
            nextStep: "Patch trust signal gaps before scaling content production.",
            instructions: [
                "Review trust and authority factors.",
                "Fix technical trust deficits.",
                "Re-audit to confirm lift.",
            ],
            primaryActionPath: "/app/score-fix",
            primaryActionLabel: "Open Score Fix",
            minTier: "alignment",
        },
    },
    {
        match: "exact",
        path: "/app/mcp",
        guide: {
            title: "MCP Console",
            section: "Platform",
            summary: "Connect automation workflows for repeatable remediation and controlled publishing operations.",
            nextStep: "Wire tool actions to evidence outputs and keep execution fully auditable.",
            instructions: [
                "Connect required MCP tools.",
                "Map tools to remediation workflow.",
                "Validate output and auditability.",
            ],
            primaryActionPath: "/app/workflow",
            primaryActionLabel: "Open Workflow",
            minTier: "alignment",
        },
    },
    {
        match: "exact",
        path: "/app/gsc",
        guide: {
            title: "GSC Console",
            section: "Platform",
            summary: "Correlate search-console signals with AI visibility evidence to detect indexing vs comprehension gaps.",
            nextStep: "Use GSC coverage/performance anomalies to prioritize pages for entity and extractability hardening.",
            instructions: [
                "Review coverage and indexing anomalies.",
                "Map anomalies to low-visibility routes.",
                "Send selected pages into remediation.",
            ],
            primaryActionPath: "/app/analytics",
            primaryActionLabel: "Open Visibility Intelligence",
            minTier: "alignment",
        },
    },
    {
        match: "exact",
        path: "/app/integrations",
        guide: {
            title: "Integrations Hub",
            section: "Agency",
            summary: "Connect external systems for publishing, telemetry, and evidence synchronization.",
            nextStep: "Enable only integrations that preserve entity consistency and audit traceability.",
            instructions: [
                "Connect core publishing channels.",
                "Enable telemetry and backfill checks.",
                "Audit entity retention post-sync.",
            ],
            primaryActionPath: "/app/api-docs",
            primaryActionLabel: "Review API Docs",
            minTier: "signal",
        },
    },
    {
        match: "exact",
        path: "/app/agency",
        guide: {
            title: "Agency Workspace",
            section: "Agency",
            summary: "Operate multi-client execution with consistent evidence workflows and standardized remediation loops.",
            nextStep: "Enforce the same analyze-evidence-fix-verify cadence across all managed accounts.",
            instructions: [
                "Use a shared workflow per client.",
                "Track blockers and closure rate.",
                "Report score movement with evidence.",
            ],
            primaryActionPath: "/app/workflow",
            primaryActionLabel: "Open Workflow",
        },
    },
    {
        match: "exact",
        path: "/app/badge",
        guide: {
            title: "Badge Embed",
            section: "Agency",
            summary: "Publish live trust/visibility badges to expose current evidence status externally.",
            nextStep: "Embed the badge on key pages and keep it synced with verified report data.",
            instructions: [
                "Generate embed configuration.",
                "Place badge on high-trust pages.",
                "Confirm updates reflect latest runs.",
            ],
            primaryActionPath: "/app/reports",
            primaryActionLabel: "Open Reports",
        },
    },
    {
        match: "exact",
        path: "/app/api-docs",
        guide: {
            title: "API Documentation",
            section: "Agency",
            summary: "Reference authenticated endpoints for audits, analytics, and evidence workflows.",
            nextStep: "Use scoped keys/tokens and implement deterministic ingestion + publication handlers.",
            instructions: [
                "Review endpoint contracts.",
                "Implement typed integrations.",
                "Validate responses against shared schema.",
            ],
            primaryActionPath: "/app/integrations",
            primaryActionLabel: "Open Integrations",
            minTier: "signal",
        },
    },
    {
        match: "exact",
        path: "/app/settings",
        guide: {
            title: "Workspace Settings",
            section: "Account",
            summary: "Configure workspace behavior, profile defaults, and operational preferences.",
            nextStep: "Align defaults to your production workflow before scaling team execution.",
            instructions: [
                "Set workspace defaults.",
                "Configure team-visible preferences.",
                "Validate operational consistency.",
            ],
            primaryActionPath: "/app/team",
            primaryActionLabel: "Manage Team",
        },
    },
    {
        match: "exact",
        path: "/app/team",
        guide: {
            title: "Team Management",
            section: "Account",
            summary: "Manage execution roles for audits, remediation, and publishing operations.",
            nextStep: "Assign ownership per workflow stage to remove execution bottlenecks.",
            instructions: [
                "Assign clear role ownership.",
                "Route tasks by workflow stage.",
                "Review delivery throughput weekly.",
            ],
            primaryActionPath: "/app/workflow",
            primaryActionLabel: "Open Workflow",
        },
    },
    {
        match: "exact",
        path: "/app/billing",
        guide: {
            title: "Billing & Plans",
            section: "Account",
            summary: "Manage tier entitlements and ensure features match operational scope.",
            nextStep: "Use tier capabilities that match your current execution volume and automation needs.",
            instructions: [
                "Review active plan scope.",
                "Confirm feature access requirements.",
                "Adjust tier for execution demands.",
            ],
            primaryActionPath: "/pricing",
            primaryActionLabel: "View Pricing",
        },
    },
    {
        match: "exact",
        path: "/app/profile",
        guide: {
            title: "Profile",
            section: "Account",
            summary: "Manage account identity details used across workspace ownership, reporting, and communication.",
            nextStep: "Keep profile and organization metadata current to maintain consistent audit attribution.",
            instructions: [
                "Review account identity fields.",
                "Update organization metadata.",
                "Confirm report attribution accuracy.",
            ],
            primaryActionPath: "/app/settings",
            primaryActionLabel: "Open Settings",
        },
    },
    {
        match: "exact",
        path: "/app/referrals",
        guide: {
            title: "Referrals",
            section: "Account",
            summary: "Track referral performance and partner-driven account growth tied to platform usage.",
            nextStep: "Review referral conversion quality and focus on channels with strongest activation outcomes.",
            instructions: [
                "Review referral source quality.",
                "Measure conversion and activation.",
                "Scale highest-performing channels.",
            ],
            primaryActionPath: "/app/billing",
            primaryActionLabel: "Open Billing",
        },
    },
    {
        match: "exact",
        path: "/app/compliance-dashboard",
        guide: {
            title: "Compliance Dashboard",
            section: "Account",
            summary: "Monitor compliance posture for operational, policy, and governance requirements.",
            nextStep: "Resolve open compliance findings before large-scale publishing or automation rollouts.",
            instructions: [
                "Review open compliance checks.",
                "Assign owners per finding.",
                "Verify closure evidence.",
            ],
            primaryActionPath: "/app/team",
            primaryActionLabel: "Assign Owners",
        },
    },
    {
        match: "exact",
        path: "/app/notifications",
        guide: {
            title: "Notifications",
            section: "Account",
            summary: "Configure alerting for audit failures, drift signals, and remediation events.",
            nextStep: "Set high-signal alerts only so teams respond quickly without notification fatigue.",
            instructions: [
                "Enable critical drift alerts.",
                "Route alerts to accountable owners.",
                "Tune noisy channels weekly.",
            ],
            primaryActionPath: "/app/settings",
            primaryActionLabel: "Tune Settings",
        },
    },
    {
        match: "exact",
        path: "/app/admin",
        guide: {
            title: "Admin Console",
            section: "Account",
            summary: "Administer system-level controls for cache, operations, and platform governance.",
            nextStep: "Use admin actions with auditability and rollback awareness to avoid production regressions.",
            instructions: [
                "Review pending admin tasks.",
                "Execute controlled operations only.",
                "Validate system health post-action.",
            ],
            primaryActionPath: "/app/compliance-dashboard",
            primaryActionLabel: "Open Compliance",
        },
    },
    {
        match: "prefix",
        path: "/app/audits/",
        guide: {
            title: "Audit Detail",
            section: "Evidence",
            summary: "Deep evidence view for one run: findings, gaps, drift, and action recommendations.",
            nextStep: "Use this as the source of truth for implementation tickets and re-audit criteria.",
            primaryActionPath: "/app/reports",
            primaryActionLabel: "Back to Reports",
        },
    },
    {
        match: "exact",
        path: "/tools/schema-validator",
        guide: {
            title: "Schema Validator",
            section: "Platform Tools",
            summary: "Validate JSON-LD and structured entities exactly how crawlers consume them.",
            nextStep: "Fix invalid fields and revalidate before rerunning a full site audit.",
            primaryActionPath: "/app/scan",
            primaryActionLabel: "Run Full Audit",
        },
    },
    {
        match: "exact",
        path: "/app/schema-validator",
        guide: {
            title: "Schema Validator",
            section: "Platform Tools",
            summary: "Validate JSON-LD and structured entities exactly how crawlers consume them.",
            nextStep: "Fix invalid fields and revalidate before rerunning a full site audit.",
            primaryActionPath: "/app/scan",
            primaryActionLabel: "Run Full Audit",
        },
    },
    {
        match: "exact",
        path: "/tools/robots-checker",
        guide: {
            title: "Robots Checker",
            section: "Platform Tools",
            summary: "Verify crawler access policies for AI answer engines and search bots.",
            nextStep: "Remove accidental blocks and confirm AI agents can fetch your key pages.",
            primaryActionPath: "/tools/server-headers",
            primaryActionLabel: "Check Headers",
        },
    },
    {
        match: "exact",
        path: "/app/robots-checker",
        guide: {
            title: "Robots Checker",
            section: "Platform Tools",
            summary: "Verify crawler access policies for AI answer engines and search bots.",
            nextStep: "Remove accidental blocks and confirm AI agents can fetch your key pages.",
            primaryActionPath: "/app/server-headers",
            primaryActionLabel: "Check Headers",
        },
    },
    {
        match: "exact",
        path: "/tools/content-extractability",
        guide: {
            title: "Content Extractability",
            section: "Platform Tools",
            summary: "Evaluate whether page sections are machine-readable and retrieval-friendly.",
            nextStep: "Restructure long prose into direct answer blocks with explicit evidence statements.",
            primaryActionPath: "/app/score-fix",
            primaryActionLabel: "Route to Fixes",
        },
    },
    {
        match: "exact",
        path: "/app/content-extractability",
        guide: {
            title: "Content Extractability",
            section: "Platform Tools",
            summary: "Evaluate whether page sections are machine-readable and retrieval-friendly.",
            nextStep: "Restructure long prose into direct answer blocks with explicit evidence statements.",
            primaryActionPath: "/app/score-fix",
            primaryActionLabel: "Route to Fixes",
        },
    },
    {
        match: "exact",
        path: "/tools/server-headers",
        guide: {
            title: "Server Headers",
            section: "Platform Tools",
            summary: "Review technical trust headers that affect crawler behavior and reliability.",
            nextStep: "Resolve missing security/caching signals and verify stable HTTP responses.",
            primaryActionPath: "/tools/robots-checker",
            primaryActionLabel: "Check Robots",
        },
    },
    {
        match: "exact",
        path: "/app/server-headers",
        guide: {
            title: "Server Headers",
            section: "Platform Tools",
            summary: "Review technical trust headers that affect crawler behavior and reliability.",
            nextStep: "Resolve missing security/caching signals and verify stable HTTP responses.",
            primaryActionPath: "/app/robots-checker",
            primaryActionLabel: "Check Robots",
        },
    },
    {
        match: "exact",
        path: "/tools/language-checker",
        guide: {
            title: "Language Checker",
            section: "Platform Tools",
            summary: "Validate language tagging and clarity so retrieval models map content correctly.",
            nextStep: "Align language declarations and copy intent per locale.",
            primaryActionPath: "/app/scan",
            primaryActionLabel: "Audit URL",
        },
    },
    {
        match: "exact",
        path: "/app/language-checker",
        guide: {
            title: "Language Checker",
            section: "Platform Tools",
            summary: "Validate language tagging and clarity so retrieval models map content correctly.",
            nextStep: "Align language declarations and copy intent per locale.",
            primaryActionPath: "/app/scan",
            primaryActionLabel: "Audit URL",
        },
    },
    {
        match: "exact",
        path: "/app/help",
        guide: {
            title: "Help Center",
            section: "Resources",
            summary: "Access implementation guidance for audit workflows, scoring, and feature usage.",
            nextStep: "Use task-based guides and route unclear outcomes back into support tickets.",
            primaryActionPath: "/guide",
            primaryActionLabel: "Open Guide",
        },
    },
    {
        match: "exact",
        path: "/tools",
        guide: {
            title: "Platform Tools",
            section: "Platform Tools",
            summary: "Use focused diagnostics to isolate technical blockers before full audit reruns.",
            nextStep: "Run the targeted tool, apply fixes, then verify through a full audit pass.",
            primaryActionPath: "/app/scan",
            primaryActionLabel: "Run Full Audit",
        },
    },
    {
        match: "prefix",
        path: "/tools/",
        guide: {
            title: "Platform Tools",
            section: "Platform Tools",
            summary: "Use focused diagnostics to isolate technical blockers before full audit reruns.",
            nextStep: "Run the targeted tool, apply fixes, then verify through a full audit pass.",
            primaryActionPath: "/app/scan",
            primaryActionLabel: "Run Full Audit",
        },
    },
    {
        match: "exact",
        path: "/audit/:id",
        guide: {
            title: "Audit Detail",
            section: "Evidence",
            summary: "Deep evidence view for one run: findings, gaps, drift, and action recommendations.",
            nextStep: "Use this as the source of truth for implementation tickets and re-audit criteria.",
            primaryActionPath: "/app/reports",
            primaryActionLabel: "Back to Reports",
        },
    },
    {
        match: "prefix",
        path: "/app/",
        guide: {
            title: "Platform Workspace",
            section: "App",
            summary: "Operate the evidence-first loop: audit, verify, remediate, and validate score movement.",
            nextStep: "Pick one route objective, execute it fully, then log outcomes in your workflow.",
            primaryActionPath: "/app",
            primaryActionLabel: "Back to Command Center",
        },
    },
];

const PUBLIC_ROUTE_GUIDES: PublicRouteGuideRule[] = [
    {
        match: "exact",
        path: "/pricing",
        guide: {
            title: "Pricing",
            section: "Public",
            summary: "Choose the tier that matches your operational execution depth and automation needs.",
            nextStep: "Match required workflows to tier gates, then start with one audit-to-fix loop.",
            primaryActionPath: "/auth?mode=signup",
            primaryActionLabel: "Start Free",
        },
    },
    {
        match: "exact",
        path: "/guide",
        guide: {
            title: "Implementation Guide",
            section: "Resources",
            summary: "Step-by-step operational guidance for running evidence-first AI visibility workflows.",
            nextStep: "Follow one complete run: analyze, evidence review, remediation, and verification.",
            primaryActionPath: "/app/scan",
            primaryActionLabel: "Run Audit",
        },
    },
    {
        match: "exact",
        path: "/help",
        guide: {
            title: "Help Center",
            section: "Resources",
            summary: "Troubleshoot product workflows and remove blockers in implementation.",
            nextStep: "Use task-based guides and route unresolved issues into support.",
            primaryActionPath: "/guide",
            primaryActionLabel: "Open Guide",
        },
    },
    {
        match: "exact",
        path: "/api-docs",
        guide: {
            title: "Public API Documentation",
            section: "Resources",
            summary: "Explore endpoint contracts, authentication, and integration patterns.",
            nextStep: "Implement one deterministic flow first, then expand to automation.",
            primaryActionPath: "/integrations",
            primaryActionLabel: "Open Integrations",
        },
    },
    {
        match: "exact",
        path: "/methodology",
        guide: {
            title: "Methodology",
            section: "Evidence",
            summary: "Understand scoring, evidence weighting, and attribution reliability principles.",
            nextStep: "Use methodology definitions to interpret score changes with confidence.",
            primaryActionPath: "/methodology/cite-ledger",
            primaryActionLabel: "Read CITE LEDGER",
        },
    },
    {
        match: "prefix",
        path: "/methodology/",
        guide: {
            title: "Methodology Reference",
            section: "Evidence",
            summary: "Detailed protocol pages for CITE LEDGER, triple-check, BRAG, and entity resolution.",
            nextStep: "Translate protocol rules directly into your implementation workflow.",
            primaryActionPath: "/app/reports",
            primaryActionLabel: "Open Reports",
        },
    },
    {
        match: "prefix",
        path: "/evidence/",
        guide: {
            title: "Evidence Library",
            section: "Evidence",
            summary: "Browse ledger artifacts, citation outcomes, and drift logs used to support visibility claims.",
            nextStep: "Use evidence examples to harden your own audit and remediation process.",
            primaryActionPath: "/app/citations",
            primaryActionLabel: "Run Citation Test",
        },
    },
    {
        match: "exact",
        path: "/blogs",
        guide: {
            title: "Blog Library",
            section: "Resources",
            summary: "Operational content on AI visibility systems, retrieval behavior, and implementation patterns.",
            nextStep: "Pick one playbook and execute it in your current sprint.",
            primaryActionPath: "/app/workflow",
            primaryActionLabel: "Open Workflow",
        },
    },
    {
        match: "prefix",
        path: "/blogs/",
        guide: {
            title: "Article",
            section: "Resources",
            summary: "Actionable implementation article with direct relevance to evidence-first execution.",
            nextStep: "Apply the documented steps to one live URL and verify score movement.",
            primaryActionPath: "/app/scan",
            primaryActionLabel: "Analyze URL",
        },
    },
    {
        match: "prefix",
        path: "/platforms",
        guide: {
            title: "Platform Pages",
            section: "Resources",
            summary: "Platform-specific diagnostics and guidance for answer-engine visibility readiness.",
            nextStep: "Map your platform constraints to the recommended implementation path.",
            primaryActionPath: "/tools/content-extractability",
            primaryActionLabel: "Run Extractability Check",
        },
    },
    {
        match: "prefix",
        path: "/problems",
        guide: {
            title: "Problem Library",
            section: "Resources",
            summary: "Root-cause pages for common AI visibility failures and technical trust gaps.",
            nextStep: "Identify your dominant failure mode and apply the corresponding fix path.",
            primaryActionPath: "/app/score-fix",
            primaryActionLabel: "Open Score Fix",
        },
    },
    {
        match: "prefix",
        path: "/signals",
        guide: {
            title: "Signal Library",
            section: "Resources",
            summary: "Reference pages for technical and semantic signals that drive extractability and citation confidence.",
            nextStep: "Audit weakest signals first, then verify improvements with a fresh run.",
            primaryActionPath: "/app/scan",
            primaryActionLabel: "Run Audit",
        },
    },
    {
        match: "prefix",
        path: "/industries",
        guide: {
            title: "Industry Playbooks",
            section: "Resources",
            summary: "Sector-specific implementation views for evidence-first visibility programs.",
            nextStep: "Adapt one industry playbook to your entity and query cluster model.",
            primaryActionPath: "/app/pipeline",
            primaryActionLabel: "Open Pipeline",
        },
    },
    {
        match: "prefix",
        path: "/compare",
        guide: {
            title: "Competitive Comparison",
            section: "Resources",
            summary: "Compare tool and workflow approaches against an evidence-first operating model.",
            nextStep: "Extract the winning operational pattern and apply it in your own runbook.",
            primaryActionPath: "/app/competitors",
            primaryActionLabel: "Compare Competitors",
        },
    },
    {
        match: "prefix",
        path: "/tools",
        guide: {
            title: "Free Tools",
            section: "Platform",
            summary: "Diagnostic utilities for schema validation, server headers, robot rules, and content extractability.",
            nextStep: "Run one tool to surface structural gaps in your implementation.",
            primaryActionPath: "/tools/schema-validator",
            primaryActionLabel: "Run Schema Validator",
        },
    },
    {
        match: "prefix",
        path: "/audit/",
        guide: {
            title: "Audit Details",
            section: "Core",
            summary: "Review evidence from a completed audit showing opportunities, blockers, and citation opportunities.",
            nextStep: "Route findings into Score Fix for implementation.",
            primaryActionPath: "/app/reports",
            primaryActionLabel: "View All Reports",
        },
    },
];

export function getRouteGuide(pathname: string): RouteGuide | null {
    const exact = ROUTE_GUIDES.find((rule) => rule.match === "exact" && rule.path === pathname);
    if (exact) return exact.guide;

    const prefix = ROUTE_GUIDES.find((rule) => rule.match === "prefix" && pathname.startsWith(rule.path));
    if (prefix) return prefix.guide;

    return null;
}

export function getPublicRouteGuide(pathname: string): RouteGuide | null {
    const exact = PUBLIC_ROUTE_GUIDES.find((rule) => rule.match === "exact" && rule.path === pathname);
    if (exact) return exact.guide;

    const prefix = PUBLIC_ROUTE_GUIDES.find((rule) => rule.match === "prefix" && pathname.startsWith(rule.path));
    if (prefix) return prefix.guide;

    return null;
}
