import React from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';

import { useInitializeSettings } from './hooks/useInitializeSettings';
import { useAuthStore } from './stores/authStore';
import { useWorkspaceStore } from './stores/workspaceStore';

import PublicLayout from './components/PublicLayout';
import AppLayout from './components/AppLayout';
import { CookieConsent } from './components/CookieConsent';
import PageLoadingSpinner from './components/PageLoadingSpinner';
import ProtectedRoute from './components/ProtectedRoute';

/* ── Lazy-loaded pages (code-split for fast initial load) ── */
const Dashboard = React.lazy(() => import('./views/Dashboard'));
const AnalyzePage = React.lazy(() => import('./views/AnalyzePage'));
const PricingPage = React.lazy(() => import('./views/PricingPage'));
const PartnershipTermsPage = React.lazy(() => import('./pages/PartnershipAgreementPage'));
const PartnershipPaymentPage = React.lazy(() => import('./pages/PartnershipPaymentPage'));
const ReferralRedirect = React.lazy(() => import('./pages/ReferralRedirect'));
const AuthPage = React.lazy(() => import('./views/AuthPage'));
const AnalyticsPage = React.lazy(() => import('./views/AnalyticsPage'));
const EvidenceRegistryPage = React.lazy(() => import('./views/EvidenceRegistryPage'));
const KeywordsPage = React.lazy(() => import('./views/KeywordsPage'));
const CompetitorsPage = React.lazy(() => import('./views/CompetitorsPage'));
const NicheDiscoveryPage = React.lazy(() => import('./views/NicheDiscoveryPage'));
const CitationsPage = React.lazy(() => import('./views/CitationsPage'));
const ReportsPage = React.lazy(() => import('./views/ReportsPage'));
const GuidePage = React.lazy(() => import('./views/GuidePage'));
const ReverseEngineerPage = React.lazy(() => import('./views/ReverseEngineerPage'));
const PromptIntelligencePage = React.lazy(() => import('./views/PromptIntelligencePage'));
const AnswerPresencePage = React.lazy(() => import('./views/AnswerPresencePage'));
const BrandIntegrityPage = React.lazy(() => import('./views/BrandIntegrityPage'));
const ScoreFixPage = React.lazy(() => import('./views/ScoreFixPage'));
const SiteCrawlPage = React.lazy(() => import('./views/SiteCrawlPage'));
const PipelinePage = React.lazy(() => import('./views/PipelinePage'));
const DatasetStudioPage = React.lazy(() => import('./views/DatasetStudioPage'));

