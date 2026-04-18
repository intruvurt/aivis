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
    {
        key: "core",
        titleKey: "sidebar.core",
        iconClass: "text-blue-400",
        iconBg: "bg-blue-500/10",
        items: [
            { to: "/app", labelKey: "sidebar.overview", iconName: "LayoutDashboard" },
            { to: "/app/analyze", labelKey: "sidebar.seeVisibility", iconName: "Search" },
            { to: "/app/reports", labelKey: "sidebar.reports", iconName: "FileText" },
            { to: "/app/score-fix", labelKey: "sidebar.scorefix", iconName: "Zap" },
        ],
    },
    {
        key: "evidence",
        titleKey: "sidebar.evidence",
        iconClass: "text-violet-400",
        iconBg: "bg-violet-500/10",
        items: [
            { to: "/app/analytics", labelKey: "sidebar.analytics", iconName: "BarChart3" },
            { to: "/app/citations", labelKey: "sidebar.citations", iconName: "FlaskConical", minTier: "alignment" },
            { to: "/app/competitors", labelKey: "sidebar.competitors", iconName: "Users", minTier: "alignment" },
            { to: "/app/benchmarks", labelKey: "sidebar.benchmarks", iconName: "Layers" },
        ],
    },
    {
        key: "extensions",
        titleKey: "sidebar.extensions",
        iconClass: "text-emerald-400",
        iconBg: "bg-emerald-500/10",
        items: [
            { to: "/app/keywords", labelKey: "sidebar.keywords", iconName: "Target" },
            { to: "/app/prompt-intelligence", labelKey: "sidebar.queryGaps", iconName: "Brain", minTier: "alignment" },
            { to: "/app/answer-presence", labelKey: "sidebar.answerPresence", iconName: "Eye", minTier: "alignment" },
            { to: "/app/reverse-engineer", labelKey: "sidebar.reverseEngineer", iconName: "ArrowLeftRight", minTier: "alignment" },
            { to: "/app/brand-integrity", labelKey: "sidebar.brandIntegrity", iconName: "Shield", minTier: "alignment" },
            { to: "/app/niche-discovery", labelKey: "sidebar.nicheDiscovery", iconName: "Globe" },
        ],
    },
    {
        key: "platform",
        titleKey: "sidebar.platform",
        iconClass: "text-amber-400",
        iconBg: "bg-amber-500/10",
        items: [
            { to: "/tools/schema-validator", labelKey: "sidebar.schemaValidator", iconName: "Shield" },
            { to: "/tools/server-headers", labelKey: "sidebar.serverHeaders", iconName: "Globe" },
            { to: "/tools/robots-checker", labelKey: "sidebar.aiCrawlers", iconName: "Cpu" },
            { to: "/tools/content-extractability", labelKey: "sidebar.contentExtractability", iconName: "FileSearch" },
            { to: "/tools/language-checker", labelKey: "sidebar.languageChecker", iconName: "Languages" },
            { to: "/app/domain-rating", labelKey: "sidebar.domainRating", iconName: "TrendingUp", minTier: "alignment" },
            { to: "/app/mcp", labelKey: "sidebar.mcpConsole", iconName: "Wrench", minTier: "alignment" },
        ],
    },
    {
        key: "agency",
        titleKey: "sidebar.agency",
        iconClass: "text-indigo-400",
        iconBg: "bg-indigo-500/10",
        items: [
            { to: "/app/badge", labelKey: "sidebar.badge", iconName: "Award" },
            { to: "/app/dataset", labelKey: "sidebar.datasetStudio", iconName: "Database", minTier: "signal" },
            { to: "/app/api-docs", labelKey: "sidebar.apiDocs", iconName: "Code2", minTier: "signal" },
            { to: "/app/integrations", labelKey: "sidebar.integrations", iconName: "Network", minTier: "signal" },
        ],
    },
    {
        key: "resources",
        titleKey: "sidebar.resources",
        iconClass: "text-cyan-400",
        iconBg: "bg-cyan-500/10",
        items: [
            { to: "/blogs", labelKey: "sidebar.blog", iconName: "BookOpen" },
            { to: "/guide", labelKey: "sidebar.guide", iconName: "HelpCircle" },
        ],
    },
    {
        key: "account",
        titleKey: "sidebar.account",
        iconClass: "text-slate-400",
        iconBg: "bg-slate-500/10",
        items: [
            { to: "/app/billing", labelKey: "sidebar.billing", iconName: "CreditCard" },
            { to: "/app/settings", labelKey: "sidebar.settings", iconName: "Settings" },
            { to: "/app/compliance-dashboard", labelKey: "sidebar.complianceDashboard", iconName: "Shield" },
            { to: "/app/help", labelKey: "sidebar.help", iconName: "HelpCircle" },
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
            primaryActionPath: "/app/analyze",
            primaryActionLabel: "Run Audit",
        },
    },
    {
        match: "exact",
        path: "/app/analyze",
        guide: {
            title: "Run AI Visibility Audit",
            section: "Core",
            summary: "Analyze one URL for extractability, trust, and citation readiness across AI answer engines.",
            nextStep: "Submit URL, wait for evidence pipeline, then route blockers into Score Fix.",
            instructions: [
                "Analyze one canonical URL per run.",
                "Capture evidence and blocker list.",
                "Send fixes to implementation queue.",
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
            title: "Score Analytics",
            section: "Evidence",
            summary: "Track score movement over time and confirm fixes create measurable lift.",
            nextStep: "Compare recent runs and flag any score drift before shipping content updates.",
            instructions: [
                "Compare baseline vs latest run.",
                "Identify drift dimensions.",
                "Validate remediation impact.",
            ],
            primaryActionPath: "/app/reports",
            primaryActionLabel: "Compare Reports",
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
            primaryActionPath: "/app/analyze",
            primaryActionLabel: "Re-analyze",
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
            primaryActionLabel: "Open Analytics",
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
            primaryActionPath: "/app/analyze",
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
            primaryActionPath: "/app/analyze",
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
            primaryActionPath: "/app/analyze",
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
            primaryActionPath: "/app/analyze",
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

export function getRouteGuide(pathname: string): RouteGuide | null {
    const exact = ROUTE_GUIDES.find((rule) => rule.match === "exact" && rule.path === pathname);
    if (exact) return exact.guide;

    const prefix = ROUTE_GUIDES.find((rule) => rule.match === "prefix" && pathname.startsWith(rule.path));
    if (prefix) return prefix.guide;

    return null;
}