const NotFound = React.lazy(() => import('./pages/NotFound'));
const Profile = React.lazy(() => import('./pages/Profile'));
const ReferralsPage = React.lazy(() => import('./pages/ReferralsPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const BillingPage = React.lazy(() => import('./pages/BillingPage'));
const ComplianceDashboardPage = React.lazy(() => import('./views/ComplianceDashboardPage'));
const AboutPage = React.lazy(() => import('./pages/AboutPage'));
const FAQ = React.lazy(() => import('./pages/FAQ'));
const PrivacyPage = React.lazy(() => import('./pages/PrivacyPage'));
const TermsPage = React.lazy(() => import('./pages/TermsPage'));
const DisclosuresPage = React.lazy(() => import('./pages/DisclosuresPage'));
const VerifyEmailPage = React.lazy(() => import('./pages/VerifyEmailPage'));
const VerifyLicensePage = React.lazy(() => import('./pages/VerifyLicensePage'));
const PaymentSuccessPage = React.lazy(() => import('./pages/PaymentSuccessPage'));
const PaymentCanceledPage = React.lazy(() => import('./pages/PaymentCanceledPage'));
const ResetAuth = React.lazy(() => import('./pages/ResetAuth'));
const ApiDocsPage = React.lazy(() => import('./pages/ApiDocsPage'));
const ServerHeadersPage = React.lazy(() => import('./pages/ServerHeadersPage'));
const SchemaValidatorPage = React.lazy(() => import('./pages/SchemaValidatorPage'));
const RobotsCheckerPage = React.lazy(() => import('./pages/RobotsCheckerPage'));
const ContentExtractabilityPage = React.lazy(() => import('./pages/ContentExtractabilityPage'));
const LanguageCheckerPage = React.lazy(() => import('./pages/LanguageCheckerPage'));
const DomainRatingPage = React.lazy(() => import('./pages/DomainRatingPage'));
const ComparisonPage = React.lazy(() => import('./pages/ComparisonPage'));
const PlatformWorkflowPage = React.lazy(() => import('./pages/PlatformWorkflowPage'));
const MethodologyPage = React.lazy(() => import('./pages/MethodologyPage'));
const IntegrationsHubPage = React.lazy(() => import('./pages/IntegrationsHubPage'));
const McpConsolePage = React.lazy(() => import('./pages/McpConsolePage'));
const GscConsolePage = React.lazy(() => import('./pages/GscConsolePage'));
const CompetitiveLandscapePage = React.lazy(() => import('./pages/CompetitiveLandscapePage'));
const CompareOtterlyPage = React.lazy(() => import('./pages/CompareOtterlyPage'));
const CompareReauditPage = React.lazy(() => import('./pages/CompareReauditPage'));
const CompareProfoundPage = React.lazy(() => import('./pages/CompareProfoundPage'));
const CompareSemrushPage = React.lazy(() => import('./pages/CompareSemrushPage'));
const CompareAhrefsPage = React.lazy(() => import('./pages/CompareAhrefsPage'));
const CompareRankScalePage = React.lazy(() => import('./pages/CompareRankScalePage'));
const GlossaryPage = React.lazy(() => import('./pages/GlossaryPage'));
const AiVisibilityBenchmark = React.lazy(() => import('./pages/AiVisibilityBenchmark'));
const NotificationsPage = React.lazy(() => import('./pages/NotificationsPage'));
const Admin = React.lazy(() => import('./pages/Admin'));
const TeamPage = React.lazy(() => import('./pages/TeamPage'));
const ResetPassword = React.lazy(() => import('./pages/ResetPassword'));
const HelpCenter = React.lazy(() => import('./pages/HelpCenter'));
const Landing = React.lazy(() => import('./pages/Landing'));
const SampleReport = React.lazy(() => import('./pages/SampleReport'));
const WhyAIVisibility = React.lazy(() => import('./pages/WhyAIVisibility'));
const AISearchVisibility2026 = React.lazy(() => import('./pages/AISearchVisibility2026'));
const InsightsPage = React.lazy(() => import('./pages/InsightsPage'));
const DebuggerPage = React.lazy(() => import('./views/DebuggerPage'));
const BlogsPage = React.lazy(() => import('./pages/BlogsPage'));
const BlogPostPage = React.lazy(() => import('./pages/BlogPostPage'));
const AuditDetails = React.lazy(() => import('./pages/AuditDetails'));
const AEOPlaybook2026 = React.lazy(() => import('./pages/AEOPlaybook2026'));
const GeoAIRanking2026 = React.lazy(() => import('./pages/GeoAIRanking2026'));
const ConversationalQueryPlaybook2026 = React.lazy(
  () => import('./pages/ConversationalQueryPlaybook2026')
);
const VoiceSearchAIAnswerOptimization2026 = React.lazy(
  () => import('./pages/VoiceSearchAIAnswerOptimization2026')
);
const PublicReportPage = React.lazy(() => import('./pages/PublicReportPage'));
const EntityNodePage = React.lazy(() => import('./pages/EntityNodePage'));
const CompliancePage = React.lazy(() => import('./pages/CompliancePage'));
const ChangelogPage = React.lazy(() => import('./pages/ChangelogPage'));
const PressPage = React.lazy(() => import('./pages/PressPage'));
const TripleCheckMethodologyPage = React.lazy(() => import('./pages/TripleCheckMethodologyPage'));
const InviteAcceptPage = React.lazy(() => import('./pages/InviteAcceptPage'));
const AgencyPage = React.lazy(() => import('./pages/AgencyPage'));
const SnapshotPage = React.lazy(() => import('./pages/SnapshotPage'));
const KeywordPageTemplate = React.lazy(() => import('./pages/KeywordPageTemplate'));
const KeywordClusterIndex = React.lazy(() => import('./pages/KeywordClusterIndex'));
const BadgeEmbedPage = React.lazy(() => import('./pages/BadgeEmbedPage'));

/* ── Taxonomy pages (About → Methodology → Evidence) ── */
const AboutAivisPage = React.lazy(() => import('./pages/taxonomy/AboutAivisPage'));
const WhatIsAivisPage = React.lazy(() => import('./pages/taxonomy/WhatIsAivisPage'));
const WhyAivisExistsPage = React.lazy(() => import('./pages/taxonomy/WhyAivisExistsPage'));
const CiteLedgerPage = React.lazy(() => import('./pages/taxonomy/CiteLedgerPage'));
const WhatIsCiteLedgerPage = React.lazy(() => import('./pages/taxonomy/WhatIsCiteLedgerPage'));
const TripleCheckProtocolPage = React.lazy(
  () => import('./pages/taxonomy/TripleCheckProtocolPage')
);
const BragEvidenceTrailsPage = React.lazy(() => import('./pages/taxonomy/BragEvidenceTrailsPage'));
const EntityResolutionModelPage = React.lazy(
  () => import('./pages/taxonomy/EntityResolutionModelPage')
);
const LedgerIndexPage = React.lazy(() => import('./pages/taxonomy/LedgerIndexPage'));
const CitationReportsPage = React.lazy(() => import('./pages/taxonomy/CitationReportsPage'));
const DriftAnalysisPage = React.lazy(() => import('./pages/taxonomy/DriftAnalysisPage'));
const QueryResultsLogPage = React.lazy(() => import('./pages/taxonomy/QueryResultsLogPage'));

/* ── Scroll to top on route change ─────────────────────── */
function ScrollToTop() {
  const { pathname, hash, search } = useLocation();
  useEffect(() => {
    const sectionParam = new URLSearchParams(search).get('section');
    const targetId = hash ? decodeURIComponent(hash.replace(/^#/, '')) : sectionParam;

    if (targetId) {
      const tryScroll = () => {
        const target = document.getElementById(targetId);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
        }
      };
      window.setTimeout(tryScroll, 0);
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    // Move focus to main content for screen readers (WCAG 2.4.3)
    const main = document.getElementById('main-content');
    if (main) {
      main.setAttribute('tabindex', '-1');
      main.focus({ preventScroll: true });
    }
  }, [pathname, hash, search]);
  return null;
}

/** Strip trailing slashes client-side so Google indexes the canonical (no-slash) version */
function TrailingSlashRedirect() {
  const { pathname, search, hash } = useLocation();
  if (pathname !== '/' && pathname.endsWith('/')) {
    return <Navigate to={`${pathname.replace(/\/+$/, '')}${search}${hash}`} replace />;
  }
  return null;
}

function AuthRouteGate() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();

  if (isAuthenticated) {
    const params = new URLSearchParams(location.search);
    let redirect = params.get('redirect') || '/';
    // Prevent open redirect: only allow relative paths (no protocol or //)
    if (redirect.includes('://') || redirect.startsWith('//')) {
      redirect = '/';
    }
    return <Navigate to={redirect} replace />;
  }

  return <AuthPage />;
}

function LegacyAuditRedirect() {
  const { id } = useParams();
  return <Navigate to={`/app/audits/${id}`} replace />;
}

export default function App() {
  useInitializeSettings();
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const fetchWorkspaces = useWorkspaceStore((s) => s.fetchWorkspaces);

  useEffect(() => {
    if (isHydrated && isAuthenticated) fetchWorkspaces();
  }, [isHydrated, isAuthenticated, fetchWorkspaces]);

  return (
    <div className="brand-vivid-ui">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'rgba(15,18,28,0.92)',
            color: '#ffffff',
            border: '1px solid rgba(255,255,255,0.22)',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: 'rgba(255,255,255,0.9)', secondary: 'rgba(15,18,28,0.92)' },
          },
          error: {
            iconTheme: { primary: '#fecaca', secondary: 'rgba(15,18,28,0.92)' },
            duration: 4000,
          },
        }}
      />
      <CookieConsent />
      <ScrollToTop />
      <TrailingSlashRedirect />

      {!isHydrated ? null : (
        <React.Suspense fallback={<PageLoadingSpinner />}>
          <Routes>
            {/* ═══ Public Marketing Shell ═══ */}
            <Route element={<PublicLayout />}>
              <Route
                path="/"
                element={isAuthenticated ? <Navigate to="/app" replace /> : <Landing />}
              />
              <Route path="/landing" element={<Landing />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/auth" element={<AuthRouteGate />} />
              <Route path="/reset-auth" element={<ResetAuth />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/verify-license" element={<VerifyLicensePage />} />
              <Route path="/invite/:token" element={<InviteAcceptPage />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/sample-report" element={<SampleReport />} />
              <Route path="/press" element={<PressPage />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/guide" element={<GuidePage />} />
              <Route path="/api-docs" element={<ApiDocsPage />} />
              <Route path="/help" element={<HelpCenter />} />
              <Route path="/support" element={<Navigate to="/help" replace />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/compliance" element={<CompliancePage />} />
              <Route path="/disclosures" element={<DisclosuresPage />} />
              <Route path="/methodology" element={<MethodologyPage />} />
              <Route path="/triple-check-methodology" element={<TripleCheckMethodologyPage />} />

              {/* ── Taxonomy: About layer ── */}
              <Route path="/about-aivis" element={<AboutAivisPage />} />
              <Route path="/what-is-aivis" element={<WhatIsAivisPage />} />
              <Route path="/why-aivis-exists" element={<WhyAivisExistsPage />} />

              {/* ── Taxonomy: Methodology layer ── */}
              <Route path="/methodology/cite-ledger" element={<CiteLedgerPage />} />
              <Route path="/what-is-cite-ledger" element={<WhatIsCiteLedgerPage />} />
              <Route
                path="/methodology/triple-check-protocol"
                element={<TripleCheckProtocolPage />}
              />
              <Route
                path="/methodology/brag-evidence-trails"
                element={<BragEvidenceTrailsPage />}
              />
              <Route
                path="/methodology/entity-resolution-model"
                element={<EntityResolutionModelPage />}
              />

              {/* ── Taxonomy: Evidence layer ── */}
              <Route path="/evidence/ledger-index" element={<LedgerIndexPage />} />
              <Route path="/evidence/citation-reports" element={<CitationReportsPage />} />
              <Route path="/evidence/drift-analysis" element={<DriftAnalysisPage />} />
              <Route path="/evidence/query-results-log" element={<QueryResultsLogPage />} />

              <Route path="/partnership-terms" element={<PartnershipTermsPage />} />
              <Route path="/partnership-payments" element={<PartnershipPaymentPage />} />
              <Route path="/r/:code" element={<ReferralRedirect />} />
              <Route path="/changelog" element={<ChangelogPage />} />
              <Route path="/compare" element={<ComparisonPage />} />
              <Route path="/compare/aivis-vs-otterly" element={<CompareOtterlyPage />} />
              <Route path="/compare/aivis-vs-reaudit" element={<CompareReauditPage />} />
              <Route path="/compare/aivis-vs-profound" element={<CompareProfoundPage />} />
              <Route path="/compare/aivis-vs-semrush" element={<CompareSemrushPage />} />
              <Route path="/compare/aivis-vs-ahrefs" element={<CompareAhrefsPage />} />
              <Route path="/compare/aivis-vs-rankscale" element={<CompareRankScalePage />} />
              <Route path="/competitive-landscape" element={<CompetitiveLandscapePage />} />
              <Route path="/glossary" element={<GlossaryPage />} />
              <Route path="/integrations" element={<IntegrationsHubPage />} />
              <Route path="/why-ai-visibility" element={<WhyAIVisibility />} />
              <Route path="/ai-search-visibility-2026" element={<AISearchVisibility2026 />} />
              <Route path="/insights" element={<InsightsPage />} />
              <Route path="/blogs" element={<BlogsPage />} />
              <Route path="/blogs/:slug" element={<BlogPostPage />} />
              <Route path="/aeo-playbook-2026" element={<AEOPlaybook2026 />} />
              <Route path="/geo-ai-ranking-2026" element={<GeoAIRanking2026 />} />
              <Route
                path="/conversational-query-playbook-2026"
                element={<ConversationalQueryPlaybook2026 />}
              />
              <Route
                path="/voice-search-ai-answer-optimization-2026"
                element={<VoiceSearchAIAnswerOptimization2026 />}
              />
              <Route path="/entity/:entitySlug" element={<EntityNodePage />} />
              <Route path="/entity/:entitySlug/audit/:shareId" element={<PublicReportPage />} />
              <Route path="/reports/public/:shareId" element={<PublicReportPage />} />
              <Route path="/report/public/:shareId" element={<PublicReportPage />} />
              <Route path="/report/:shareId" element={<PublicReportPage />} />
              <Route path="/payment-success" element={<PaymentSuccessPage />} />
              <Route path="/payment-canceled" element={<PaymentCanceledPage />} />

              {/* ── Keyword pages (100-page SEO system) ── */}
              <Route path="/platforms" element={<KeywordClusterIndex />} />
              <Route path="/platforms/:slug" element={<KeywordPageTemplate />} />
              <Route path="/problems" element={<KeywordClusterIndex />} />
              <Route path="/problems/:slug" element={<KeywordPageTemplate />} />
              <Route path="/signals" element={<KeywordClusterIndex />} />
              <Route path="/signals/:slug" element={<KeywordPageTemplate />} />
              <Route path="/industries" element={<KeywordClusterIndex />} />
              <Route path="/industries/:slug" element={<KeywordPageTemplate />} />
              <Route path="/compare/:slug" element={<KeywordPageTemplate />} />
              <Route path="/badge" element={<BadgeEmbedPage />} />
              <Route path="/login" element={<Navigate to="/auth?mode=signin" replace />} />
              <Route path="/register" element={<Navigate to="/auth?mode=signup" replace />} />
            </Route>

            {/* ═══ Free Tools (no auth required — server rate-limits) ═══ */}
            <Route path="/tools" element={<AppLayout />}>
              <Route path="schema-validator" element={<SchemaValidatorPage />} />
              <Route path="robots-checker" element={<RobotsCheckerPage />} />
              <Route path="content-extractability" element={<ContentExtractabilityPage />} />
              <Route path="server-headers" element={<ServerHeadersPage />} />
              <Route path="language-checker" element={<LanguageCheckerPage />} />
            </Route>

            {/* ═══ Authenticated App Shell ═══ */}
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="analyze" element={<AnalyzePage />} />
              <Route path="snapshot" element={<SnapshotPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="evidence" element={<EvidenceRegistryPage />} />
              <Route path="keywords" element={<KeywordsPage />} />
              <Route path="competitors" element={<CompetitorsPage />} />
              <Route path="niche-discovery" element={<NicheDiscoveryPage />} />
              <Route path="citations" element={<CitationsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="reverse-engineer" element={<ReverseEngineerPage />} />
              <Route path="prompt-intelligence" element={<PromptIntelligencePage />} />
              <Route path="answer-presence" element={<AnswerPresencePage />} />
              <Route path="brand-integrity" element={<BrandIntegrityPage />} />
              <Route path="score-fix" element={<ScoreFixPage />} />
              <Route path="site-crawl" element={<SiteCrawlPage />} />
              <Route path="pipeline" element={<PipelinePage />} />
              <Route path="dataset" element={<DatasetStudioPage />} />
              <Route path="benchmarks" element={<AiVisibilityBenchmark />} />
              <Route path="workflow" element={<PlatformWorkflowPage />} />
              <Route path="mcp" element={<McpConsolePage />} />
              <Route path="gsc" element={<GscConsolePage />} />
              <Route path="schema-validator" element={<SchemaValidatorPage />} />
              <Route path="server-headers" element={<ServerHeadersPage />} />
              <Route path="robots-checker" element={<RobotsCheckerPage />} />
              <Route path="content-extractability" element={<ContentExtractabilityPage />} />
              <Route path="language-checker" element={<LanguageCheckerPage />} />
              <Route path="domain-rating" element={<DomainRatingPage />} />
              <Route path="profile" element={<Profile />} />
              <Route path="referrals" element={<ReferralsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="billing" element={<BillingPage />} />
              <Route path="compliance-dashboard" element={<ComplianceDashboardPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="admin" element={<Admin />} />
              <Route path="team" element={<TeamPage />} />
              <Route path="agency" element={<AgencyPage />} />
              <Route path="badge" element={<BadgeEmbedPage />} />
              <Route path="api-docs" element={<ApiDocsPage />} />
              <Route path="integrations" element={<IntegrationsHubPage />} />
              <Route path="help" element={<HelpCenter />} />
              <Route path="audits/:id" element={<AuditDetails />} />{' '}
              <Route path="debugger" element={<DebuggerPage />} />{' '}
            </Route>

            <Route path="/audit/:id" element={<LegacyAuditRedirect />} />

            {/* ═══ Legacy redirects: old paths → /app/* ═══ */}
            <Route path="/analyze" element={<Navigate to="/app/analyze" replace />} />
            <Route path="/analytics" element={<Navigate to="/app/analytics" replace />} />
            <Route path="/evidence" element={<Navigate to="/app/evidence" replace />} />
            <Route path="/keywords" element={<Navigate to="/app/keywords" replace />} />
            <Route path="/competitors" element={<Navigate to="/app/competitors" replace />} />
            <Route path="/citations" element={<Navigate to="/app/citations" replace />} />
            <Route path="/reports" element={<Navigate to="/app/reports" replace />} />
            <Route
              path="/reverse-engineer"
              element={<Navigate to="/app/reverse-engineer" replace />}
            />
            <Route
              path="/prompt-intelligence"
              element={<Navigate to="/app/prompt-intelligence" replace />}
            />
            <Route
              path="/answer-presence"
              element={<Navigate to="/app/answer-presence" replace />}
            />
            <Route
              path="/brand-integrity"
              element={<Navigate to="/app/brand-integrity" replace />}
            />
            <Route path="/score-fix" element={<Navigate to="/app/score-fix" replace />} />
            <Route path="/site-crawl" element={<Navigate to="/app/site-crawl" replace />} />
            <Route path="/pipeline" element={<Navigate to="/app/pipeline" replace />} />
            <Route path="/benchmarks" element={<Navigate to="/app/benchmarks" replace />} />
            <Route path="/mcp" element={<Navigate to="/app/mcp" replace />} />
            <Route path="/gsc" element={<Navigate to="/app/gsc" replace />} />
            <Route
              path="/server-headers"
              element={<Navigate to="/tools/server-headers" replace />}
            />
            <Route
              path="/schema-validator"
              element={<Navigate to="/tools/schema-validator" replace />}
            />
            <Route
              path="/robots-checker"
              element={<Navigate to="/tools/robots-checker" replace />}
            />
            <Route
              path="/content-extractability"
              element={<Navigate to="/tools/content-extractability" replace />}
            />
            <Route
              path="/language-checker"
              element={<Navigate to="/tools/language-checker" replace />}
            />

            <Route path="/domain-rating" element={<Navigate to="/app/domain-rating" replace />} />
            <Route path="/profile" element={<Navigate to="/app/profile" replace />} />
            <Route path="/settings" element={<Navigate to="/app/settings" replace />} />
            <Route path="/billing" element={<Navigate to="/app/billing" replace />} />
            <Route path="/notifications" element={<Navigate to="/app/notifications" replace />} />
            <Route path="/admin" element={<Navigate to="/app/admin" replace />} />
            <Route path="/team" element={<Navigate to="/app/team" replace />} />
            <Route
              path="/niche-discovery"
              element={<Navigate to="/app/niche-discovery" replace />}
            />
            <Route path="/workflow" element={<Navigate to="/app/workflow" replace />} />
            <Route path="/dashboard" element={<Navigate to="/app" replace />} />

            {/* Catch-all */}
            <Route path="*" element={<PublicLayout />}>
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </React.Suspense>
      )}
    </div>
  );
}
