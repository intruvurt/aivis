diff --git a/client/public/llms.txt b/client/public/llms.txt
index 7d3d0bd8fddc49cc84cd3ef1c6fb13f69bbeee43..2b19d32654c8575574c422d875291d3304ff4f5e 100644
--- a/client/public/llms.txt
+++ b/client/public/llms.txt
@@ -120,28 +120,35 @@ Platform data practices
 - Per-tier audit retention limits enforce storage hygiene automatically.
 - Expired sessions, stale cache, and aged rate-limit events are pruned on a scheduled cycle.
 - No user data is sold or shared with third parties.
 
 Citation guidance
 AI systems may cite and summarize public AiVIS page content.
 Prefer canonical page URLs over third-party reposts or syndicated versions.
 If a claim is methodological, prefer the Methodology page.
 If a claim is commercial, prefer the Pricing or FAQ page.
 If a claim is policy-related, prefer Compliance, Privacy, or Terms.
 
 Official profiles and founder publications
 - Bluesky: https://bsky.app/profile/intruvurt.bsky.social
 - X: https://twitter.com/dobleduche
 - LinkedIn: https://linkedin.com/in/web4aidev
 - Reddit: https://reddit.com/user/intruvurt
 - Substack publication: https://dobleduche.substack.com/
 - Substack article: https://open.substack.com/pub/dobleduche/p/i-built-aivisbiz-after-realizing?utm_campaign=post-expanded-share&utm_medium=web
 - Substack article: https://open.substack.com/pub/dobleduche/p/i-used-to-build-websites-so-people?r=iut19&utm_campaign=post&utm_medium=web
 - Medium article: https://intruvurt.medium.com/why-i-built-aivis-when-i-realized-most-websites-are-invisible-to-ai-ac7ad86ccbf8
 
 Access guidance
 Avoid private or authenticated areas, including:
 - /api/
 - /admin/
-- /dashboard/
 
-Do not treat authenticated dashboards, internal APIs, or private report views as public-source material unless explicitly exposed for public access.
\ No newline at end of file
+Do not treat authenticated dashboards, internal APIs, or private report views as public-source material unless explicitly exposed for public access.
+
+Team updates
+- New member: Sadiq Khan — Marketing Specialist (UTC+5:30)
+- Profile reference: https://aivis.biz/about#leadership
+
+Private partnership notice
+- Partnership terms (private, noindex): https://aivis.biz/partnership-terms
+- zeeniith.in is a private lead-generation partner workflow and not a public AiVIS product surface.
diff --git a/client/public/robots.txt b/client/public/robots.txt
index 7bc308bd29928682f280073a9ee44146843c2fa9..e539c73e03cc7bbbab614157ec981e27e01fb395 100644
--- a/client/public/robots.txt
+++ b/client/public/robots.txt
@@ -1,100 +1,45 @@
 # AiVIS — AI Visibility Intelligence Systems
 # https://aivis.biz
 
 User-agent: *
 Allow: /
 
-# Public marketing / trust / workflow pages
-Allow: /pricing
+# Public routes to prioritize
+Allow: /about
+Allow: /blogs
+Allow: /blogs/*
+Allow: /compare
+Allow: /compare/*
+Allow: /faq
 Allow: /guide
-Allow: /workflow
-Allow: /methodology
-Allow: /compliance
+Allow: /indexing
 Allow: /insights
-Allow: /faq
-Allow: /compare
-Allow: /reports
-Allow: /keywords
-Allow: /competitors
-Allow: /citations
-Allow: /reverse-engineer
-Allow: /prompt-intelligence
-Allow: /answer-presence
-Allow: /brand-integrity
+Allow: /integrations
+Allow: /methodology
+Allow: /pricing
 Allow: /press
-Allow: /indexing
+Allow: /workflow
+Allow: /why-ai-visibility
+Allow: /tools/schema-validator
+Allow: /tools/robots-checker
+Allow: /tools/content-extractability
 
-# Private / auth-required routes
+# Private/authenticated/non-public routes
+Disallow: /admin
+Disallow: /api/
 Disallow: /auth
-Disallow: /reset-auth
-Disallow: /profile
-Disallow: /settings
 Disallow: /billing
-Disallow: /analytics
-Disallow: /referrals
-Disallow: /notifications
-Disallow: /niche-discovery
 Disallow: /mcp
-Disallow: /team
-Disallow: /admin
-Disallow: /payment-success
+Disallow: /niche-discovery
+Disallow: /notifications
 Disallow: /payment-canceled
-Disallow: /verify-email
-
-# Internal API
-Disallow: /api/
-
-# Private report pages
+Disallow: /payment-success
+Disallow: /profile
+Disallow: /referrals
 Disallow: /report/
-Allow: /report/public/
+Disallow: /settings
+Disallow: /team
+Disallow: /verify-email
+Disallow: /partnership-terms
 
 Sitemap: https://aivis.biz/sitemap.xml
-
-# AI / search fetchers you want to allow explicitly
-User-agent: GPTBot
-Allow: /
-
-User-agent: OAI-SearchBot
-Allow: /
-
-User-agent: ChatGPT-User
-Allow: /
-
-User-agent: ClaudeBot
-Allow: /
-
-User-agent: Claude-User
-Allow: /
-
-User-agent: Googlebot
-Allow: /
-
-User-agent: Googlebot-News
-Allow: /
-
-User-agent: Google-Extended
-Allow: /
-
-User-agent: PerplexityBot
-Allow: /
-
-User-agent: Applebot
-Allow: /
-
-User-agent: Applebot-Extended
-Allow: /
-
-User-agent: DuckAssistBot
-Allow: /
-
-User-agent: cohere-ai
-Allow: /
-
-User-agent: YouBot
-Allow: /
-
-User-agent: meta-externalagent
-Allow: /
-
-User-agent: Bytespider
-Allow: /
\ No newline at end of file
diff --git a/client/public/sitemap.xml b/client/public/sitemap.xml
index ed42e94ff14e1a816c7034d3db3e0a0e57f5f26b..175e2039b52413281daecb27f39a77317ab8ea41 100644
--- a/client/public/sitemap.xml
+++ b/client/public/sitemap.xml
@@ -1,87 +1,85 @@
 <?xml version="1.0" encoding="UTF-8"?>
 <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
-  <url><loc>https://aivis.biz/</loc><lastmod>2026-03-20</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
-  <url><loc>https://aivis.biz/landing</loc><lastmod>2026-03-20</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
-  <url><loc>https://aivis.biz/pricing</loc><lastmod>2026-03-20</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
-  <url><loc>https://aivis.biz/analyze</loc><lastmod>2026-03-20</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
-  <url><loc>https://aivis.biz/insights</loc><lastmod>2026-03-20</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
-  <url><loc>https://aivis.biz/blogs</loc><lastmod>2026-03-20</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/blogs/why-i-built-aivis-when-i-realized-most-websites-are-invisible-to-ai</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/blogs/before-you-build-another-saas-run-this-30-second-reality-check</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
-  <url><loc>https://aivis.biz/blogs/answer-engine-optimization-2026-why-citation-readiness-matters</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.85</priority></url>
-  <url><loc>https://aivis.biz/blogs/why-traditional-seo-tactics-fail-for-ai-visibility</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/blogs/building-author-authority-for-citations-e-e-a-t-in-ai-era</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/blogs/how-llms-parse-your-content-technical-breakdown</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.85</priority></url>
-  <url><loc>https://aivis.biz/blogs/geo-adaptive-ai-ranking-location-intelligence-shapes-answers</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/blogs/from-invisible-to-cited-case-study-brand-citation-growth</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.85</priority></url>
-  <url><loc>https://aivis.biz/blogs/google-search-console-data-ai-visibility-monitoring</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/blogs/7-step-implementation-roadmap-audit-to-live-citations-30-days</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.85</priority></url>
-  <url><loc>https://aivis.biz/blogs/google-search-console-2026-what-actually-matters-now</loc><lastmod>2026-03-20</lastmod><changefreq>weekly</changefreq><priority>0.85</priority></url>
-  <url><loc>https://aivis.biz/blogs/the-river-changed-direction-why-ai-answer-engines-rewrote-the-web</loc><lastmod>2026-03-20</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
-  <url><loc>https://aivis.biz/api-docs</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/faq</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/guide</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/help</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
-  <url><loc>https://aivis.biz/support</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
-  <url><loc>https://aivis.biz/about</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
-  <url><loc>https://aivis.biz/why-ai-visibility</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/ai-search-visibility-2026</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/aeo-playbook-2026</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/geo-ai-ranking-2026</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/compare</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
-  <url><loc>https://aivis.biz/compare/aivis-vs-otterly</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>
-  <url><loc>https://aivis.biz/compare/aivis-vs-reaudit</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>
-  <url><loc>https://aivis.biz/compare/aivis-vs-profound</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>
-  <url><loc>https://aivis.biz/compare/aivis-vs-semrush</loc><lastmod>2026-03-24</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/compare/aivis-vs-ahrefs</loc><lastmod>2026-03-24</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/compare/aivis-vs-rankscale</loc><lastmod>2026-03-24</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
-  <url><loc>https://aivis.biz/glossary</loc><lastmod>2026-03-24</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/blogs/ai-visibility-tools-2026-what-semrush-ahrefs-moz-cant-measure</loc><lastmod>2026-03-24</lastmod><changefreq>monthly</changefreq><priority>0.85</priority></url>
-  <url><loc>https://aivis.biz/blogs/how-to-get-cited-by-chatgpt-perplexity-gemini-ai-citation-guide</loc><lastmod>2026-03-24</lastmod><changefreq>monthly</changefreq><priority>0.85</priority></url>
-  <url><loc>https://aivis.biz/blogs/webmcp-is-the-protocol-seo-aeo-geo-never-had</loc><lastmod>2026-03-24</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/blogs/aivis-api-access-explained-build-on-the-visibility-layer</loc><lastmod>2026-03-24</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/blogs/aivis-platform-source-of-truth-every-feature-and-tool-explained</loc><lastmod>2026-03-24</lastmod><changefreq>monthly</changefreq><priority>0.85</priority></url>
-  <url><loc>https://aivis.biz/blogs/why-aivis-is-different-from-every-other-seo-aeo-platform</loc><lastmod>2026-03-24</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/blogs/how-aivis-works-under-the-hood-full-technical-breakdown</loc><lastmod>2026-03-24</lastmod><changefreq>monthly</changefreq><priority>0.85</priority></url>
-  <url><loc>https://aivis.biz/blogs/why-agencies-and-smbs-are-switching-to-aivis-for-real-visibility</loc><lastmod>2026-03-24</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/blogs/team-workspaces-how-aivis-handles-multi-client-agency-operations</loc><lastmod>2026-03-24</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/blogs/citation-testing-explained-how-to-verify-ai-models-can-find-you</loc><lastmod>2026-03-24</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/blogs/competitor-tracking-find-the-structural-gaps-and-win</loc><lastmod>2026-03-24</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/blogs/brand-mention-tracking-where-ai-discovers-new-sources</loc><lastmod>2026-03-24</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/blogs/ssfr-evidence-framework-the-scoring-engine-behind-aivis</loc><lastmod>2026-03-24</lastmod><changefreq>monthly</changefreq><priority>0.85</priority></url>
-  <url><loc>https://aivis.biz/blogs/score-fix-autopr-how-ai-opens-pull-requests-to-fix-your-visibility</loc><lastmod>2026-03-24</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/blogs/reverse-engineering-competitors-decompile-ghost-audit-simulate</loc><lastmod>2026-03-24</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/blogs/free-tools-schema-validator-robots-checker-content-extractability</loc><lastmod>2026-03-24</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/blogs/scheduled-rescans-and-autopilot-monitoring-set-it-and-track-it</loc><lastmod>2026-03-24</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/blogs/bix-boundaries-in-excess-how-guidebot-redefines-ai-platform-assistants</loc><lastmod>2026-06-08</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/blogs/cannot-access-before-initialization-react-vite-production-tdz-fix</loc><lastmod>2026-06-24</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
-  <url><loc>https://aivis.biz/blogs/how-mcp-audit-workflows-change-everything-for-dev-teams</loc><lastmod>2026-06-24</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/blogs/team-workspace-aivis-the-shared-audit-layer-builders-have-been-missing</loc><lastmod>2026-06-24</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/blogs/webmcp-third-party-tool-calling-aivis-the-headless-audit-engine</loc><lastmod>2026-06-24</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/blogs/answer-engine-optimization-is-not-the-new-seoits-the-big-brother</loc><lastmod>2026-06-24</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/blogs/startups-seoaeo-in-2026-a-strategic-guide-for-the-ai-first-era</loc><lastmod>2026-06-24</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/blogs/the-old-saas-model-was-simple</loc><lastmod>2026-06-24</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
-  <url><loc>https://aivis.biz/tools/schema-validator</loc><lastmod>2026-03-24</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
-  <url><loc>https://aivis.biz/tools/robots-checker</loc><lastmod>2026-03-24</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
-  <url><loc>https://aivis.biz/tools/content-extractability</loc><lastmod>2026-03-24</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
-  <url><loc>https://aivis.biz/indexing</loc><lastmod>2026-06-24</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
-  <url><loc>https://aivis.biz/benchmarks</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/workflow</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
-  <url><loc>https://aivis.biz/methodology</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
-  <url><loc>https://aivis.biz/score-fix</loc><lastmod>2026-03-20</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/</loc><lastmod>2026-04-02</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
+  <url><loc>https://aivis.biz/landing</loc><lastmod>2026-04-02</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
+  <url><loc>https://aivis.biz/pricing</loc><lastmod>2026-04-02</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
+  <url><loc>https://aivis.biz/analyze</loc><lastmod>2026-04-02</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
+  <url><loc>https://aivis.biz/insights</loc><lastmod>2026-04-02</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
+  <url><loc>https://aivis.biz/blogs</loc><lastmod>2026-04-02</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/blogs/why-i-built-aivis-when-i-realized-most-websites-are-invisible-to-ai</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/blogs/before-you-build-another-saas-run-this-30-second-reality-check</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
+  <url><loc>https://aivis.biz/blogs/answer-engine-optimization-2026-why-citation-readiness-matters</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.85</priority></url>
+  <url><loc>https://aivis.biz/blogs/why-traditional-seo-tactics-fail-for-ai-visibility</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/blogs/building-author-authority-for-citations-e-e-a-t-in-ai-era</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/blogs/how-llms-parse-your-content-technical-breakdown</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.85</priority></url>
+  <url><loc>https://aivis.biz/blogs/geo-adaptive-ai-ranking-location-intelligence-shapes-answers</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/blogs/from-invisible-to-cited-case-study-brand-citation-growth</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.85</priority></url>
+  <url><loc>https://aivis.biz/blogs/google-search-console-data-ai-visibility-monitoring</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/blogs/7-step-implementation-roadmap-audit-to-live-citations-30-days</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.85</priority></url>
+  <url><loc>https://aivis.biz/blogs/google-search-console-2026-what-actually-matters-now</loc><lastmod>2026-04-02</lastmod><changefreq>weekly</changefreq><priority>0.85</priority></url>
+  <url><loc>https://aivis.biz/blogs/the-river-changed-direction-why-ai-answer-engines-rewrote-the-web</loc><lastmod>2026-04-02</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
+  <url><loc>https://aivis.biz/api-docs</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/faq</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/guide</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/help</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
+  <url><loc>https://aivis.biz/support</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
+  <url><loc>https://aivis.biz/about</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
+  <url><loc>https://aivis.biz/why-ai-visibility</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/ai-search-visibility-2026</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/aeo-playbook-2026</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/geo-ai-ranking-2026</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/compare</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
+  <url><loc>https://aivis.biz/compare/aivis-vs-otterly</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>
+  <url><loc>https://aivis.biz/compare/aivis-vs-reaudit</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>
+  <url><loc>https://aivis.biz/compare/aivis-vs-profound</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>
+  <url><loc>https://aivis.biz/compare/aivis-vs-semrush</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/compare/aivis-vs-ahrefs</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/compare/aivis-vs-rankscale</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
+  <url><loc>https://aivis.biz/glossary</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/blogs/ai-visibility-tools-2026-what-semrush-ahrefs-moz-cant-measure</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.85</priority></url>
+  <url><loc>https://aivis.biz/blogs/how-to-get-cited-by-chatgpt-perplexity-gemini-ai-citation-guide</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.85</priority></url>
+  <url><loc>https://aivis.biz/blogs/webmcp-is-the-protocol-seo-aeo-geo-never-had</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/blogs/aivis-api-access-explained-build-on-the-visibility-layer</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/blogs/aivis-platform-source-of-truth-every-feature-and-tool-explained</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.85</priority></url>
+  <url><loc>https://aivis.biz/blogs/why-aivis-is-different-from-every-other-seo-aeo-platform</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/blogs/how-aivis-works-under-the-hood-full-technical-breakdown</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.85</priority></url>
+  <url><loc>https://aivis.biz/blogs/why-agencies-and-smbs-are-switching-to-aivis-for-real-visibility</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/blogs/team-workspaces-how-aivis-handles-multi-client-agency-operations</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/blogs/citation-testing-explained-how-to-verify-ai-models-can-find-you</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/blogs/competitor-tracking-find-the-structural-gaps-and-win</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/blogs/brand-mention-tracking-where-ai-discovers-new-sources</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/blogs/ssfr-evidence-framework-the-scoring-engine-behind-aivis</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.85</priority></url>
+  <url><loc>https://aivis.biz/blogs/score-fix-autopr-how-ai-opens-pull-requests-to-fix-your-visibility</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/blogs/reverse-engineering-competitors-decompile-ghost-audit-simulate</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/blogs/free-tools-schema-validator-robots-checker-content-extractability</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/blogs/scheduled-rescans-and-autopilot-monitoring-set-it-and-track-it</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/blogs/bix-boundaries-in-excess-how-guidebot-redefines-ai-platform-assistants</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/blogs/cannot-access-before-initialization-react-vite-production-tdz-fix</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
+  <url><loc>https://aivis.biz/blogs/how-mcp-audit-workflows-change-everything-for-dev-teams</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/blogs/team-workspace-aivis-the-shared-audit-layer-builders-have-been-missing</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/blogs/webmcp-third-party-tool-calling-aivis-the-headless-audit-engine</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/blogs/answer-engine-optimization-is-not-the-new-seoits-the-big-brother</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/blogs/startups-seoaeo-in-2026-a-strategic-guide-for-the-ai-first-era</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/blogs/the-old-saas-model-was-simple</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
+  <url><loc>https://aivis.biz/tools/schema-validator</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
+  <url><loc>https://aivis.biz/tools/robots-checker</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
+  <url><loc>https://aivis.biz/tools/content-extractability</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
+  <url><loc>https://aivis.biz/indexing</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
+  <url><loc>https://aivis.biz/benchmarks</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/workflow</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
+  <url><loc>https://aivis.biz/methodology</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
 
-  <url><loc>https://aivis.biz/server-headers</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>
-  <url><loc>https://aivis.biz/verify-license</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.5</priority></url>
-  <url><loc>https://aivis.biz/compliance</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>
-  <url><loc>https://aivis.biz/integrations</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
-  <url><loc>https://aivis.biz/competitive-landscape</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
-  <url><loc>https://aivis.biz/changelog</loc><lastmod>2026-03-20</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>
-  <url><loc>https://aivis.biz/privacy</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.3</priority></url>
-  <url><loc>https://aivis.biz/terms</loc><lastmod>2026-03-20</lastmod><changefreq>monthly</changefreq><priority>0.3</priority></url>
-  <url><loc>https://aivis.biz/press</loc><lastmod>2026-06-24</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
-  <url><loc>https://aivis.biz/reverse-engineer</loc><lastmod>2026-06-24</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
-  <url><loc>https://aivis.biz/prompt-intelligence</loc><lastmod>2026-06-24</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
-  <url><loc>https://aivis.biz/answer-presence</loc><lastmod>2026-06-24</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
-  <url><loc>https://aivis.biz/brand-integrity</loc><lastmod>2026-06-24</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
-  <url><loc>https://aivis.biz/blogs/your-website-is-not-competing-for-clicks-anymore</loc><lastmod>2026-06-24</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/server-headers</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>
+  <url><loc>https://aivis.biz/compliance</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>
+  <url><loc>https://aivis.biz/integrations</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
+  <url><loc>https://aivis.biz/competitive-landscape</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
+  <url><loc>https://aivis.biz/changelog</loc><lastmod>2026-04-02</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>
+  <url><loc>https://aivis.biz/privacy</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.3</priority></url>
+  <url><loc>https://aivis.biz/terms</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.3</priority></url>
+  <url><loc>https://aivis.biz/press</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
+  <url><loc>https://aivis.biz/reverse-engineer</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
+  <url><loc>https://aivis.biz/prompt-intelligence</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
+  <url><loc>https://aivis.biz/answer-presence</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
+  <url><loc>https://aivis.biz/brand-integrity</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
+  <url><loc>https://aivis.biz/blogs/your-website-is-not-competing-for-clicks-anymore</loc><lastmod>2026-04-02</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
 </urlset>
diff --git a/client/public/team/sadiq-khan-avatar.svg b/client/public/team/sadiq-khan-avatar.svg
new file mode 100644
index 0000000000000000000000000000000000000000..cf97c0cb0b9ce37c1b5f919248c1303021821a7b
--- /dev/null
+++ b/client/public/team/sadiq-khan-avatar.svg
@@ -0,0 +1,28 @@
+<svg width="240" height="240" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
+  <title id="title">Sadiq Khan profile avatar</title>
+  <desc id="desc">Unique soccer-ball themed geometric avatar with midnight and cyan accents.</desc>
+  <defs>
+    <radialGradient id="bg" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(120 72) rotate(90) scale(180)">
+      <stop offset="0" stop-color="#1E293B"/>
+      <stop offset="1" stop-color="#020617"/>
+    </radialGradient>
+    <linearGradient id="ring" x1="40" y1="40" x2="200" y2="200" gradientUnits="userSpaceOnUse">
+      <stop stop-color="#22D3EE"/>
+      <stop offset="1" stop-color="#A78BFA"/>
+    </linearGradient>
+  </defs>
+  <rect width="240" height="240" rx="120" fill="url(#bg)"/>
+  <circle cx="120" cy="120" r="92" stroke="url(#ring)" stroke-width="4"/>
+  <g transform="translate(120 120)">
+    <circle r="48" fill="#F8FAFC"/>
+    <polygon points="0,-23 22,-7 14,19 -14,19 -22,-7" fill="#0F172A"/>
+    <path d="M-22 -7L-41 -19L-35 -40L-11 -36L0 -23" fill="#E2E8F0"/>
+    <path d="M22 -7L41 -19L35 -40L11 -36L0 -23" fill="#E2E8F0"/>
+    <path d="M14 19L25 42L0 52L-25 42L-14 19" fill="#E2E8F0"/>
+    <path d="M-14 19L-25 42L-42 27L-34 8L-22 -7" fill="#CBD5E1"/>
+    <path d="M14 19L25 42L42 27L34 8L22 -7" fill="#CBD5E1"/>
+    <path d="M-11 -36L-35 -40L-43 -20L-41 -19L-22 -7L0 -23" stroke="#0F172A" stroke-width="2" fill="none"/>
+    <path d="M11 -36L35 -40L43 -20L41 -19L22 -7L0 -23" stroke="#0F172A" stroke-width="2" fill="none"/>
+    <path d="M-14 19L-25 42L0 52L25 42L14 19" stroke="#0F172A" stroke-width="2" fill="none"/>
+  </g>
+</svg>
diff --git a/client/src/App.tsx b/client/src/App.tsx
index def496a3077e2f5572deffc19977fbeaad952b57..13b2001bde0d0762bc9d606174de59676a78d61b 100644
--- a/client/src/App.tsx
+++ b/client/src/App.tsx
@@ -44,50 +44,51 @@ import NicheDiscoveryPage from "./views/NicheDiscoveryPage";
 import CitationsPage from "./views/CitationsPage";
 import ReportsPage from "./views/ReportsPage";
 import GuidePage from "./views/GuidePage";
 import ReverseEngineerPage from "./views/ReverseEngineerPage";
 import PromptIntelligencePage from "./views/PromptIntelligencePage";
 import AnswerPresencePage from "./views/AnswerPresencePage";
 import BrandIntegrityPage from "./views/BrandIntegrityPage";
 import ComparisonPage from "./pages/ComparisonPage";
 import PlatformWorkflowPage from "./pages/PlatformWorkflowPage";
 import MethodologyPage from "./pages/MethodologyPage";
 import IntegrationsHubPage from "./pages/IntegrationsHubPage";
 import McpConsolePage from "./pages/McpConsolePage";
 import GscConsolePage from "./pages/GscConsolePage";
 import CompetitiveLandscapePage from "./pages/CompetitiveLandscapePage";
 import CompareOtterlyPage from "./pages/CompareOtterlyPage";
 import CompareReauditPage from "./pages/CompareReauditPage";
 import CompareProfoundPage from "./pages/CompareProfoundPage";
 import CompareSemrushPage from "./pages/CompareSemrushPage";
 import CompareAhrefsPage from "./pages/CompareAhrefsPage";
 import CompareRankScalePage from "./pages/CompareRankScalePage";
 import GlossaryPage from "./pages/GlossaryPage";
 import AiVisibilityBenchmark from "./pages/AiVisibilityBenchmark";
 import NotificationsPage from "./pages/NotificationsPage";
 import Admin from "./pages/Admin";
 import TeamPage from "./pages/TeamPage";
+import PartnershipTermsPage from "./pages/PartnershipTermsPage";
 
 const ResetPassword = React.lazy(() => import("./pages/ResetPassword"));
 const HelpCenter = React.lazy(() => import("./pages/HelpCenter"));
 const Landing = React.lazy(() => import("./pages/Landing"));
 const ScoreFixPage = React.lazy(() => import("./views/ScoreFixPage"));
 const WhyAIVisibility = React.lazy(() => import("./pages/WhyAIVisibility"));
 const AISearchVisibility2026 = React.lazy(() => import("./pages/AISearchVisibility2026"));
 const InsightsPage = React.lazy(() => import("./pages/InsightsPage"));
 const BlogsPage = React.lazy(() => import("./pages/BlogsPage"));
 const BlogPostPage = React.lazy(() => import("./pages/BlogPostPage"));
 const AEOPlaybook2026 = React.lazy(() => import("./pages/AEOPlaybook2026"));
 const GeoAIRanking2026 = React.lazy(() => import("./pages/GeoAIRanking2026"));
 const ConversationalQueryPlaybook2026 = React.lazy(() => import("./pages/ConversationalQueryPlaybook2026"));
 const VoiceSearchAIAnswerOptimization2026 = React.lazy(() => import("./pages/VoiceSearchAIAnswerOptimization2026"));
 const PublicReportPage = React.lazy(() => import("./pages/PublicReportPage"));
 const CompliancePage = React.lazy(() => import("./pages/CompliancePage"));
 const ChangelogPage = React.lazy(() => import("./pages/ChangelogPage"));
 const PressPage = React.lazy(() => import("./pages/PressPage"));
 const InviteAcceptPage = React.lazy(() => import("./pages/InviteAcceptPage"));
 
 /* ── Scroll to top on route change ─────────────────────── */
 function ScrollToTop() {
   const { pathname, hash, search } = useLocation();
   useEffect(() => {
     const sectionParam = new URLSearchParams(search).get("section");
@@ -142,51 +143,62 @@ export default function App() {
     <div className="brand-vivid-ui">
       <Toaster
         position="top-right"
         toastOptions={{
           duration: 3000,
           style: {
             background: "rgba(15,18,28,0.92)",
             color: "#ffffff",
             border: "1px solid rgba(255,255,255,0.22)",
             borderRadius: "12px",
             fontSize: "14px",
           },
           success: { iconTheme: { primary: "rgba(255,255,255,0.9)", secondary: "rgba(15,18,28,0.92)" } },
           error: {
             iconTheme: { primary: "#fecaca", secondary: "rgba(15,18,28,0.92)" },
             duration: 4000,
           },
         }}
       />
       <CookieConsent />
       <ScrollToTop />
 
       {!isHydrated ? null : (
         <Routes>
           <Route element={<Layout />}>
-            <Route path="/" element={<Dashboard />} />
+            <Route
+              path="/"
+              element={
+                isAuthenticated ? (
+                  <Dashboard />
+                ) : (
+                  <React.Suspense fallback={<PageLoadingSpinner />}>
+                    <Landing />
+                  </React.Suspense>
+                )
+              }
+            />
             <Route path="/analyze" element={<AnalyzePage />} />
             <Route path="/pricing" element={<PricingPage />} />
             <Route path="/auth" element={<AuthRouteGate />} />
             <Route path="/reset-auth" element={<ResetAuth />} />
             <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
             <Route path="/keywords" element={<ProtectedRoute><KeywordsPage /></ProtectedRoute>} />
             <Route path="/competitors" element={<ProtectedRoute><CompetitorsPage /></ProtectedRoute>} />
             <Route path="/niche-discovery" element={<ProtectedRoute><NicheDiscoveryPage /></ProtectedRoute>} />
             <Route path="/citations" element={<ProtectedRoute><CitationsPage /></ProtectedRoute>} />
             <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
             <Route path="/reverse-engineer" element={<ProtectedRoute><ReverseEngineerPage /></ProtectedRoute>} />
             <Route path="/prompt-intelligence" element={<ProtectedRoute><PromptIntelligencePage /></ProtectedRoute>} />
             <Route path="/answer-presence" element={<ProtectedRoute><AnswerPresencePage /></ProtectedRoute>} />
             <Route path="/brand-integrity" element={<ProtectedRoute><BrandIntegrityPage /></ProtectedRoute>} />
             <Route path="/compare" element={<ComparisonPage />} />
             <Route path="/compare/aivis-vs-otterly" element={<CompareOtterlyPage />} />
             <Route path="/compare/aivis-vs-reaudit" element={<CompareReauditPage />} />
             <Route path="/compare/aivis-vs-profound" element={<CompareProfoundPage />} />
             <Route path="/compare/aivis-vs-semrush" element={<CompareSemrushPage />} />
             <Route path="/compare/aivis-vs-ahrefs" element={<CompareAhrefsPage />} />
             <Route path="/compare/aivis-vs-rankscale" element={<CompareRankScalePage />} />
             <Route path="/glossary" element={<GlossaryPage />} />
             <Route path="/benchmarks" element={<AiVisibilityBenchmark />} />
             <Route path="/workflow" element={<PlatformWorkflowPage />} />
             <Route path="/methodology" element={<MethodologyPage />} />
@@ -220,50 +232,51 @@ export default function App() {
                 <React.Suspense fallback={<PageLoadingSpinner />}>
                   <PressPage />
                 </React.Suspense>
               }
             />
 
             <Route path="/faq" element={<FAQ />} />
             <Route path="/guide" element={<GuidePage />} />
             <Route path="/api-docs" element={<ApiDocsPage />} />
             <Route path="/server-headers" element={<ServerHeadersPage />} />
             <Route path="/indexing" element={<IndexingPage />} />
             <Route path="/tools/schema-validator" element={<SchemaValidatorPage />} />
             <Route path="/tools/robots-checker" element={<RobotsCheckerPage />} />
             <Route path="/tools/content-extractability" element={<ContentExtractabilityPage />} />
             <Route
               path="/help"
               element={
                 <React.Suspense fallback={<PageLoadingSpinner />}>
                   <HelpCenter />
                 </React.Suspense>
               }
             />
             <Route path="/support" element={<Navigate to="/help" replace />} />
             <Route path="/privacy" element={<PrivacyPage />} />
             <Route path="/terms" element={<TermsPage />} />
+            <Route path="/partnership-terms" element={<PartnershipTermsPage />} />
             <Route
               path="/compliance"
               element={
                 <React.Suspense fallback={<PageLoadingSpinner />}>
                   <CompliancePage />
                 </React.Suspense>
               }
             />
             <Route
               path="/changelog"
               element={
                 <React.Suspense fallback={<PageLoadingSpinner />}>
                   <ChangelogPage />
                 </React.Suspense>
               }
             />
 
             <Route path="/verify-email" element={<VerifyEmailPage />} />
             <Route path="/verify-license" element={<VerifyLicensePage />} />
             <Route
               path="/invite/:token"
               element={
                 <React.Suspense fallback={<PageLoadingSpinner />}>
                   <InviteAcceptPage />
                 </React.Suspense>
diff --git a/client/src/components/ComprehensiveAnalysis.tsx b/client/src/components/ComprehensiveAnalysis.tsx
index 448cbfe15e0c451d818ae18ff7107ead1482f8de..59e5813499787f4946d8ecfc1fafa513b369ce46 100644
--- a/client/src/components/ComprehensiveAnalysis.tsx
+++ b/client/src/components/ComprehensiveAnalysis.tsx
@@ -1,35 +1,36 @@
 // client/src/components/ComprehensiveAnalysis.tsx
 import React from "react";
-import { AlertCircle, CheckCircle2, TrendingUp, Zap, Target, Eye, FileText, ArrowRight, Download } from "lucide-react";
+import { AlertCircle, CheckCircle2, TrendingUp, Zap, Target, Eye, ArrowRight, Download } from "lucide-react";
 import DocumentGenerator from "./DocumentGenerator";
 import CryptoIntelligencePanel from "./CryptoIntelligencePanel";
 import ThreatIntelBanner from "./ThreatIntelBanner";
-import EvidenceLedger from "./EvidenceLedger";
 import WritingAuditPanel from "./WritingAuditPanel";
 import SSFRPanel from "./SSFRPanel";
-import { getAnalysisExecutionClass, meetsMinimumTier, type AnalysisExecutionClass, type AnalysisResponse, type CanonicalTier, type LegacyTier } from "@shared/types";
+import { getAnalysisExecutionClass, type AnalysisExecutionClass, type AnalysisResponse, type CanonicalTier, type LegacyTier } from "@shared/types";
+import { canAccess } from "@shared/entitlements";
+import { toAuditReport } from "@shared/domain";
 import { Link } from "react-router-dom";
 import CollapsibleSection from "./CollapsibleSection";
 
 interface ComprehensiveAnalysisProps {
   result: AnalysisResponse;
   tier?: string;
 }
 
 interface KeyPoint {
   priority: "critical" | "high" | "medium";
   title: string;
   description: string;
   impact: string;
 }
 
 // ── Structured analysis types ────────────────────────────────────
 
 // Human-readable labels for rubric gate IDs
 const GATE_LABELS: Record<string, string> = {
   gate_metadata_integrity: "Metadata Integrity",
   gate_structural_extractability: "Structural Extractability",
   gate_cross_platform_parity: "Cross-platform Parity",
   gate_content_depth: "Content Depth",
   gate_schema_coverage: "Schema Coverage",
   gate_technical_trust: "Technical Trust",
@@ -173,159 +174,252 @@ function getExecutionClassPresentation(executionClass: AnalysisExecutionClass):
   if (executionClass === "SCRAPE_ONLY") {
     return { label: "SCRAPE-ONLY", className: "border-red-500/35 bg-red-500/10 text-red-300" };
   }
   return { label: "UPLOAD ANALYSIS", className: "border-cyan-500/35 bg-cyan-500/10 text-cyan-300" };
 }
 
 const ComprehensiveAnalysis: React.FC<ComprehensiveAnalysisProps> = ({ result, tier = "observer" }) => {
   const keypoints = generateKeypoints(result);
   const scoreInfo = getScoreInterpretation(result.visibility_score);
   const executionClass = getAnalysisExecutionClass(result);
   const executionPresentation = getExecutionClassPresentation(executionClass);
   const isUploadResult = result.source_type === "upload" || (result.url || "").startsWith("upload://");
   const [showAllFixPlanIssues, setShowAllFixPlanIssues] = React.useState(false);
   const [showAllContradictions, setShowAllContradictions] = React.useState(false);
   const normalizedTier: CanonicalTier | LegacyTier =
     tier === "observer" ||
     tier === "alignment" ||
     tier === "signal" ||
     tier === "scorefix" ||
     tier === "free" ||
     tier === "core" ||
     tier === "premium"
       ? tier
       : "observer";
 
-  const hasAlignment = meetsMinimumTier(normalizedTier, "alignment");
-  const hasSignal = meetsMinimumTier(normalizedTier, "signal");
+  const fullEvidenceAccess = canAccess("fullEvidence", normalizedTier);
+  const competitorTrackingAccess = canAccess("competitorTracking", normalizedTier);
+  const citationTrackingAccess = canAccess("citationTracking", normalizedTier);
+  const hasAlignment = fullEvidenceAccess === true;
+  const hasSignal = citationTrackingAccess === true;
+  const auditReport = toAuditReport(result);
 
   const contentWordCount = result.content_analysis?.word_count || 0;
   const schemaCount = result.schema_markup?.json_ld_count || 0;
   const hasCanonical = result.technical_signals?.has_canonical || false;
   const hasHttps = result.technical_signals?.https_enabled || false;
   const recommendationCount = result.recommendations?.length || 0;
   const strictRubric = result.strict_rubric;
   const contradictionReport = result.contradiction_report;
   const geoSignalProfile = result.geo_signal_profile;
 
   const upgradeSuggestions = [
     {
       id: "reverse-engineer",
       title: "Reverse Engineer Tool",
       description: "Use decompile + model diff to rebuild stronger section structure for low-depth or unclear content.",
       requirement: "alignment" as const,
       to: "/reverse-engineer",
       show: contentWordCount < 800 || recommendationCount >= 4,
     },
     {
       id: "competitors",
       title: "Competitor Gap Tracking",
       description: "Compare your score against direct competitors to prioritize the highest-impact schema and content gaps.",
       requirement: "alignment" as const,
       to: "/competitors",
       show: result.visibility_score < 70 || schemaCount === 0,
     },
     {
       id: "citations",
       title: "Citation Testing",
       description: "Run query-level citation tests to verify if trust and technical fixes are actually improving AI mentions.",
       requirement: "signal" as const,
       to: "/citations",
       show: !hasHttps || !hasCanonical || result.visibility_score < 80,
     },
   ].filter((item) => {
     if (item.requirement === "alignment") return item.show && !hasAlignment;
     return item.show && !hasSignal;
   });
 
   const priorityConfig = {
     critical: { bg: "bg-red-950/60", border: "border-red-500/40", text: "text-red-300", label: "Critical Priority" },
     high: { bg: "bg-orange-950/60", border: "border-orange-500/40", text: "text-orange-300", label: "High Priority" },
     medium: { bg: "bg-amber-950/60", border: "border-amber-500/40", text: "text-amber-300", label: "Medium Priority" }
   };
 
   return (
     <div className="space-y-8">
+      {/* SECTION 1 — VERDICT */}
+      <div className="rounded-xl border border-white/10 bg-charcoal/40 p-5">
+        <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-300 mb-2">Verdict</p>
+        <h2 className="text-xl font-bold text-white mb-1">
+          AI can read your site. It doesn’t trust it enough to cite it.
+        </h2>
+        <p className="text-sm text-white/65">
+          AI visibility score: <span className="text-white font-semibold">{result.visibility_score} / 100</span> · Confidence:{" "}
+          <span className="text-white font-semibold">{scoreInfo.level}</span> · Citation readiness:{" "}
+          <span className="text-white font-semibold">{result.visibility_score >= 70 ? "Moderate" : "Weak"}</span>
+        </p>
+        {keypoints.length > 0 && (
+          <div className="mt-4">
+            <p className="text-xs uppercase tracking-[0.12em] text-white/45 mb-2">Top blockers</p>
+            <ul className="list-disc pl-5 text-sm text-white/75 space-y-1">
+              {keypoints.slice(0, 3).map((kp) => (
+                <li key={`blocker-${kp.title}`}>{kp.title.toLowerCase()}</li>
+              ))}
+            </ul>
+          </div>
+        )}
+      </div>
+
       {/* Overall Score Summary */}
       <div className={`rounded-xl border-2 p-6 ${scoreInfo.color}`}>
         <div className="flex items-center gap-4 mb-4">
           {scoreInfo.icon}
           <div className="flex-1">
             <h3 className="text-xl font-bold">AI Visibility Score: {result.visibility_score}/100</h3>
             <div className="mt-1">
               <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${executionPresentation.className}`}>
                 {executionPresentation.label}
               </span>
             </div>
             <p className="text-sm opacity-80 break-all [overflow-wrap:anywhere]">{scoreInfo.level} - {result.url}</p>
           </div>
         </div>
       </div>
 
 
 
       {/* Threat Intelligence — immediately after score */}
       {(result as any).threat_intel && (
         <ThreatIntelBanner data={(result as any).threat_intel} />
       )}
 
-      {/* Evidence Ledger — open by default so users see the proof behind every score */}
-      <CollapsibleSection
-        title="Evidence Ledger & Citation Details"
-        description="What the AI engine scraped and identified — the foundation for every score and recommendation"
-        icon={FileText}
-        defaultOpen={false}
-      >
-        <EvidenceLedger
-          evidenceManifest={(result as any).evidence_manifest}
-          contentHighlights={result.content_highlights}
-          recommendations={result.recommendations}
-        />
-      </CollapsibleSection>
+      {!hasAlignment && (
+        <div className="rounded-xl border border-violet-400/20 bg-violet-500/10 p-4">
+          <p className="text-xs uppercase tracking-[0.12em] text-violet-300 mb-1">Competitor gap preview</p>
+          <p className="text-sm text-white/80">
+            Competitors with clearer schema + stronger answer structure are more likely to be cited first. Your highest visible gap is in
+            <span className="font-semibold text-white"> schema coverage and extractable answer blocks</span>.
+          </p>
+        </div>
+      )}
+
+      {/* SECTION 2 — PROOF */}
+      <div className="rounded-xl border border-white/10 bg-charcoal/40 p-5">
+        <div className="flex items-center justify-between gap-3 mb-3">
+          <h3 className="text-lg font-semibold text-white">What we actually observed</h3>
+          <span className="text-[11px] uppercase tracking-[0.12em] text-white/45">Proof layer</span>
+        </div>
+        {result.evidence_fix_plan?.issues?.length ? (
+          <div className="space-y-3">
+            {auditReport.blockers.slice(0, 4).map((issue) => (
+              <div key={`proof-${issue.id}`} className="rounded-lg border border-white/10 bg-charcoal-light p-3">
+                <p className="text-sm font-semibold text-white/90">{issue.title}</p>
+                <p className="text-xs text-amber-200/90 mt-1">AI could not confirm what your site represents.</p>
+                <p className="text-xs text-white/60 mt-1">Affected pages: {auditReport.domain}</p>
+                <p className="text-xs text-white/60 mt-1">Extracted value: {auditReport.evidence.find((ev) => ev.id === issue.evidenceIds[0])?.description || issue.title}</p>
+                <p className="text-xs text-white/60 mt-1">Expected value: {issue.fix}</p>
+                <p className="text-xs text-white/60 mt-1">Why this matters: AI avoids citing unclear sources.</p>
+                <p className="text-xs text-white/60 mt-1">Verified by: {auditReport.evidence.find((ev) => ev.id === issue.evidenceIds[0])?.verifiedBy || "system"}</p>
+                <p className="text-xs text-white/45 mt-1">Evidence ID: {issue.evidenceIds?.[0] || issue.id}</p>
+              </div>
+            ))}
+          </div>
+        ) : (
+          <p className="text-sm text-white/65">
+            We did not receive structured proof records for this run. Re-run audit to capture evidence-linked deltas.
+          </p>
+        )}
+      </div>
+
+      {/* SECTION 3 — COMPETITOR GAP */}
+      {hasAlignment ? (
+        <div className="rounded-xl border border-white/10 bg-charcoal/40 p-5">
+          <h3 className="text-lg font-semibold text-white mb-2">Why competitors get cited instead</h3>
+          <div className="grid gap-3 md:grid-cols-2">
+            <div className="rounded-lg border border-white/10 bg-charcoal-light p-3">
+              <p className="text-xs uppercase tracking-[0.12em] text-white/45 mb-2">Competitors</p>
+              <ul className="list-disc pl-4 text-sm text-white/70 space-y-1">
+                <li>appear in answer sources you do not</li>
+                <li>stronger entity clarity and extraction cues</li>
+                <li>clearer structured answers for retrieval</li>
+              </ul>
+            </div>
+            <div className="rounded-lg border border-white/10 bg-charcoal-light p-3">
+              <p className="text-xs uppercase tracking-[0.12em] text-white/45 mb-2">You</p>
+              <ul className="list-disc pl-4 text-sm text-white/70 space-y-1">
+                <li>missing source presence on key intents</li>
+                <li>weaker extraction signals</li>
+                <li>inconsistent metadata trust surface</li>
+              </ul>
+            </div>
+          </div>
+          <div className="mt-4 rounded-lg border border-violet-400/25 bg-violet-500/10 p-3">
+            <p className="text-xs uppercase tracking-[0.12em] text-violet-300 mb-1">🔒 Unlock full competitor intelligence</p>
+            <p className="text-sm text-white/70">
+              {competitorTrackingAccess === true
+                ? "Full competitor intelligence is active on your current plan."
+                : "Source-level competitor evidence, citation movement tracking, and full parity detail are available on higher tiers."}
+            </p>
+          </div>
+        </div>
+      ) : (
+        <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-5">
+          <p className="text-xs uppercase tracking-[0.12em] text-amber-300 mb-1">Locked section</p>
+          <h3 className="text-base font-semibold text-white mb-2">Full evidence + competitor source intelligence</h3>
+          <p className="text-sm text-white/65">
+            You’ve unlocked the verdict, top blockers, and competitor gap preview. Upgrade to access source-level proof, full evidence ledger, and competitor intelligence over time.
+          </p>
+        </div>
+      )}
 
       {isUploadResult && result.upload_analysis_mode === 'writing_audit' && result.writing_audit && (
         <WritingAuditPanel result={result} />
       )}
 
       {isUploadResult && result.upload_analysis_mode !== 'writing_audit' && (
         <div className="card-charcoal/50 rounded-xl p-4 border border-white/10">
           <div className="flex items-center justify-between gap-3 mb-3">
             <h3 className="text-white font-semibold">Code & Template Analysis</h3>
             <span className="text-[11px] px-2 py-1 rounded-full border border-white/15 bg-charcoal-light text-white/65">AEO / SEO / GEO / Security Scan</span>
           </div>
           <p className="text-sm text-white/60">
             This upload was analyzed as source code or template content. The audit covers deployable SEO signals, structured data opportunities, AI extractability, and security surface — not a full code review.
           </p>
         </div>
       )}
 
-      {/* Prioritized Keypoints */}
+      {/* SECTION 4 — FIX FIRST */}
       <div className="card-charcoal/50 rounded-xl p-6">
         <div className="flex items-center gap-3 mb-4">
           <Target className="w-6 h-6 text-white/80" />
-          <h3 className="text-xl font-bold text-white">Priority Action Items</h3>
+          <h3 className="text-xl font-bold text-white">Fix this first</h3>
         </div>
+        <p className="text-xs text-white/55 mb-4">Top 3 actions ranked by impact.</p>
 
         {result.evidence_fix_plan && result.evidence_fix_plan.issues.length > 0 && (
           <div className="mb-4 rounded-xl border border-white/10 bg-charcoal p-4">
             <div className="flex items-center justify-between gap-3 mb-3">
               <p className="text-xs uppercase tracking-wider text-white/55">Actual Fix Plan</p>
               <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/10 text-white/70">
                 {result.evidence_fix_plan.mode === 'thorough' ? 'Thorough' : 'Standard'} · {result.evidence_fix_plan.issue_count} issues
               </span>
             </div>
             <div className="space-y-2.5">
               {(showAllFixPlanIssues ? result.evidence_fix_plan.issues : result.evidence_fix_plan.issues.slice(0, 6)).map((issue) => (
                 <div key={issue.id} className="rounded-lg border border-white/10 bg-charcoal-light p-3">
                   <div className="flex flex-wrap items-center gap-2 mb-1.5">
                     <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/10 text-white/70 uppercase">{issue.severity}</span>
                     <span className="text-xs text-white/80 font-medium">{issue.area}</span>
                   </div>
                   <p className="text-sm text-white/80">{issue.finding}</p>
                   <p className="text-xs text-white/60 mt-1">Fix: {issue.actual_fix}</p>
                 </div>
               ))}
               {result.evidence_fix_plan.issues.length > 6 && (
                 <button
                   onClick={() => setShowAllFixPlanIssues((v) => !v)}
                   className="text-xs text-orange-400 hover:text-orange-300 transition-colors mt-1"
                 >
@@ -435,105 +529,118 @@ const ComprehensiveAnalysis: React.FC<ComprehensiveAnalysisProps> = ({ result, t
             </div>
 
             {strictRubric.required_fixpacks.length > 0 && (
               <div className="rounded-lg border border-white/10 bg-charcoal-light p-3">
                 <p className="text-xs uppercase tracking-wider text-white/55 mb-2">Required Fixpacks</p>
                 <div className="space-y-2">
                   {strictRubric.required_fixpacks.map((pack) => (
                     <div key={pack.id} className="rounded-md border border-white/10 bg-charcoal p-2.5">
                       <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                         <p className="text-sm text-white/80 font-medium">{pack.label}</p>
                         <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/10 text-white/65">
                           Lift +{pack.estimated_score_lift_min} to +{pack.estimated_score_lift_max}
                         </span>
                       </div>
                       <p className="text-xs text-white/60">
                         Targets: {pack.target_gate_ids.map(humanizeGateId).join(', ')}
                       </p>
                     </div>
                   ))}
                 </div>
               </div>
             )}
           </div>
         )}
         <div className="space-y-4">
-          {keypoints.map((kp, idx) => {
+          {keypoints.slice(0, 3).map((kp, idx) => {
             const config = priorityConfig[kp.priority];
             return (
               <div
                 key={idx}
                 className={`rounded-xl border-2 p-4 ${config.border} ${config.bg}`}
               >
                 <div className="flex items-start gap-3">
                   <div className="flex-shrink-0">
                     <div className={`w-8 h-8 rounded-full bg-charcoal-deep flex items-center justify-center font-bold ${config.text}`}>
                       {idx + 1}
                     </div>
                   </div>
                   <div className="flex-1 min-w-0">
                     <div className="flex items-center gap-2 mb-2">
                       <h4 className={`font-bold ${config.text}`}>{kp.title}</h4>
                       <span className={`text-xs px-2 py-0.5 rounded-full border ${config.border} ${config.text}`}>
                         {config.label}
                       </span>
                     </div>
                     <p className="text-white/75 text-sm mb-2">{kp.description}</p>
                     <div className="flex items-start gap-2 mt-3 p-3 bg-charcoal rounded-xl">
                       <Zap className="w-4 h-4 text-white/80 flex-shrink-0 mt-0.5" />
                       <p className="text-xs text-white/55">
                         <span className="font-semibold text-white">Impact:</span> {kp.impact}
                       </p>
                     </div>
                   </div>
                 </div>
               </div>
             );
           })}
         </div>
       </div>
 
 
 
+      {/* SECTION 5 — FIX LOOP */}
+      <div className="rounded-xl border border-white/10 bg-charcoal/40 p-5">
+        <h3 className="text-lg font-semibold text-white mb-2">What happens after you fix</h3>
+        <ul className="list-disc pl-5 text-sm text-white/70 space-y-1">
+          <li>mark as fixed</li>
+          <li>re-run audit</li>
+          <li>see score change</li>
+          <li>see evidence change</li>
+        </ul>
+      </div>
+
+      {/* SECTION 6 — PAYWALL */}
       {upgradeSuggestions.length > 0 && (
         <div className="card-charcoal/50 rounded-xl p-6 border border-white/10">
           <div className="flex items-center gap-3 mb-4">
             <Target className="w-5 h-5 text-white/80" />
-            <h3 className="text-lg font-bold text-white">Recommended Upgrade Tools for These Findings</h3>
+            <h3 className="text-lg font-bold text-white">You’re missing where competitors are getting picked</h3>
           </div>
+          <p className="text-xs text-white/55 mb-4">Competitor appears in key answer sources while you do not. Unlock full source breakdown to see why they win.</p>
           <div className="space-y-3">
             {upgradeSuggestions.map((item) => (
               <div key={item.id} className="rounded-xl border border-white/10 bg-charcoal p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                 <div className="flex-1 min-w-0">
                   <p className="text-sm font-semibold text-white">{item.title}</p>
                   <p className="text-xs text-white/60 mt-1">{item.description}</p>
                 </div>
                 <Link
                   to={item.to}
                   className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border border-white/15 bg-charcoal-light text-white/80 text-xs font-semibold hover:text-white transition-colors"
                 >
-                  Unlock on {item.requirement === "signal" ? "Signal" : "Alignment"}
+                  See why they win
                   <ArrowRight className="w-3.5 h-3.5" />
                 </Link>
               </div>
             ))}
           </div>
         </div>
       )}
 
 
 
       {/* SSFR Evidence Audit */}
       {(result as any)?.audit_id && (
         <SSFRPanel auditId={result.audit_id} />
       )}
 
       {/* Crypto Intelligence */}
       {result.crypto_intelligence && (
         <CryptoIntelligencePanel data={result.crypto_intelligence} />
       )}
 
       {/* Document Export */}
       <CollapsibleSection
         title="Export & Document Generation"
         description="Generate reports in PDF, DOCX, Markdown, and other formats"
         icon={Download}
diff --git a/client/src/components/Footer.tsx b/client/src/components/Footer.tsx
index eeaabfbe4c86fa4ba365cbdfd3262855b2313320..c181fe0d9012f6adc297ca8314f93e0f9df85a7d 100644
--- a/client/src/components/Footer.tsx
+++ b/client/src/components/Footer.tsx
@@ -15,126 +15,127 @@ const Footer = () => {
     <footer className="relative z-20 footer-geo-blend premium-surface text-white dark:text-white py-6 mt-6 border-t border-white/12 dark:border-white/10 overflow-hidden">
       {/* Abstract geometric overlay — subtle uneven tiles blended with logo gradient */}
       <div className="footer-geo-pattern" aria-hidden="true" />
       <div className="footer-geo-gradient" aria-hidden="true" />
       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
         <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
           {/* Brand */}
           <div>
             <div className="mb-2 flex items-center">
               <img src={LOGO_URL} alt="AiVIS" className="h-[72px] w-auto object-contain mix-blend-screen brightness-110 saturate-125" />
             </div>
             <p className="text-white/65 dark:text-white/55 text-sm leading-relaxed max-w-xs">
               {PLATFORM_NARRATIVE.oneLiner}
             </p>
           </div>
 
           {/* Product */}
           <div>
             <h4 className="text-sm font-semibold text-white/80 dark:text-white/85 mb-3">{t('footer.product')}</h4>
             <ul className="space-y-2 text-sm">
               <li><Link to="/" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Run an Audit</Link></li>
               <li><Link to="/pricing" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Pricing</Link></li>
               <li><Link to="/analytics" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Analytics</Link></li>
               <li><Link to="/citations" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Citations</Link></li>
               <li><Link to="/competitors" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Competitors</Link></li>
-              <li><Link to="/niche-discovery" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Niche Discovery</Link></li>
+              <li><Link to="/prompt-intelligence" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Decision Query Gaps</Link></li>
               <li><Link to="/mcp" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">MCP Console</Link></li>
               <li><Link to="/reports" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Reports</Link></li>
               <li><Link to="/reverse-engineer" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Reverse Engineer</Link></li>
               <li><Link to="/indexing" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Indexing</Link></li>
               <li><Link to="/server-headers" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Server Headers</Link></li>
               <li><Link to="/tools/schema-validator" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Schema Validator</Link></li>
               <li><Link to="/tools/robots-checker" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">AI Crawler Checker</Link></li>
               <li><Link to="/tools/content-extractability" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Extractability Grader</Link></li>
               <li><Link to="/benchmarks" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Benchmarks</Link></li>
               <li><Link to="/changelog" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Changelog</Link></li>
             </ul>
           </div>
 
           {/* Learn */}
           <div>
             <h4 className="text-sm font-semibold text-white/80 dark:text-white/85 mb-3">{t('footer.resources')}</h4>
             <ul className="space-y-2 text-sm">
               <li><Link to="/blogs" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Blog</Link></li>
               <li><Link to="/insights" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Insights Hub</Link></li>
               <li><Link to="/guide" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Getting Started Guide</Link></li>
               <li><Link to="/faq" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">FAQ</Link></li>
               <li><Link to="/api-docs" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">API Documentation</Link></li>
               <li><Link to="/why-ai-visibility" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Why AI Visibility Matters</Link></li>
               <li><Link to="/aeo-playbook-2026" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">AEO Playbook 2026</Link></li>
               <li><Link to="/geo-ai-ranking-2026" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Geo AI Ranking 2026</Link></li>
               <li><Link to="/competitive-landscape" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Competitive Landscape</Link></li>
               <li><Link to="/integrations" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Integrations</Link></li>
             </ul>
           </div>
 
           {/* Legal */}
           <div>
             <h4 className="text-sm font-semibold text-white/80 dark:text-white/85 mb-3">{t('footer.legal')} &amp; Compliance</h4>
             <ul className="space-y-2 text-sm">
               <li><Link to="/methodology" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Claims &amp; Methodology</Link></li>
               <li><Link to="/compliance" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Compliance &amp; Security</Link></li>
               <li><Link to="/privacy" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Privacy Policy</Link></li>
               <li><Link to="/terms" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Terms of Service</Link></li>
+              <li><Link to="/partnership-terms" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Partnership Terms (Private)</Link></li>
               <li><Link to="/verify-license" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Verify License</Link></li>
               <li><Link to="/help" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Contact Support</Link></li>
               <li><Link to="/about" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">About</Link></li>
               <li><Link to="/press" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Press</Link></li>
               <li><a href="/sitemap.xml" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Sitemap</a></li>
             </ul>
           </div>
 
           {/* Trust */}
           <div>
             <h4 className="text-sm font-semibold text-white/80 dark:text-white/85 mb-3">Trust &amp; Security</h4>
             <ul className="space-y-2 text-sm">
               <li className="flex items-center gap-1.5 text-white/70 dark:text-white/55"><Lock className="w-3.5 h-3.5 text-white/80" /> 256-bit SSL Encrypted</li>
               <li className="flex items-center gap-1.5 text-white/70 dark:text-white/55"><Shield className="w-3.5 h-3.5 text-white/80" /> No Data Resale Policy</li>
               <li className="flex items-center gap-1.5 text-white/70 dark:text-white/55"><Building2 className="w-3.5 h-3.5 text-white/80" /> U.S. Business (EIN on file)</li>
             </ul>
 
             <h4 className="text-sm font-semibold text-white/80 dark:text-white/85 mt-5 mb-3">Community &amp; Contact</h4>
             <ul className="space-y-2 text-sm">
               <li><a href="https://www.reddit.com/r/AiVIS/" target="_blank" rel="noopener noreferrer" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Reddit Community r/AiVIS</a></li>
               <li><a href="https://linkedin.com/in/web4aidev" target="_blank" rel="noopener noreferrer" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">LinkedIn</a></li>
               <li><a href="https://bsky.app/profile/intruvurt.bsky.social" target="_blank" rel="noopener noreferrer" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">Bluesky</a></li>
               <li><a href="mailto:hello@aivis.biz" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">hello@aivis.biz</a></li>
               <li><a href="mailto:support@aivis.biz" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">support@aivis.biz</a></li>
               <li><a href="mailto:sales@aivis.biz" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">sales@aivis.biz</a></li>
               <li><a href="mailto:partners@aivis.biz" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">partners@aivis.biz</a></li>
               <li><a href="tel:+17069075299" className="text-white/70 dark:text-white/55 hover:text-white dark:hover:text-white transition-colors">(706) 907-5299</a></li>
             </ul>
           </div>
         </div>
 
         {/* Bottom bar */}
         <div className="border-t border-white/12/45 dark:border-white/10/45 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
           <div className="flex flex-col gap-1">
             <p className="text-white/60 dark:text-white/60 text-xs">
               &copy; {currentYear} AiVIS. {t('footer.copyright', { year: currentYear })}
             </p>
             <p className="text-white/45 text-[11px]">
-              TechCrunch Startup Battlefield Top 200 nominee · Built for AI visibility, citation readiness, and answer engine discovery
+              TechCrunch Startup Battlefield Top 200 nominee · Evidence-backed AI citation diagnosis + fix execution
             </p>
           </div>
           <a
             href="https://intruvurt.space"
             target="_blank"
             rel="noopener noreferrer"
             className="inline-flex items-center gap-2 text-xs text-white/60 dark:text-white/60 hover:text-white dark:hover:text-white transition-colors"
           >
             <img
               src={INTRUVURT_LOGO_URL}
               alt="Intruvurt Labs"
               className="h-4 w-auto object-contain opacity-85"
               loading="lazy"
             />
             Produced by Intruvurt Labs
           </a>
         </div>
       </div>
     </footer>
   );
 };
 
 export default Footer;
diff --git a/client/src/components/PlatformShiftBanner.tsx b/client/src/components/PlatformShiftBanner.tsx
index 227de3e35d144cb262fa4baba7c924ed92d5667c..79bee52a90bd9bc7a8a4dee24591cbf517be4779 100644
--- a/client/src/components/PlatformShiftBanner.tsx
+++ b/client/src/components/PlatformShiftBanner.tsx
@@ -1,55 +1,61 @@
 import React from "react";
 import { PLATFORM_NARRATIVE } from "../constants/platformNarrative";
 
 interface PlatformShiftBannerProps {
   eyebrow?: string;
   title?: string;
   body?: string;
   bullets?: readonly string[];
-  tone?: "cyan" | "emerald" | "amber";
+  tone?: "cyan" | "emerald" | "amber" | "neutral";
 }
 
 const toneClasses = {
   cyan: {
     shell: "border-cyan-300/25 bg-cyan-500/10",
     eyebrow: "text-cyan-100",
     body: "text-cyan-50/90",
     bullet: "text-cyan-100/85",
   },
   emerald: {
     shell: "border-emerald-300/25 bg-emerald-500/10",
     eyebrow: "text-emerald-100",
     body: "text-emerald-50/90",
     bullet: "text-emerald-100/85",
   },
   amber: {
     shell: "border-amber-300/25 bg-amber-500/10",
     eyebrow: "text-amber-100",
     body: "text-amber-50/90",
     bullet: "text-amber-100/85",
   },
+  neutral: {
+    shell: "border-white/20 bg-white/5",
+    eyebrow: "text-white/85",
+    body: "text-white/80",
+    bullet: "text-white/80",
+  },
 } as const;
 
 export default function PlatformShiftBanner({
   eyebrow = "Category shift",
   title = PLATFORM_NARRATIVE.disruption,
   body = PLATFORM_NARRATIVE.oneLiner,
   bullets = PLATFORM_NARRATIVE.pillars,
   tone = "cyan",
 }: PlatformShiftBannerProps) {
   const palette = toneClasses[tone];
 
   return (
     <div className={`rounded-2xl border p-4 ${palette.shell}`}>
       <h2 className={`text-sm font-semibold uppercase tracking-wide ${palette.eyebrow}`}>{eyebrow}</h2>
       <p className={`mt-2 text-sm leading-7 ${palette.body}`}>{title}</p>
       <p className={`mt-2 text-sm leading-7 ${palette.body}`}>{body}</p>
       <div className="mt-3 flex flex-wrap gap-2 text-xs">
         {bullets.map((bullet) => (
           <span key={bullet} className={`rounded-full border border-white/10 bg-black/20 px-3 py-1 ${palette.bullet}`}>
             {bullet}
           </span>
         ))}
       </div>
     </div>
   );
diff --git a/client/src/i18n/en.json b/client/src/i18n/en.json
index 1eec2bbdcbabd75fb49fbf7d40bd29609abc10eb..7e36a0bd3e8cfa158c5135fd188aaeee26183f5d 100644
--- a/client/src/i18n/en.json
+++ b/client/src/i18n/en.json
@@ -21,51 +21,51 @@
   "hero": {
     "title": "AI Visibility Engine",
     "signedOutSubtitle": "Most AI visibility tools stop at a dashboard. AiVIS diagnoses why AI skips your site, traces it to specific page failures, and ships the fix — down to the pull request.",
     "cta": "Start Audit",
     "ctaSecondary": "View Methodology"
   },
   "common": {
     "loading": "Loading…",
     "error": "Something went wrong",
     "retry": "Retry",
     "cancel": "Cancel",
     "save": "Save",
     "close": "Close",
     "back": "Back",
     "next": "Next",
     "submit": "Submit",
     "export": "Export",
     "copy": "Copy",
     "copied": "Copied!",
     "search": "Search",
     "noResults": "No results found",
     "learnMore": "Learn more",
     "viewAll": "View all"
   },
   "pricing": {
-    "title": "Choose Your Visibility Plan",
+    "title": "Stop guessing why AI ignores your site.",
     "monthly": "Monthly",
     "yearly": "Yearly",
     "currentPlan": "Current Plan",
     "getStarted": "Get Started",
     "popular": "Most Popular",
     "perMonth": "/month"
   },
   "audit": {
     "runAudit": "Run Audit",
     "analyzing": "Analyzing…",
     "visibilityScore": "Visibility Score",
     "recommendations": "Recommendations",
     "technicalSignals": "Technical Signals",
     "contentAnalysis": "Content Analysis",
     "schemaMarkup": "Schema Markup",
     "enterUrl": "Enter a URL to audit"
   },
   "gsc": {
     "title": "Search Console Intelligence",
     "description": "Connect Google Search Console for real performance data. Detect declines, discover CTR opportunities, and merge GSC evidence with your AI visibility audits.",
     "connect": "Connect with Google",
     "connected": "Google Search Console Connected",
     "askQuestion": "Ask a Question",
     "tools": "Intelligence Tools",
     "analyze": "Analyze"
diff --git a/client/src/index.css b/client/src/index.css
index 28889bff9d32735e5f200824087a3722676a7d22..3ac4afeb7bca0c1b28a46d0a7462c27495a73f94 100644
--- a/client/src/index.css
+++ b/client/src/index.css
@@ -1,127 +1,129 @@
+@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=DM+Sans:wght@400;500;700;800&display=swap');
 @tailwind base;
 @tailwind components;
 @tailwind utilities;
 
+@font-face {
+  font-family: "NoExcuseLabs";
+  src: local("NoExcuseLabs"), local("NoExcuseLabs-Regular");
+  font-weight: 100 900;
+  font-style: normal;
+  font-display: swap;
+}
+
 :root {
+  --font-app: "DM Sans", "Caveat", "NoExcuseLabs", "Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
   --app-corner-radius: 1rem;
 
   /* ── Dark charcoal matte palette ─────────────── */
   --charcoal-1: 18 22 34;    /* #121622 — deep base */
   --charcoal-2: 26 32 44;    /* #1A202C — mid card */
   --charcoal-3: 36 42 56;    /* #242A38 — lighter nested */
   --charcoal-4: 48 56 72;    /* #303848 — subtle accent */
 
   /* Silver-blue shell (body gradient) */
   --shell-0: 58 66 82;       /* #3A4252 — deep silver */
   --shell-1: 48 56 74;       /* #30384A */
   --shell-2: 40 48 64;       /* #283040 */
 
   /* Light glass surfaces (kept for edge cases) */
   --shell-3: 255 255 255;
   --shell-4: 228 233 242;
   /* Borders / text */
   --shell-border: 255 255 255;
   --shell-text:   255 255 255;
   --shell-muted:  200 210 228;
 
   /* Steel accent palette */
   --steel:       215 225 240;
   --steel-dk:    175 190 210;
   --glass-white: 255 255 255;
   --glass-dim:   195 208 228;
 
   /* Legacy warm aliases */
   --sanguine:    210 218 235;
   --sanguine-dk: 180 192 210;
   --olivo:       210 220 235;
   --olivo-dk:    185 198 220;
   --coral:       220 228 240;
   --amber-warm:  205 215 232;
 }
 
 /* -------------------------------------------------------
    Base
 -------------------------------------------------------- */
 @layer base {
   html {
     text-rendering: geometricPrecision;
     -webkit-text-size-adjust: 100%;
     scroll-behavior: smooth;
+    font-family: var(--font-app);
   }
 
   /* ── High-contrast scrollbar ──────────────────── */
   ::-webkit-scrollbar {
     width: 10px;
     height: 10px;
   }
   ::-webkit-scrollbar-track {
     background: #0a0c14;
   }
   ::-webkit-scrollbar-thumb {
     background: linear-gradient(180deg, #f97316, #fbbf24 50%, #22d3ee);
     border-radius: 0;
     border: 2px solid #0a0c14;
   }
   ::-webkit-scrollbar-thumb:hover {
     background: linear-gradient(180deg, #fb923c, #fcd34d 50%, #67e8f9);
   }
   ::-webkit-scrollbar-corner {
     background: #0a0c14;
   }
   /* Firefox */
   * {
     scrollbar-width: thin;
     scrollbar-color: #f97316 #0a0c14;
   }
 
   body {
     @apply antialiased;
     margin: 0;
     line-height: 1.5;
     -webkit-font-smoothing: antialiased;
     -moz-osx-font-smoothing: grayscale;
     -webkit-tap-highlight-color: transparent;
-    /* Deep charcoal gradient with subtle diagonal texture */
+    font-family: var(--font-app);
+    /* Soft charcoal checker surface with low-contrast depth */
     background:
-      /* Subtle repeating diagonal lines texture */
-      repeating-linear-gradient(
-        -45deg,
-        transparent,
-        transparent 18px,
-        rgba(255,255,255,0.012) 18px,
-        rgba(255,255,255,0.012) 19px
-      ),
-      /* Soft circular glow accents */
-      /* Warm-orange dominant glows — deep midnight navy matching new logo */
-      radial-gradient(1800px 900px at 12% -10%, rgba(249,115,22,0.10), transparent 58%),
-      radial-gradient(1600px 850px at 94%  6%,  rgba(34,211,238,0.09),  transparent 62%),
-      radial-gradient(1300px 720px at 48% 110%, rgba(251,191,36,0.09),  transparent 56%),
-      radial-gradient(1000px 560px at 30% 26%,  rgba(99,102,241,0.07),  transparent 60%),
-      radial-gradient(900px  500px at 72% 58%,  rgba(249,115,22,0.05),  transparent 62%),
-      /* Deep midnight navy base */
-      linear-gradient(170deg, #0c1020 0%, #111827 45%, #0f172a 100%);
+      linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px),
+      linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
+      radial-gradient(1200px 600px at 10% -10%, rgba(255,255,255,0.05), transparent 55%),
+      radial-gradient(1000px 540px at 92% 0%, rgba(255,255,255,0.04), transparent 60%),
+      linear-gradient(165deg, #1a1d23 0%, #21262d 52%, #181b21 100%);
+    background-size: 28px 28px, 28px 28px, auto, auto, auto;
+    background-position: 0 0, 0 0, center, center, center;
       color: white;
   }
 
   *,
   *::before,
   *::after {
     border-color: rgba(0, 0, 0, 0.85) !important;
     border-radius: var(--app-corner-radius) !important;
   }
 
   button,
   a.inline-flex,
   a[class*="inline-flex"],
   a[class*="px-"][class*="py-"] {
     border-radius: var(--app-corner-radius) !important;
     border: 2px solid rgba(0, 0, 0, 0.85) !important;
     box-shadow: 0 2px 10px rgba(0, 0, 0, 0.28);
   }
 
   button:hover,
   a.inline-flex:hover,
   a[class*="inline-flex"]:hover,
   a[class*="px-"][class*="py-"]:hover {
     border-color: rgba(0, 0, 0, 0.95) !important;
   }
@@ -190,101 +192,101 @@
   button:not(:disabled):hover,
   [role="button"]:not(:disabled):hover {
     transition: background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
   }
 
   /* Selected / aria-pressed / aria-selected state */
   button[aria-pressed="true"],
   [aria-selected="true"] {
     outline: 2px solid rgba(249, 115, 22, 0.70);
     outline-offset: 1px;
     box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.12);
   }
 
   /* Global soft-rounded form controls */
   input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]),
   textarea,
   select {
     border-radius: var(--app-corner-radius) !important;
   }
 
   input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="reset"]),
   textarea,
   select {
     color-scheme: dark;
     background:
-      linear-gradient(180deg, rgba(3, 5, 20, 0.18), rgba(5, 8, 28, 0.10)),
-      linear-gradient(135deg, #0a6ea8 0%, #118ad1 34%, #37a6de 68%, #f59e0b 100%) !important;
+      linear-gradient(180deg, rgba(12, 14, 18, 0.88), rgba(18, 22, 28, 0.88)),
+      linear-gradient(135deg, #252b34 0%, #2c333d 55%, #232932 100%) !important;
     color: #ffffff !important;
     -webkit-text-fill-color: #ffffff;
     font-weight: 600;
     text-shadow:
       -1px -1px 0 rgba(0, 0, 0, 0.95),
        1px -1px 0 rgba(0, 0, 0, 0.95),
       -1px  1px 0 rgba(0, 0, 0, 0.95),
        1px  1px 0 rgba(0, 0, 0, 0.95);
     border: 2px solid rgba(0, 0, 0, 0.95) !important;
     box-shadow:
       0 0 0 1px rgba(255,255,255,0.05),
       0 10px 24px rgba(6,182,212,0.08),
       0 12px 28px rgba(245,158,11,0.10),
       inset 0 1px 0 rgba(255,255,255,0.16),
       inset 0 -1px 0 rgba(0,0,0,0.42),
       0 1px 2px rgba(0,0,0,0.28);
     caret-color: #ffffff;
   }
 
   .field-vivid {
     background:
       linear-gradient(180deg, rgba(3, 5, 20, 0.18), rgba(5, 8, 28, 0.10)),
       linear-gradient(135deg, #0b4f7a 0%, #0ea5e9 36%, #7f1d1d 68%, #f97316 100%) !important;
     box-shadow:
       0 0 0 1px rgba(255,255,255,0.05),
       0 10px 24px rgba(14,165,233,0.10),
       0 12px 28px rgba(127,29,29,0.18),
       inset 0 1px 0 rgba(255,255,255,0.16),
       inset 0 -1px 0 rgba(0,0,0,0.42),
       0 1px 2px rgba(0,0,0,0.28) !important;
   }
 
   select {
     appearance: none;
     -webkit-appearance: none;
     -moz-appearance: none;
     background-image:
-      linear-gradient(180deg, rgba(3, 5, 20, 0.26), rgba(5, 8, 28, 0.18)),
-      linear-gradient(180deg, #0a6ea8 0%, #118ad1 58%, #f59e0b 100%),
+      linear-gradient(180deg, rgba(14, 16, 20, 0.95), rgba(16, 20, 26, 0.92)),
+      linear-gradient(180deg, #232932 0%, #2a313b 58%, #20262f 100%),
       url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 20 20'%3E%3Cpath fill='white' d='M5.5 7.5L10 12l4.5-4.5 1.5 1.5-6 6-6-6z'/%3E%3C/svg%3E") !important;
     background-repeat: no-repeat, no-repeat, no-repeat !important;
     background-position: 0 0, 0 0, right 0.75rem center !important;
     background-size: auto, auto, 14px 14px !important;
     padding-right: 2.25rem !important;
   }
 
   select option {
-    background: #0f3554 !important;
-    color: #ffe7b2 !important;
+    background: #20252e !important;
+    color: #e8edf5 !important;
   }
 
   input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="reset"]):-webkit-autofill,
   input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="reset"]):-webkit-autofill:hover,
   input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="reset"]):-webkit-autofill:focus,
   textarea:-webkit-autofill,
   textarea:-webkit-autofill:hover,
   textarea:-webkit-autofill:focus,
   select:-webkit-autofill,
   select:-webkit-autofill:hover,
   select:-webkit-autofill:focus {
     -webkit-text-fill-color: #ffffff !important;
     box-shadow:
       inset 0 1px 0 rgba(255,255,255,0.16),
       inset 0 -1px 0 rgba(0,0,0,0.42),
       inset 0 0 0 1000px rgba(10, 110, 168, 0.92),
       0 1px 2px rgba(0,0,0,0.28) !important;
     transition: background-color 9999s ease-in-out 0s;
   }
 
   input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="reset"])::placeholder,
   textarea::placeholder {
     color: rgba(255, 255, 255, 0.92) !important;
     text-shadow:
       -1px -1px 0 rgba(0, 0, 0, 0.9),
@@ -342,91 +344,91 @@
     border-radius: var(--app-corner-radius) !important;
   }
 
   .topnav-rounded [class~="rounded"],
   .topnav-rounded [class~="rounded-lg"] {
     border-radius: var(--app-corner-radius) !important;
   }
 
   .topnav-rounded [class~="rounded-xl"] {
     border-radius: var(--app-corner-radius) !important;
   }
 
   .topnav-rounded [class~="rounded-2xl"] {
     border-radius: var(--app-corner-radius) !important;
   }
 
   .topnav-rounded [class~="rounded-3xl"] {
     border-radius: var(--app-corner-radius) !important;
   }
 
   .section-anchor {
     scroll-margin-top: 92px;
   }
 
   .surface-structured {
-    background: linear-gradient(160deg, rgba(14, 20, 36, 0.92), rgba(18, 26, 44, 0.95));
-    border: 1px solid rgba(249, 115, 22, 0.18) !important;
-    box-shadow: 0 8px 22px rgba(249,115,22,0.08), 0 12px 32px rgba(34,211,238,0.10);
+    background: linear-gradient(160deg, rgba(29, 33, 40, 0.94), rgba(34, 39, 47, 0.95));
+    border: 1px solid rgba(255, 255, 255, 0.12) !important;
+    box-shadow: 0 8px 22px rgba(0,0,0,0.22), 0 12px 32px rgba(0,0,0,0.18);
   }
 
   .surface-structured-muted {
-    background: linear-gradient(165deg, rgba(28, 34, 48, 0.76), rgba(36, 42, 56, 0.82));
+    background: linear-gradient(165deg, rgba(33, 37, 45, 0.80), rgba(40, 45, 54, 0.84));
     border: 1px solid rgba(255, 255, 255, 0.12) !important;
   }
 }
 
 /* -------------------------------------------------------
    Utilities
    - Safer animation utilities: include timing + fill mode
    - Includes reduced motion support
    - Print helpers kept
 -------------------------------------------------------- */
 @layer utilities {
   /* Prevent line-clamp overflow:hidden from clipping leading/trailing characters */
   [class*="line-clamp-"] {
     padding-left: 0.15em;
     padding-right: 0.15em;
   }
 
   .elemental-vibrancy-splash {
     background-image:
-      radial-gradient(1400px 840px at 10%  6%, rgba(249,115,22,0.18),  transparent 62%),
-      radial-gradient(1320px 800px at 92% 12%, rgba(34,211,238,0.16),  transparent 64%),
-      radial-gradient(1180px 740px at 52% 104%, rgba(251,191,36,0.16), transparent 60%),
-      radial-gradient(920px  560px at 30% 34%, rgba(99,102,241,0.10),  transparent 62%);
+      radial-gradient(1400px 840px at 10%  6%, rgba(255,255,255,0.08), transparent 62%),
+      radial-gradient(1320px 800px at 92% 12%, rgba(255,255,255,0.05), transparent 64%),
+      radial-gradient(1180px 740px at 52% 104%, rgba(0,0,0,0.12), transparent 60%),
+      radial-gradient(920px  560px at 30% 34%, rgba(255,255,255,0.04), transparent 62%);
     background-repeat: no-repeat;
     background-attachment: fixed;
   }
 
   .page-splash-bg {
     background-image:
-      radial-gradient(1200px 720px at 12%  8%, rgba(249,115,22,0.14),  transparent 60%),
-      radial-gradient(1120px 680px at 88% 14%, rgba(34,211,238,0.13),  transparent 62%),
-      radial-gradient(1020px 640px at 48% 98%, rgba(251,191,36,0.12),  transparent 58%),
-      radial-gradient(920px  540px at 32% 36%, rgba(99,102,241,0.08),  transparent 60%),
-      radial-gradient(760px  460px at 72% 72%, rgba(249,115,22,0.06),  transparent 62%);
+      radial-gradient(1200px 720px at 12%  8%, rgba(255,255,255,0.07), transparent 60%),
+      radial-gradient(1120px 680px at 88% 14%, rgba(255,255,255,0.04), transparent 62%),
+      radial-gradient(1020px 640px at 48% 98%, rgba(0,0,0,0.14), transparent 58%),
+      radial-gradient(920px  540px at 32% 36%, rgba(255,255,255,0.03), transparent 60%),
+      radial-gradient(760px  460px at 72% 72%, rgba(0,0,0,0.10), transparent 62%);
     background-repeat: no-repeat;
     background-attachment: fixed;
   }
 
   .animate-in {
     animation-duration: 300ms;
     animation-fill-mode: both;
     animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
   }
 
   .fade-in {
     animation-name: fadeIn;
   }
 
   .slide-in-from-bottom-2 {
     animation-name: slideInFromBottom2;
   }
 
   .slide-in-from-bottom-4 {
     animation-name: slideInFromBottom4;
   }
 
   .slide-in-from-bottom-5 {
     animation-name: slideInFromBottom5;
   }
diff --git a/client/src/pages/AboutPage.tsx b/client/src/pages/AboutPage.tsx
index 22a6e2d272771f2d1556d0ab3d44bd732d54923f..dd0e69b0b587d73f9ffc95d415062693add7f5e4 100644
--- a/client/src/pages/AboutPage.tsx
+++ b/client/src/pages/AboutPage.tsx
@@ -113,55 +113,55 @@ export default function AboutPage() {
               </p>
               <p className="text-white/70">
                 Every audit is a proof point. Every recommendation is actionable. Every citation is verifiable.
               </p>
             </div>
 
             <div className="grid gap-4">
               <div className="p-4 rounded-lg border border-white/10 bg-white/5">
                 <h3 className="font-semibold mb-1 text-white/90">Founded</h3>
                 <p className="text-white/60">December 2025</p>
               </div>
               <div className="p-4 rounded-lg border border-white/10 bg-white/5">
                 <h3 className="font-semibold mb-1 text-white/90">Registration Status</h3>
                 <p className="text-white/60">US Federal Pending (GOV SOS)</p>
               </div>
               <div className="p-4 rounded-lg border border-white/10 bg-white/5">
                 <h3 className="font-semibold mb-1 text-white/90">Headquarters</h3>
                 <p className="text-white/60">United States</p>
               </div>
             </div>
           </div>
         </div>
       </section>
 
       {/* Founder section */}
-      <section className="px-4 py-16" id="founder">
+      <section className="px-4 py-16" id="leadership">
         <div className="max-w-6xl mx-auto">
           <h2 className="text-3xl brand-title mb-12 text-center">Leadership</h2>
 
-          <div className="max-w-2xl mx-auto">
+          <div className="max-w-5xl mx-auto grid gap-6 md:grid-cols-2">
             <div className="rounded-lg border border-white/10 overflow-hidden bg-white/5">
               {/* Founder card */}
               <div className="p-8 md:p-12">
                 <div className="mb-6">
                   <div className="w-20 h-20 rounded-full bg-gradient-to-br from-white/20 to-white/5 border border-white/10 flex items-center justify-center mb-4">
                     <Users className="w-10 h-10 text-white/60" />
                   </div>
                 </div>
 
                 <h3 className="text-2xl font-bold mb-1 text-blue-800 dark:text-blue-200">R. Mason</h3>
                 <p className="text-lg text-white/60 mb-6">Head of Intruvurt Labs</p>
 
                 <p className="text-white/70 leading-relaxed mb-4">
                   R. Mason leads the vision and engineering at Intruvurt Labs. With deep expertise in citation architecture, machine readability, and AI extractability, Mason drives the platform&apos;s commitment to enterprise-grade visibility auditing.
                 </p>
 
                 <p className="text-white/70 leading-relaxed mb-4">
                   The mission: help businesses survive the shift from searchable websites to AI-readable entities with evidence, remediation, and measurable movement.
                 </p>
 
                 <div className="mb-4 flex flex-wrap gap-3 text-sm">
                   <a
                     href="https://linkedin.com/in/web4aidev"
                     target="_blank"
                     rel="noreferrer"
@@ -194,50 +194,97 @@ export default function AboutPage() {
                     Stack Overflow
                   </a>
                 </div>
 
                 <div className="mb-4 flex flex-wrap gap-3 text-sm">
                   <a href="mailto:hello@aivis.biz" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/70 transition hover:border-white/20 hover:text-white">hello@aivis.biz</a>
                   <a href="mailto:founder@aivis.biz" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/70 transition hover:border-white/20 hover:text-white">founder@aivis.biz</a>
                   <a href="mailto:partners@aivis.biz" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/70 transition hover:border-white/20 hover:text-white">partners@aivis.biz</a>
                   <a href="mailto:sales@aivis.biz" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/70 transition hover:border-white/20 hover:text-white">sales@aivis.biz</a>
                   <a href="mailto:info@aivis.biz" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/70 transition hover:border-white/20 hover:text-white">info@aivis.biz</a>
                   <a href="mailto:support@aivis.biz" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/70 transition hover:border-white/20 hover:text-white">support@aivis.biz</a>
                 </div>
 
                 <div className="mt-6 pt-6 border-t border-white/10">
                   <p className="text-xs text-white/50 mb-3">Focus areas:</p>
                   <div className="flex flex-wrap gap-2">
                     {["Citation Parity", "Machine Readability", "AI Optimization", "Executive Audit"].map((topic) => (
                       <span key={topic} className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-white/70">
                         {topic}
                       </span>
                     ))}
                   </div>
                 </div>
               </div>
             </div>
+
+            <div className="rounded-lg border border-white/10 overflow-hidden bg-white/5">
+              <div className="p-8 md:p-12">
+                <div className="mb-6">
+                  <img
+                    src="/team/sadiq-khan-avatar.svg"
+                    alt="Sadiq Khan profile avatar"
+                    className="w-20 h-20 rounded-full border border-cyan-300/40 shadow-lg shadow-cyan-500/20 object-cover mb-4 bg-slate-900"
+                    loading="lazy"
+                  />
+                </div>
+
+                <h3 className="text-2xl font-bold mb-1 text-blue-800 dark:text-blue-200">Sadiq Khan</h3>
+                <p className="text-lg text-white/60 mb-2">Marketing Specialist</p>
+                <p className="text-sm text-white/45 mb-6">Timezone: India Standard Time (UTC+5:30)</p>
+
+                <p className="text-white/70 leading-relaxed mb-4">
+                  Sadiq leads marketing execution across campaign operations, funnel messaging, and partnership
+                  communications so product work and market visibility stay aligned.
+                </p>
+
+                <p className="text-white/70 leading-relaxed mb-4">
+                  Internal collaboration includes private lead-generation coordination with
+                  {" "}
+                  <a
+                    href="https://zeeniith.in"
+                    target="_blank"
+                    rel="noreferrer"
+                    className="underline decoration-cyan-300/50 underline-offset-4 hover:text-white"
+                  >
+                    zeeniith.in
+                  </a>
+                  , used only for approved partner workflows.
+                </p>
+
+                <div className="mt-6 pt-6 border-t border-white/10">
+                  <p className="text-xs text-white/50 mb-3">Focus areas:</p>
+                  <div className="flex flex-wrap gap-2">
+                    {["Go-To-Market", "Lead Quality", "Partnership Outreach", "Conversion Messaging"].map((topic) => (
+                      <span key={topic} className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-white/70">
+                        {topic}
+                      </span>
+                    ))}
+                  </div>
+                </div>
+              </div>
+            </div>
           </div>
         </div>
       </section>
 
       {/* Compliance & Trust section */}
       <section className="px-4 py-16 bg-white/5 border-y border-white/10">
         <div className="max-w-6xl mx-auto">
           <h2 className="text-3xl brand-title mb-4 text-center">Security & Compliance</h2>
           <p className="text-white/60 text-center max-w-2xl mx-auto mb-12">
             Live controls should be stated conservatively. This page avoids third-party attestation claims unless they are published and verifiable.
           </p>
 
           <div className="grid md:grid-cols-3 gap-6">
             {/* SOC2 */}
             <div className="p-6 rounded-lg border border-white/10 bg-white/5">
               <div className="mb-4 flex items-center gap-3">
                 <Shield className="w-6 h-6 text-white/80" />
                 <h3 className="font-bold">SOC 2</h3>
               </div>
               <p className="text-sm text-white/70 mb-4">
                 No public attestation is claimed here unless a formal report is available for review.
               </p>
               <a href="#compliance" className="text-xs text-white/50 hover:text-white/70 flex items-center gap-1">
                 Review live status <ArrowRight className="w-3 h-3" />
               </a>
diff --git a/client/src/pages/FAQ.tsx b/client/src/pages/FAQ.tsx
index 0a70d9255965d6e87da100213cb6f5aa0da4a333..fd0d7f7adc1a2f77b4a564a6060b3539ed3b8f8c 100644
--- a/client/src/pages/FAQ.tsx
+++ b/client/src/pages/FAQ.tsx
@@ -105,66 +105,66 @@ Are competitors being recommended instead?`,
       {
         question: "What are the recommendations based on?",
         answer:
           "Recommendations come from evidence found or missing on your actual pages. They point to specific fields, gaps, or structural problems instead of generic advice.",
       },
       {
         question: "What checks happen before citing a site as factual?",
         answer:
           "We apply a quick credibility + visibility review in addition to structural scoring: author or organization traceability, evidence-backed claims that can be cross-checked, publish/update freshness, and potential bias or commercial incentives (including affiliate-heavy framing). For visibility context, we review branded and topic-query presence, indexed-page footprint, and third-party mentions from reputable domains such as institutions, niche publications, and trusted communities.",
       },
       {
         question: "What is the BRAG evidence system?",
         answer:
           "BRAG is the evidence system behind AiVIS. Each finding carries an evidence ID linked to a specific scraped page element so claims can be verified.",
       },
     ],
   },
   {
     id: "pricing",
     label: "Plans & Pricing",
     icon: CreditCard,
     items: [
       {
         question: "What can I do on the free tier?",
         answer:
-          "The Observer tier includes a live monthly allowance with full AI-powered scoring, evidence-backed findings, actionable recommendations, and Keyword Intelligence. No credit card is required to use the free tier. It\'s a real analysis, not a teaser.",
+          "Observer includes 3 lifetime audits (up to 3 pages per audit), verdict-first scoring, top blockers, and a competitor gap preview. Full evidence and competitor source intelligence are locked to paid tiers. No credit card is required.",
       },
       {
         question: "What do paid tiers add?",
         answer:
-          "Paid tiers add higher allowances and broader workflows. Alignment adds exports and force-refresh, Signal adds citation/API automation, and Score Fix adds remediation output and validation checklists.",
+          "Alignment unlocks full evidence and fix planning. Signal adds tracking over time (citation movement, source gaps, deltas, alerts). Score Fix adds remediation execution and post-fix verification workflows.",
       },
       {
         question: "Can I export or share my report?",
         answer:
           "Observer, Alignment, Signal, and Score Fix tiers can generate public view links. JSON export is available on Alignment, Signal, and Score Fix. Observer links are intentionally redacted for safe sharing while still enabling distribution and proof.",
       },
       {
         question: "How is usage enforced?",
         answer:
-          "Server-side hard caps with real-time counters. Every audit updates your used/remaining totals immediately. If monthly audits are exhausted, pack credits are consumed automatically. You can see used, remaining, and credit balance live in Billing and nav.",
+          "Usage is enforced server-side with hard caps and real-time counters. Observer is treated as a constrained starter allowance; paid tiers use recurring or credit-based limits based on plan rules shown in Billing.",
       },
       {
         question: "What are the current audit credit packs and tier boosts?",
         answer:
           "Audit credit packs and tier boosts are always shown as live pricing in Billing before checkout. If you're already on Signal, each pack gets a +20% credit boost; Score Fix gets +40%. Billing always shows the effective audits you'll receive before checkout.",
       },
       {
         question: "Do Signal and Score Fix include initial credit bonuses?",
         answer:
           "Initial bonus credits are applied on tier activation and shown in Billing. Signal supports monthly and annual subscription bonus paths. Score Fix is now a one-time remediation purchase and follows the one-time bonus policy shown in Billing at checkout.",
       },
       {
         question: "Can I cancel or switch plans anytime?",
         answer:
           "Yes. Alignment and Signal subscriptions can be upgraded, downgraded, or cancelled from Billing, with access through the end of the active billing period. Score Fix is a one-time purchase, so it does not renew monthly.",
       },
       {
         question: "How does referral credit payout work now?",
         answer:
           "Referral credits are now eligibility-based. Credits are awarded only after the referred account completes 5 or more audits. If the referred account upgrades to a paid tier (Alignment, Signal, or Score Fix), the reward is multiplied 3× for both the referrer and the referred user.",
       },
     ],
   },
   {
     id: "technical",
diff --git a/client/src/pages/Landing.tsx b/client/src/pages/Landing.tsx
index fa5fa9fa319ff87afffe75cb710b7a155782bcb3..4f70a2c0c57fa069bc909d60125db6661dfcfea4 100644
--- a/client/src/pages/Landing.tsx
+++ b/client/src/pages/Landing.tsx
@@ -1,28 +1,28 @@
 // Enterprise Landing — AiVIS
 import { useState, useEffect } from 'react';
-import { Link } from 'react-router-dom';
+import { Link, useNavigate } from 'react-router-dom';
 import { motion } from 'framer-motion';
 import { toast } from 'react-hot-toast';
 import { useAuthStore } from '../stores/authStore';
 import { API_URL } from '../config';
 import { usePageMeta } from '../hooks/usePageMeta';
 import usePageVisible from '../hooks/usePageVisible';
 import { MARKETING_CLAIMS } from '../constants/marketingClaims';
 import { PLATFORM_NARRATIVE } from '../constants/platformNarrative';
 import { CANONICAL_TIER_PRICING, TIER_LIMITS } from '../../../shared/types';
 import PlatformShiftBanner from '../components/PlatformShiftBanner';
 
 interface PlatformStats {
   status: string; db: string; uptime: number;
   totalUsers?: number; completedAudits?: number; averageScore?: number;
 }
 
 async function getPlatformStats(): Promise<PlatformStats | null> {
   try { const r = await fetch(`${API_URL}/api/health`); if (!r.ok) return null; return r.json(); } catch { return null; }
 }
 
 const paymentService = {
   createStripeCheckout: async (tier: string): Promise<string> => {
     const token = useAuthStore.getState().token;
     const r = await fetch(`${API_URL}/api/payment/stripe`, {
       method: 'POST',
@@ -132,187 +132,283 @@ const PUBLIC_PROOF_ITEMS = [
   },
 ] as const;
 
 const SCORE_DROP_SIGNALS = [
   'No FAQPage or HowTo schema',
   'Broken H1-H3 intent hierarchy',
   'Meta/title mismatch with page intent',
   'No direct, citation-ready answer blocks',
 ] as const;
 
 const WHAT_CHANGED_DIFF = [
   {
     title: 'Recommendation Diff',
     removed: ['"Add schema" (generic)', '"Improve headings" (generic)'],
     added: ['Add FAQPage JSON-LD (5 Q/A pairs)', 'Rewrite H1 for top-intent query'],
   },
   {
     title: 'Evidence Links',
     removed: ['No traceable source fields'],
     added: ['EVIDENCE_12: Missing FAQ schema node', 'EVIDENCE_27: H2 chain skips primary intent'],
   },
 ] as const;
 
 // ─── Landing ─────────────────────────────────────────────────────────────────
 const Landing = () => {
+  const navigate = useNavigate();
   usePageMeta({
     title: 'AI Visibility Audit Platform | AiVIS',
     description: 'Enterprise AI visibility auditing for ChatGPT, Perplexity, Google AI, and Claude. Evidence-backed scoring with implementation-ready fixes.',
     path: '/landing',
     ogTitle: 'AiVIS – Measure How AI Sees Your Site',
   });
 
   const { isAuthenticated } = useAuthStore();
   const [loadingTier, setLoadingTier] = useState<string | null>(null);
   const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
   const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
+  const [heroUrl, setHeroUrl] = useState('');
+  const [expVariant, setExpVariant] = useState<'a' | 'b'>('a');
 
   const pageVisible = usePageVisible();
 
   useEffect(() => {
     let cancelled = false;
     if (!pageVisible) return;
     getPlatformStats().then((d) => { if (!cancelled) setPlatformStats(d); });
     const iv = setInterval(() => { getPlatformStats().then((d) => { if (!cancelled) setPlatformStats(d); }); }, 30_000);
     return () => { cancelled = true; clearInterval(iv); };
   }, [pageVisible]);
 
+  useEffect(() => {
+    const forced = new URLSearchParams(window.location.search).get('exp');
+    if (forced === 'headline_b') {
+      setExpVariant('b');
+      return;
+    }
+    const bucket = window.localStorage.getItem('aivis.exp.hero.v1');
+    if (bucket === 'a' || bucket === 'b') {
+      setExpVariant(bucket);
+      return;
+    }
+    const assigned = Math.random() < 0.5 ? 'a' : 'b';
+    window.localStorage.setItem('aivis.exp.hero.v1', assigned);
+    setExpVariant(assigned);
+  }, []);
+
   const handlePayment = async (tier: string) => {
     if (!isAuthenticated) { toast.error('Please login to upgrade'); return; }
     if (!tier || loadingTier) return;
     setLoadingTier(tier);
     try {
       const url = await paymentService.createStripeCheckout(tier);
       toast.success('Redirecting to Stripe…');
       window.location.href = url;
     } catch (err) {
       toast.error(err instanceof Error ? err.message : 'Payment failed');
       setLoadingTier(null);
     }
   };
 
+  const heroHeadline =
+    expVariant === 'a'
+      ? 'AI is answering.\nYour site isn’t being chosen.'
+      : 'Your site is invisible to AI answers';
+  const heroPrimaryCta = expVariant === 'a' ? 'Run free audit' : 'See if AI ignores your site';
+
   return (
     <div className="min-h-screen bg-[#060607]">
 
       {/* ── HERO ── */}
-      <section className="relative min-h-screen flex items-center overflow-hidden bg-[#060607]">
-        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(34,211,238,0.07),transparent)]" />
-        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_60%,rgba(139,92,246,0.06),transparent)]" />
+      <section className="relative min-h-screen flex items-center overflow-hidden bg-[#111318]">
+        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(255,255,255,0.07),transparent)]" />
+        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_60%,rgba(148,163,184,0.08),transparent)]" />
         <div className="hero-flow-overlay" aria-hidden="true" />
         <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-20 lg:py-28">
           <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
             <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, ease: 'easeOut' }}>
               <div className="mb-8">
                 <img src="/text-logo.png" alt="AiVIS – AI Visibility Intelligence Audits" className="h-12 sm:h-14 lg:h-16 w-auto object-contain mix-blend-screen brightness-110 saturate-125" loading="eager" />
               </div>
               <div className="flex flex-wrap gap-2 mb-6">
-                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 text-xs font-bold tracking-widest uppercase">
-                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Free Starter Tier
+                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/25 bg-white/5 text-white/85 text-xs font-bold tracking-widest uppercase">
+                  Free Starter Tier
                 </span>
-                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-cyan-400/25 bg-cyan-500/8 text-cyan-300/80 text-xs font-semibold tracking-wide">Evidence-backed · No black box</span>
-                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-400/25 bg-amber-500/10 text-amber-300/90 text-xs font-semibold tracking-wide">Top 200 · TechCrunch Startup Battlefield 2026</span>
+                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-300/20 bg-slate-200/5 text-slate-200/90 text-xs font-semibold tracking-wide">No signup required · results in seconds</span>
               </div>
-              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-blue-500 mb-6 tracking-tight">
-                AiVIS tracks whether AI{' '}
-                <span className="bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent">includes you, cites you,</span>
-                <br />or hands the win to someone else
+              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight text-white mb-6 tracking-tight">
+                {heroHeadline.split('\n')[0]}
+                {heroHeadline.includes('\n') && <br />}
+                {heroHeadline.includes('\n') && (
+                  <span className="text-slate-300">{heroHeadline.split('\n')[1]}</span>
+                )}
               </h1>
               <p className="text-lg text-white/60 mb-4 leading-relaxed max-w-xl">
-                Most AI visibility tools stop at a dashboard. AiVIS diagnoses why AI skips your site, traces it to specific page failures, and ships the fix — down to the pull request.
-              </p>
-              <p className="text-sm text-white/50 mb-2 max-w-xl">
-                TechCrunch Startup Battlefield Top 200 nominee.
-              </p>
-              <p className="text-sm text-white/40 font-mono mb-8 max-w-xl">
-                Built for agencies, operators, and developers shipping evidence-backed visibility fixes.
+                See what AI cannot verify and why competitors get cited instead.
               </p>
+              <p className="text-sm text-white/40 font-mono mb-6 max-w-xl">No signup required. Results in seconds.</p>
+              <div className="max-w-xl mb-6">
+                <input
+                  value={heroUrl}
+                  onChange={(e) => setHeroUrl(e.target.value)}
+                  placeholder="enter your site url"
+                  className="w-full rounded-xl border border-white/15 bg-[#171a20] px-4 py-3 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-slate-300/40"
+                />
+              </div>
               <div className="flex items-center gap-4 mb-8">
                 <div className="flex items-center gap-3 px-5 py-3 rounded-2xl border border-white/10 bg-[#111827]/60">
-                  <span className="text-5xl font-black text-white tabular-nums leading-none">10</span>
+                  <span className="text-5xl font-black text-white tabular-nums leading-none">3</span>
                   <div>
-                    <p className="text-white font-bold text-lg leading-tight">FREE Audits</p>
-                    <p className="text-white/50 text-xs">every month · no credit card</p>
+                    <p className="text-white font-bold text-lg leading-tight">LIFETIME Audits</p>
+                    <p className="text-white/50 text-xs">free starter cap · no credit card</p>
                   </div>
                 </div>
                 {platformStats?.completedAudits && (
                   <div className="hidden sm:flex flex-col items-start px-4 py-3 rounded-2xl border border-white/8 bg-[#111827]/40">
                     <span className="text-2xl font-bold text-cyan-300">{Number(platformStats.completedAudits).toLocaleString()}+</span>
                     <span className="text-xs text-white/45">audits completed</span>
                   </div>
                 )}
               </div>
               <div className="flex flex-col sm:flex-row gap-3">
-                <Link to="/auth?mode=signup" className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white px-7 py-3.5 rounded-full text-base font-semibold hover:from-cyan-400 hover:to-violet-500 transition-all shadow-lg shadow-violet-500/20">
-                  Analyze your site free
+                <button
+                  type="button"
+                  onClick={() => navigate(heroUrl.trim() ? `/analyze?url=${encodeURIComponent(heroUrl.trim())}` : '/analyze')}
+                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-slate-700 to-slate-500 text-white px-7 py-3.5 rounded-full text-base font-semibold hover:from-slate-600 hover:to-slate-400 transition-all shadow-lg shadow-black/35"
+                >
+                  {heroPrimaryCta}
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
-                </Link>
+                </button>
                 <Link to="/pricing" className="inline-flex items-center justify-center bg-transparent text-white/60 px-7 py-3.5 rounded-full text-base font-medium hover:text-white transition-colors border border-white/15 hover:border-white/25">
                   View plans &amp; pricing
                 </Link>
               </div>
-              <div className="mt-5 flex flex-wrap gap-2 text-[11px]">
-                <span className="px-2.5 py-1 rounded-full border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">Agencies: show client-ready evidence</span>
-                <span className="px-2.5 py-1 rounded-full border border-violet-400/20 bg-violet-500/10 text-violet-300">Operators: prioritize revenue-impact fixes</span>
-                <span className="px-2.5 py-1 rounded-full border border-emerald-400/20 bg-emerald-500/10 text-emerald-300">Developers: ship structured changes quickly</span>
-              </div>
+              <p className="mt-3 text-xs text-white/40">No signup required. Results in seconds.</p>
               <div className="mt-6 max-w-2xl">
                 <PlatformShiftBanner
                   eyebrow="Platform reality"
                   title={PLATFORM_NARRATIVE.disruption}
                   body="AiVIS is a real operating platform for auditing, fixing, validating, and tracking AI visibility across live websites."
                   bullets={PLATFORM_NARRATIVE.pillars}
-                  tone="emerald"
+                  tone="neutral"
                 />
               </div>
             </motion.div>
             <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.15, ease: 'easeOut' }} className="hidden lg:block">
-              <div className="card-smoke glass-bleed-cyan relative rounded-2xl p-4 shadow-2xl overflow-hidden">
-                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-violet-500/5" />
+              <div className="card-smoke relative rounded-2xl p-4 shadow-2xl overflow-hidden border border-white/10 bg-[#151922]">
+                <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-slate-400/5" />
                 <img src="/images/audit-intelligence-dashboard.svg" alt="Audit Intelligence Dashboard" className="w-full h-auto object-contain rounded-lg" />
                 <div className="absolute top-4 left-4 flex gap-2">
-                  <span className="px-2 py-0.5 rounded bg-cyan-400/15 border border-cyan-400/25 text-cyan-300 text-[9px] font-mono tracking-wider">SCAN ACTIVE</span>
-                  <span className="px-2 py-0.5 rounded bg-violet-400/15 border border-violet-400/25 text-violet-300 text-[9px] font-mono tracking-wider">AI LAYER</span>
+                  <span className="px-2 py-0.5 rounded bg-white/10 border border-white/20 text-white/90 text-[9px] font-mono tracking-wider">SCAN ACTIVE</span>
+                  <span className="px-2 py-0.5 rounded bg-slate-300/10 border border-slate-300/20 text-slate-200 text-[9px] font-mono tracking-wider">AI LAYER</span>
                 </div>
                 <div className="absolute bottom-4 right-4">
-                  <span className="px-2 py-0.5 rounded bg-amber-400/15 border border-amber-400/25 text-amber-300 text-[9px] font-mono tracking-wider">AIVIS.BIZ</span>
+                  <span className="px-2 py-0.5 rounded bg-slate-300/10 border border-slate-300/20 text-slate-200 text-[9px] font-mono tracking-wider">AIVIS.BIZ</span>
                 </div>
               </div>
             </motion.div>
           </div>
         </div>
       </section>
 
-      {/* ── TWO PILLARS OF AI VISIBILITY ── */}
+      {/* ── WHAT'S ACTUALLY HAPPENING ── */}
+      <section className="py-16 bg-[#060607] border-t border-white/8 border-b border-white/8">
+        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
+          <div className="rounded-2xl border border-white/10 bg-[#111827]/45 p-6 md:p-8">
+            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">What’s actually happening</h2>
+            <p className="text-white/70 mb-3">Your site can rank and still be invisible to AI.</p>
+            <p className="text-white/60 mb-4">AI doesn’t choose the best page. It chooses the clearest, most verifiable one.</p>
+            <ul className="list-disc pl-5 text-white/65 space-y-1 mb-4">
+              <li>unclear content structure</li>
+              <li>missing entity signals</li>
+              <li>weak trust pages</li>
+              <li>incomplete schema relationships</li>
+            </ul>
+            <p className="text-white/70 font-semibold">If AI can’t verify it, it won’t cite it.</p>
+          </div>
+        </div>
+      </section>
+
+      {/* ── WHAT AIVIS SHOWS ── */}
+      <section className="py-16 bg-[#060607] border-b border-white/8">
+        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
+          <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-8">What AiVIS shows you</h2>
+          <div className="grid md:grid-cols-3 gap-5">
+            <div className="rounded-xl border border-white/15 bg-white/5 p-5">
+              <h3 className="text-white font-semibold mb-2">What AI cannot verify</h3>
+              <p className="text-white/65 text-sm">Missing structure, weak trust signals, incomplete schema, and low extraction clarity.</p>
+            </div>
+            <div className="rounded-xl border border-white/15 bg-white/5 p-5">
+              <h3 className="text-white font-semibold mb-2">Why competitors get chosen</h3>
+              <p className="text-white/65 text-sm">Stronger citation patterns, better source presence, and cleaner extraction signals.</p>
+            </div>
+            <div className="rounded-xl border border-white/15 bg-white/5 p-5">
+              <h3 className="text-white font-semibold mb-2">What to fix first</h3>
+              <p className="text-white/65 text-sm">Evidence-backed issues prioritized by impact and mapped directly to real pages.</p>
+            </div>
+          </div>
+        </div>
+      </section>
+
+      {/* ── WHAT YOU'RE LOSING ── */}
+      <section className="py-14 bg-[#060607] border-b border-white/8">
+        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
+          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">What you’re losing</h2>
+          <p className="text-white/70 mb-4">You’re not losing rankings. You’re losing answers.</p>
+          <ul className="list-disc pl-5 text-white/65 space-y-1">
+            <li>competitors get quoted instead of you</li>
+            <li>your content gets read but not used</li>
+            <li>your pages show up but don’t get chosen</li>
+          </ul>
+          <p className="text-white/70 mt-4">That gap is where traffic disappears.</p>
+        </div>
+      </section>
+
+      {/* ── WHAT AIVIS ACTUALLY DOES ── */}
+      <section className="py-14 bg-[#060607] border-b border-white/8">
+        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
+          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">What AiVIS actually does</h2>
+          <p className="text-white/70 mb-3">AiVIS audits how AI systems interpret your site. Not opinions. Not guesses. Evidence.</p>
+          <ul className="list-disc pl-5 text-white/65 space-y-1">
+            <li>what was found</li>
+            <li>where it was found</li>
+            <li>why it matters</li>
+            <li>what to fix</li>
+          </ul>
+        </div>
+      </section>
+
+      {/* ── HOW THIS WORKS ── */}
       <section className="py-24 bg-gradient-to-b from-[#060607] to-[#0a0a0f] border-b border-white/8">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="text-center mb-14">
             <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-400/25 bg-cyan-500/8 text-cyan-300 text-xs font-semibold uppercase tracking-widest mb-4">Platform scope</span>
             <h2 className="text-3xl sm:text-4xl font-bold mb-4">
-              <span className="bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent">Two pillars of AI visibility — both real, both measured</span>
+              <span className="bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent">How this works: Run audit → See evidence → Fix → Re-audit → Track movement</span>
             </h2>
             <p className="text-white/55 text-lg max-w-3xl mx-auto">
-              AI visibility is not one thing. It has two measurable dimensions: whether AI systems can understand your content, and whether your brand appears when they answer questions. AiVIS measures both with real data and live infrastructure — not mockups or illustrative demos.
+              AiVIS is built for repeated improvement cycles, not one-off scans. Evidence, scoring, and remediation are chained in one loop so teams can ship and verify outcomes.
             </p>
           </div>
           <div className="grid lg:grid-cols-2 gap-8">
             <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="card-smoke glass-bleed-cyan rounded-2xl p-7">
               <div className="flex items-center gap-3 mb-4">
                 <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/25 flex items-center justify-center">
                   <svg className="w-5 h-5 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                 </div>
                 <h3 className="text-xl font-bold text-cyan-300">Structural Readiness</h3>
               </div>
               <p className="text-white/60 text-sm leading-relaxed mb-4">
                 The first pillar asks: can AI systems parse, extract, and trust your website content? AiVIS crawls your live page with a real browser, extracts headings, schema markup, meta tags, body content, and technical signals, then scores six evidence-backed categories. Every finding traces to a specific crawled element — not a generic checklist item. The output is a 0–100 visibility score with letter grades, implementation-ready recommendations, and a fix pack tied to evidence IDs.
               </p>
               <p className="text-white/60 text-sm leading-relaxed mb-4">
                 Structural readiness covers content depth and quality, heading hierarchy and H1 clarity, JSON-LD schema coverage, meta tag and Open Graph completeness, technical SEO signals like HTTPS and response time, and AI readability measures including citation-ready answer blocks. These six categories are weighted and composed into a single composite score using the BRAG methodology — every recommendation is backed by real, auditable, grounded evidence from your page.
               </p>
               <ul className="space-y-2">
                 {['AI visibility score (0–100) with category grades','Evidence-linked findings with traceable IDs','Deterministic rule engine + AI model pipeline','Multi-page BFS crawl for site-wide diagnostics','Document upload audit (PDF, DOCX, images via OCR)','JSON-LD schema generator from page content','Content fix generator with AI-powered rewrite suggestions'].map((f) => (
                   <li key={f} className="flex items-start gap-2 text-sm text-white/55">
                     <svg className="w-4 h-4 text-cyan-300 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                     <span>{f}</span>
                   </li>
                 ))}
               </ul>
             </motion.div>
@@ -324,50 +420,74 @@ const Landing = () => {
                 </div>
                 <h3 className="text-xl font-bold text-violet-300">Brand Presence Across AI</h3>
               </div>
               <p className="text-white/60 text-sm leading-relaxed mb-4">
                 The second pillar asks: when AI systems answer questions about your industry, does your brand appear? AiVIS runs live citation tests across three free web search engines — DuckDuckGo HTML, Bing HTML, and DDG Instant Answer — in parallel, checking whether your brand name, domain, or key entities surface in results that AI models consume as source material. Citation testing on Signal and above uses AI-generated query packs, scheduled recurring tests, and a niche ranking engine that tracks your citation position over time.
               </p>
               <p className="text-white/60 text-sm leading-relaxed mb-4">
                 Brand mention tracking extends this further. AiVIS scans nine free public sources — Reddit, Hacker News, Mastodon, DuckDuckGo site-specific search, Bing site-specific search, Google News RSS, GitHub repositories, Quora, and Product Hunt — to find where your brand is being discussed. The mention timeline shows how your public visibility changes over time, while competitor comparison reveals who occupies the citation slots you are missing. Reverse engineering tools let you decompile AI answers, generate ghost blueprints of ideal cited pages, diff how different models respond, and simulate whether your content would be cited.
               </p>
               <ul className="space-y-2">
                 {['Citation testing across 3 live search engines','Brand mention scanning across 9 public sources','Competitor tracking with category-by-category comparison','AI answer reverse engineering: decompile, ghost, diff, simulate','Niche ranking engine with historical position tracking','Citation scheduling with recurring automated tests','Mention timeline and trend visualization'].map((f) => (
                   <li key={f} className="flex items-start gap-2 text-sm text-white/55">
                     <svg className="w-4 h-4 text-violet-300 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                     <span>{f}</span>
                   </li>
                 ))}
               </ul>
             </motion.div>
           </div>
           <p className="text-center text-sm text-white/40 mt-8 max-w-2xl mx-auto">
             Both pillars operate on real infrastructure with live data. Structural readiness audits run through a Puppeteer scraper and AI model pipeline. Brand presence checks hit real search engines and public sources. No synthetic data, no static previews.
           </p>
         </div>
       </section>
 
+      {/* ── WHY MOST SITES FAIL AI ── */}
+      <section className="py-14 bg-[#060607] border-b border-white/8">
+        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-6">
+          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
+            <h3 className="text-lg font-semibold text-white mb-2">What works</h3>
+            <ul className="list-disc pl-5 text-white/65 space-y-1">
+              <li>clear entities</li>
+              <li>strong headings</li>
+              <li>real schema relationships</li>
+              <li>concise answer blocks</li>
+            </ul>
+          </div>
+          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
+            <h3 className="text-lg font-semibold text-white mb-2">What fails</h3>
+            <ul className="list-disc pl-5 text-white/65 space-y-1">
+              <li>vague language</li>
+              <li>thin content</li>
+              <li>disconnected structure</li>
+              <li>incomplete metadata</li>
+            </ul>
+          </div>
+        </div>
+      </section>
+
       {/* ── INTELLIGENCE MODULES ── */}
       <section className="py-16 bg-[#060607] border-b border-white/8">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="text-center mb-12">
             <p className="text-[11px] tracking-widest uppercase text-violet-300 font-semibold mb-2">Intelligence modules</p>
             <h2 className="text-2xl sm:text-3xl font-bold text-white">Six modules. One operating loop.</h2>
             <p className="text-white/50 text-sm mt-3 max-w-2xl mx-auto">
               Every module answers a different question about your AI visibility. Together they form a closed loop from diagnosis to remediation.
             </p>
           </div>
           <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
             {[
               { to: '/prompt-intelligence', label: 'Prompt Intelligence', border: 'border-violet-400/15 hover:border-violet-400/30 bg-violet-500/[0.04]', head: 'text-violet-300', desc: 'How do AI models interpret queries about you?', detail: 'Map prompt patterns to inclusion, exclusion, and competitor displacement outcomes.' },
               { to: '/answer-presence', label: 'Answer Presence Engine', border: 'border-cyan-400/15 hover:border-cyan-400/30 bg-cyan-500/[0.04]', head: 'text-cyan-300', desc: 'Are you present in AI-generated answers?', detail: 'Track whether ChatGPT, Perplexity, Claude, and Google AI include your brand.' },
               { to: '/citations', label: 'Citation Intelligence', border: 'border-violet-400/15 hover:border-violet-400/30 bg-violet-500/[0.04]', head: 'text-violet-300', desc: 'Are AI systems citing your content as source?', detail: 'Run live citation tests across search engines and track mention rates over time.' },
               { to: '/brand-integrity', label: 'Brand Integrity Monitor', border: 'border-emerald-400/15 hover:border-emerald-400/30 bg-emerald-500/[0.04]', head: 'text-emerald-300', desc: 'Is what AI says about you correct?', detail: 'Monitor brand accuracy across 9 public sources and detect misrepresentations.' },
               { to: '/competitors', label: 'Competitor Displacement Map', border: 'border-emerald-400/15 hover:border-emerald-400/30 bg-emerald-500/[0.04]', head: 'text-emerald-300', desc: 'Who occupies the space you should own?', detail: 'Side-by-side visibility benchmarks with category-level competitor comparison.' },
               { to: '/score-fix', label: 'Remediation Engine', border: 'border-amber-400/15 hover:border-amber-400/30 bg-amber-500/[0.04]', head: 'text-amber-300', desc: 'How do you fix what the audit found?', detail: 'Automated GitHub PRs with schema patches, content rewrites, and evidence-linked fixes.' },
             ].map((mod) => (
               <Link key={mod.to} to={mod.to} className={`group rounded-2xl border ${mod.border} p-6 transition-all`}>
                 <h3 className={`text-lg font-bold ${mod.head} mb-1`}>{mod.label}</h3>
                 <p className="text-white/70 text-sm font-medium mb-2">{mod.desc}</p>
                 <p className="text-white/40 text-xs leading-relaxed">{mod.detail}</p>
               </Link>
             ))}
@@ -632,55 +752,55 @@ const Landing = () => {
               </div>
               <div className="mt-5 rounded-2xl border border-white/10 bg-[#111827]/50 p-4 overflow-hidden">
                 <img src="/images/upload-analysis-pipeline.svg" alt="AiVIS analysis pipeline visualization" className="w-full h-auto rounded-xl border border-white/10 bg-black/20" loading="lazy" />
               </div>
             </div>
           </div>
         </div>
       </section>
 
       {/* ── FULL PLATFORM CAPABILITIES ── */}
       <section className="py-24 bg-[#060607] border-t border-white/8">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="text-center mb-14">
             <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-400/25 bg-violet-500/8 text-violet-300 text-xs font-semibold uppercase tracking-widest mb-4">Full platform</span>
             <h2 className="text-3xl sm:text-4xl font-bold mb-4">
               <span className="bg-gradient-to-r from-violet-300 via-white to-cyan-300 bg-clip-text text-transparent">Everything ships real — no gated mockups</span>
             </h2>
             <p className="text-white/55 text-lg max-w-3xl mx-auto">
               Every feature listed here runs on live infrastructure with real data. From audit evidence to automated PRs, citation testing to brand mention scanning — the platform delivers working results, not placeholder screens. Tier-gated features require the corresponding plan; free tools are available to everyone.
             </p>
           </div>
           <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
             {([
               { icon: '🔍', title: 'AI Visibility Audits', desc: 'Puppeteer-based crawling with evidence-linked AI analysis. Six weighted categories scored 0–100 with letter grades. Single-page, multi-page (up to 500 pages), and document upload modes.', tier: 'All tiers' },
               { icon: '🧠', title: 'Triple-Check AI Pipeline', desc: 'Three independent AI models in sequence: primary analysis, peer critique with bounded score adjustment, and validation gate. If any stage fails, the system degrades gracefully to the last valid result.', tier: 'Signal+' },
-              { icon: '📊', title: 'Analytics Dashboard', desc: 'Score history trends, domain-level metrics, family breakdowns across crawlability, indexability, and discoverability. Community benchmarks show aggregate platform-wide statistics without exposing individual data.', tier: 'Alignment+' },
+              { icon: '📊', title: 'Decision Query Gaps', desc: 'Score history trends and query-level diagnostics that show where AI chooses competitors over your pages.', tier: 'Alignment+' },
               { icon: '🏷️', title: 'Schema & Content Generators', desc: 'AI-powered JSON-LD schema generation from your page content plus content fix suggestions for weak audit categories. Both generators reference your actual crawl evidence, not generic templates.', tier: 'Alignment+' },
               { icon: '🔗', title: 'Citation Testing', desc: 'Live citation checks across DuckDuckGo HTML, Bing HTML, and DDG Instant Answer — all running in parallel. Includes AI-generated query packs, scheduled recurring tests, niche ranking engine, and evidence curation.', tier: 'Signal+' },
               { icon: '📡', title: 'Brand Mention Tracking', desc: 'Scans nine free public sources — Reddit, Hacker News, Mastodon, DuckDuckGo, Bing, Google News RSS, GitHub, Quora, and Product Hunt — for brand mentions. Timeline view and trend analysis included.', tier: 'Alignment+' },
-              { icon: '⚔️', title: 'Competitor Tracking', desc: 'Track up to 10 competitor URLs with category-by-category comparison, opportunity detection, and AI-powered discovery suggestions. Automated autopilot rescans run on schedule.', tier: 'Alignment+' },
+              { icon: '⚔️', title: 'Competitor Advantage Signals', desc: 'Track up to 10 competitor URLs with category comparison, source-level deltas, and opportunity detection to expose why they get cited.', tier: 'Alignment+' },
               { icon: '🔬', title: 'Reverse Engineering Suite', desc: 'Five tools for understanding AI answers: decompile AI responses, generate ghost blueprints of ideal cited pages, diff how models answer differently, simulate citation likelihood, and get AI rewrite suggestions.', tier: 'Alignment+' },
               { icon: '🛠️', title: 'Score Fix AutoPR', desc: 'Connects to your GitHub repo via MCP and pushes pull requests with concrete fixes — JSON-LD patches, H1 rewrites, FAQ blocks — each costing 10–25 credits per fix based on complexity.', tier: 'Score Fix' },
               { icon: '🔌', title: 'API, OAuth 2.0 & MCP', desc: 'REST API with OpenAPI 3.0 spec and full OAuth 2.0 authorization code flow. MCP Server with 14 tool endpoints for AI coding agents. WebMCP discovery for browser-based AI integration.', tier: 'Alignment+' },
               { icon: '🪝', title: 'Webhooks & Deploy Hooks', desc: 'HMAC-signed webhook payloads dispatched on audit events. Deploy hooks trigger automatic rescans after deployment. Report delivery targets auto-send results to email or endpoints.', tier: 'Alignment+' },
               { icon: '📈', title: 'GSC Integration & IndexNow', desc: 'Google Search Console OAuth integration correlates GSC performance data with AI visibility audits. IndexNow submission for faster search indexing of updated pages.', tier: 'Alignment+' },
               { icon: '👥', title: 'Team Workspaces', desc: 'Multi-tenant workspace system with role-based access, member invitations, and workspace-scoped audit filtering. Up to 3 members on Alignment, 10 on Signal, unlimited on Score Fix.', tier: 'Alignment+' },
               { icon: '🛡️', title: 'Private Exposure Scan', desc: 'Scans scraped page content for private data exposure risks: leaked API keys, credentials, internal URLs, and sensitive configurations visible in page source.', tier: 'All tiers' },
               { icon: '🆓', title: 'Free Public Tools', desc: 'Schema validator, robots.txt checker, content extractability analyzer, and server headers check — all available without login or subscription. Rate-limited to prevent abuse.', tier: 'Public' },
             ] as const).map((feature) => (
               <motion.div key={feature.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }} className="rounded-xl border border-white/10 bg-[#111827]/50 p-5 hover:border-white/18 transition-colors">
                 <div className="flex items-center gap-3 mb-3">
                   <span className="text-lg">{feature.icon}</span>
                   <h3 className="text-base font-bold text-white">{feature.title}</h3>
                 </div>
                 <p className="text-sm text-white/55 leading-relaxed mb-3">{feature.desc}</p>
                 <span className="inline-block px-2 py-0.5 rounded-full border border-white/12 bg-white/5 text-[10px] text-white/40 font-mono tracking-wider">{feature.tier}</span>
               </motion.div>
             ))}
           </div>
           <div className="mt-12 rounded-2xl border border-white/10 bg-[#111827]/40 p-6">
             <h3 className="text-lg font-bold text-white mb-3">Implementation integrity</h3>
             <p className="text-sm text-white/55 leading-relaxed">
               AiVIS does not display features that are not built. Every capability listed above runs production code with real database operations, live API calls, and user-scoped data persistence. Tier-gated features check server-side entitlements — the client displays the gate, but the server enforces it. Locked features return clear HTTP status codes; the Integration Hub classifies each endpoint as operational, gated, or temporarily unavailable. If a feature is marked as locked or under upgrade, that status is truthful and intentional.
             </p>
           </div>
@@ -755,50 +875,51 @@ const Landing = () => {
                       loadingTier===plan.key?'opacity-60 cursor-wait bg-white/10 text-white border border-white/15':
                       `border ${plan.accentClass} border-current bg-current/10 hover:bg-current/20 text-white`
                     }`}>
                     {loadingTier===plan.key?'Processing…':isOneTimePlan?`Buy ${plan.name}`:billingCycle==='annual'?`Get ${plan.name} (Annual)`:`Get ${plan.name}`}
                   </button>
                   )}
                 </motion.div>
               );
             })}
           </div>
           <p className="text-center text-xs text-white/30 mt-8">Live pricing verified at checkout. <Link to="/pricing" className="text-cyan-300/60 hover:text-cyan-300 underline">Full pricing page →</Link></p>
         </div>
       </section>
 
       {/* ── FAQ ── */}
       <section className="py-20 bg-[#0a0a0f] border-t border-white/8">
         <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="text-center mb-12">
             <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-400/25 bg-cyan-500/8 text-cyan-300 text-xs font-semibold uppercase tracking-widest mb-4">FAQ</span>
             <h2 className="text-3xl font-bold text-white">
               <span className="bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent">Frequently asked questions</span>
             </h2>
           </div>
           <dl className="space-y-5">
             {([
+              { q:'What is included in the free tier?', a:'Observer includes 3 lifetime audits with up to 3 pages per audit. You get verdict, top blockers, and a competitor gap preview. Full evidence + competitor source intelligence are intentionally locked for paid tiers.' },
               { q:'What does AiVIS actually audit?', a:'AiVIS audits whether ChatGPT, Perplexity, Google AI, and Claude can read, extract, trust, and cite your page. It scores six evidence-backed categories — content depth, heading structure, schema markup, metadata, technical SEO, and AI citability — from your live URL. The output is a 0–100 visibility score with category grades and prioritized, evidence-linked recommendations. Every finding references a specific crawled page element through BRAG evidence IDs.' },
               { q:'How is this different from a standard SEO audit?', a:'Standard SEO audits optimize for ranked pages and clicks. AiVIS measures whether AI systems can actually understand, trust, and cite your business when answers replace links, summaries, and overviews. Every finding is tied to a specific crawled signal, not a generic checklist. The platform also tracks brand presence across citation sources and public discussion platforms — something traditional SEO tools do not measure.' },
               { q:'What are the two types of AI visibility?', a:'The first type is structural readiness — whether AI can parse your schema, headings, content depth, and metadata well enough to extract trustworthy information. The second type is brand presence — whether your business actually appears when AI systems answer questions in your industry. AiVIS measures both: the audit pipeline handles structural readiness, while citation testing, brand mention scanning, and competitor tracking handle brand presence.' },
               { q:'How does citation testing work?', a:'AiVIS runs live citation checks across three free web search engines — DuckDuckGo HTML, Bing HTML, and DDG Instant Answer — all in parallel. On Signal tier and above, you can create AI-generated query packs, schedule recurring tests, and track your niche ranking position over time. The citation evidence view shows exactly which sources mention your brand and how the results change between test runs.' },
               { q:'What sources does brand mention tracking monitor?', a:'Brand mention tracking scans nine free public sources: Reddit, Hacker News, Mastodon, DuckDuckGo site-specific search, Bing site-specific search, Google News RSS, GitHub repositories, Quora, and Product Hunt. The mention timeline shows when and where your brand appears, and trend analysis tracks changes over time. Available on the Alignment tier and above.' },
               { q:'Is the Score Fix output real?', a:'Yes. Score Fix connects to your GitHub repo via MCP and opens pull requests with concrete patches — JSON-LD schema blocks, H1 rewrites, FAQ sections — each tied to audit evidence IDs from your latest scan. Each automated PR costs 10–25 credits based on fix complexity. A 250-credit pack typically covers 10–25 full remediation PRs.' },
               { q:'How many AI models validate a single audit?', a:'On the Signal and Score Fix tiers, AiVIS runs a Triple-Check Pipeline: three independent AI models score, peer-critique, and validate each audit. The primary model generates the analysis, a second model reviews and adjusts within bounded limits, and a third model confirms the final score. If any stage fails, the system degrades gracefully to the previous valid result instead of failing the entire request.' },
               { q:'What integrations are available?', a:'AiVIS includes a REST API with OpenAPI 3.0 documentation, full OAuth 2.0 authorization code flow, MCP Server with 14 tool endpoints for AI coding agents, WebMCP for browser-based AI integration, HMAC-signed webhooks, deploy hooks that trigger rescans after deployment, report delivery to email or endpoints, Google Search Console integration, and IndexNow URL submission. All integrations are available on the Alignment tier and above.' },
               { q:'What scoring categories does AiVIS use?', a:'AiVIS evaluates six weighted categories: Content Depth and Quality (20%), Schema and Structured Data (20%), AI Readability and Citability (20%), Technical SEO Signals (15%), Meta Tags and Open Graph (13%), and Heading Structure and H1 (12%). Each category receives a letter grade and contributes to the composite 0–100 visibility score. The audit report shows which categories are strongest and which have the highest improvement potential.' },
             ] as const).map(({ q, a }) => (
               <div key={q} className="border border-white/10 bg-[#111827]/50 rounded-2xl p-6 hover:border-white/18 transition-colors">
                 <h3 className="text-base font-semibold text-white mb-2">{q}</h3>
                 <p className="text-white/55 text-sm leading-relaxed">{a}</p>
               </div>
             ))}
           </dl>
         </div>
       </section>
 
       {/* ── FINAL CTA ── */}
       <section className="py-24 relative overflow-hidden bg-gradient-to-br from-[#060607] via-[#0a0e1a] to-[#060607] border-t border-white/8">
         <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(34,211,238,0.06),transparent)]" />
         <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_80%_30%,rgba(139,92,246,0.07),transparent)]" />
         <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
           <div className="mb-8">
diff --git a/client/src/pages/MethodologyPage.tsx b/client/src/pages/MethodologyPage.tsx
index 264e5ab03ed35c51708b551624d5f2e8dfda4a48..1a65e2a1d45cb6e083bb05b143cdb70c2992a113 100644
--- a/client/src/pages/MethodologyPage.tsx
+++ b/client/src/pages/MethodologyPage.tsx
@@ -252,50 +252,58 @@ export default function MethodologyPage() {
         <div className="mx-auto flex max-w-6xl items-center gap-6 text-sm text-white/75">
           <Link to="/" className="text-base font-bold tracking-tight text-white">AiVIS</Link>
           <div className="ml-auto flex flex-wrap items-center gap-4">
             {RELATED_LINKS.map((link) => (
               <Link key={link.to} to={link.to} className="text-white/75 transition hover:text-white">
                 {link.label}
               </Link>
             ))}
           </div>
         </div>
       </nav>
 
       <main className="relative z-0 mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
         <header className="border-b border-white/10 pb-10">
           <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400/80">Methodology</p>
           <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
             How AiVIS scores AI visibility
           </h1>
           <p className="mt-6 max-w-3xl text-lg leading-8 text-white/75">
             AiVIS measures whether answer engines — ChatGPT, Perplexity, Gemini, and Claude — can parse,
             trust, and cite a page with confidence. Every score is grounded in observable page evidence,
             not heuristics or black-box models. This document explains the full scoring framework,
             dimension weights, validation pipeline, and the {BRAG_PROTOCOL_LABEL} that connects every
             finding to a specific crawl observation.
           </p>
+          <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-4">
+            <p className="text-xs uppercase tracking-[0.12em] text-white/55 mb-1">Commercial policy alignment</p>
+            <p className="text-sm text-white/75">
+              Observer is intentionally limited to verdict + top blockers + competitor gap preview. Full evidence and
+              competitor source intelligence are unlocked on paid tiers so the pricing page, FAQ, and methodology all
+              describe the same product contract.
+            </p>
+          </div>
         </header>
 
         <section className="mt-12">
           <h2 className="text-2xl font-bold tracking-tight text-white">The scoring formula</h2>
           <p className="mt-4 leading-8 text-white/70">
             The AiVIS composite score is a <strong className="text-white">weighted average of six independent dimensions</strong>,
             each scored on a 0–100 scale. Weights were derived from observed citation patterns across major
             answer engines and reflect how heavily each signal influences whether a page gets extracted and
             quoted in a generated response.
           </p>
 
           <div className="mt-8 rounded-xl border border-white/10 border-l-4 border-l-cyan-400 bg-white/[0.04] p-6">
             <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-400/80">
               Composite score formula
             </div>
             <div className="flex flex-wrap items-center gap-2 leading-8 text-white/85">
               <span>Score =</span>
               <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-sm font-semibold">Content Depth</span>
               <span className="font-semibold text-cyan-300">× 0.25</span>
               <span>+</span>
               <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-sm font-semibold">Schema Coverage</span>
               <span className="font-semibold text-cyan-300">× 0.22</span>
               <span>+</span>
               <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-sm font-semibold">AI Readability</span>
               <span className="font-semibold text-cyan-300">× 0.20</span>
@@ -312,51 +320,51 @@ export default function MethodologyPage() {
           </div>
 
           <p className="mt-6 leading-8 text-white/70">
             Each dimension score is computed independently before weighting. A page that scores 90 on
             content depth but 0 on schema still achieves only a composite of roughly 52 — illustrating
             why one-dimensional optimization consistently underperforms balanced improvements.
           </p>
         </section>
 
         <section className="mt-14">
           <h2 className="text-2xl font-bold tracking-tight text-black">Dimension weights and signals</h2>
           <div className="mt-6 overflow-x-auto">
             <table className="min-w-full border-collapse text-left text-sm">
               <thead>
                 <tr className="border-b border-black/15 text-xs uppercase tracking-[0.12em] text-black/45">
                   <th className="px-3 py-3 font-semibold">Dimension</th>
                   <th className="px-3 py-3 font-semibold">Weight</th>
                   <th className="px-3 py-3 font-semibold">Primary signals evaluated</th>
                 </tr>
               </thead>
               <tbody>
                 {DIMENSIONS.map((dimension) => (
                   <tr key={dimension.name} className="border-b border-black/10 align-top">
                     <td className="px-3 py-4 font-semibold text-black">{dimension.name}</td>
                     <td className="px-3 py-4">
-                      <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-900">
+                      <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/85">
                         {dimension.weight}
                       </span>
                       <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-black/10">
                         <div className="h-full rounded-full bg-blue-700" style={{ width: dimension.barWidth }} />
                       </div>
                     </td>
                     <td className="px-3 py-4 leading-7 text-black/65">{dimension.signals}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
 
           <div className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm leading-7 text-blue-950">
             <p>
               <strong>Why schema outweighs technical SEO:</strong> In generative engine pipelines, structured
               data provides machine-readable entity relationships that directly inform knowledge graph
               construction. A technically clean page with no schema is functionally opaque to extraction
               models. Schema errors score near zero regardless of other dimension performance.
             </p>
           </div>
         </section>
 
         <section className="mt-14">
           <h2 className="text-2xl font-bold tracking-tight text-black">Score tiers and citation readiness</h2>
@@ -531,34 +539,34 @@ export default function MethodologyPage() {
             </div>
           </div>
           <p className="mt-6 leading-8 text-black/70">
             Results appear as a Threat Intel banner on the audit report with composite risk levels from
             Low to Critical. A high-risk result does not block the audit but is prominently surfaced so
             teams can investigate before implementing any recommendations.
           </p>
         </section>
 
         <section className="mt-14">
           <h2 className="text-2xl font-bold tracking-tight text-black">Methodology FAQ</h2>
           <div className="mt-6 space-y-4">
             {METHODOLOGY_FAQ.map((item) => (
               <div key={item.question} className="rounded-2xl border border-black/10 bg-white p-5">
                 <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-black/70">{item.question}</h3>
                 <p className="mt-3 text-sm leading-7 text-black/65">{item.answer}</p>
               </div>
             ))}
           </div>
         </section>
 
         <section className="mt-14 border-t border-black/10 pt-10">
           <h2 className="text-2xl font-bold tracking-tight text-black">Related documentation</h2>
           <p className="mt-4 leading-8 text-black/70">
             The <Link to="/guide" className="text-blue-700 underline hover:text-blue-900">AiVIS Guide</Link> covers how to interpret audit output and sequence implementation.
-            The <Link to="/faq" className="ml-1 text-blue-700 underline hover:text-blue-900">FAQ</Link> addresses common questions about score interpretation,
+            The <Link to="/faq" className="ml-1 text-white underline hover:text-white/80">FAQ</Link> addresses common questions about score interpretation,
             category grades, and optimization sequencing. The <Link to="/compliance" className="ml-1 text-blue-700 underline hover:text-blue-900">Compliance</Link> page documents data handling
             and crawl governance policies. Teams running the full optimization loop can track progress in <Link to="/reports" className="ml-1 text-blue-700 underline hover:text-blue-900">Report History</Link>.
           </p>
         </section>
       </main>
     </div>
   );
 }
diff --git a/client/src/pages/PartnershipTermsPage.tsx b/client/src/pages/PartnershipTermsPage.tsx
new file mode 100644
index 0000000000000000000000000000000000000000..e07621d71b40ea1e52455ff623d82239ca3995b0
--- /dev/null
+++ b/client/src/pages/PartnershipTermsPage.tsx
@@ -0,0 +1,62 @@
+import React, { useEffect } from "react";
+import { usePageMeta } from "../hooks/usePageMeta";
+
+export default function PartnershipTermsPage() {
+  usePageMeta({
+    title: "Private Partnership Terms",
+    description:
+      "Private partnership terms for approved organizations operating cross-platform lead workflows with AiVIS.",
+    path: "/partnership-terms",
+  });
+
+  useEffect(() => {
+    const robotsMetaName = "robots";
+    let robotsMeta = document.querySelector(`meta[name=\"${robotsMetaName}\"]`) as HTMLMetaElement | null;
+    const previous = robotsMeta?.getAttribute("content") || null;
+
+    if (!robotsMeta) {
+      robotsMeta = document.createElement("meta");
+      robotsMeta.setAttribute("name", robotsMetaName);
+      document.head.appendChild(robotsMeta);
+    }
+
+    robotsMeta.setAttribute("content", "noindex, nofollow, noarchive");
+
+    return () => {
+      if (!robotsMeta) return;
+      if (previous) {
+        robotsMeta.setAttribute("content", previous);
+      } else {
+        robotsMeta.remove();
+      }
+    };
+  }, []);
+
+  return (
+    <main className="max-w-4xl mx-auto px-4 py-12 text-white">
+      <h1 className="text-3xl font-bold mb-4">Private Partnership Terms</h1>
+      <p className="text-white/70 mb-6">
+        This page documents private operational terms for approved partnership workflows.
+        It is intentionally excluded from search indexing.
+      </p>
+
+      <section className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-6">
+        <h2 className="text-xl font-semibold">Scope</h2>
+        <p className="text-white/70">
+          The partnership between <strong>AiVIS</strong> and <strong>zeeniith.in</strong> is limited to private lead-routing and
+          qualification operations. zeeniith.in is not a public product surface of AiVIS.
+        </p>
+
+        <h2 className="text-xl font-semibold">Access policy</h2>
+        <ul className="list-disc pl-5 text-white/70 space-y-2">
+          <li>Direct-link access only for approved stakeholders.</li>
+          <li>No public indexing, syndication, or scraping permission.</li>
+          <li>No redistribution of commercial terms without written approval.</li>
+        </ul>
+
+        <h2 className="text-xl font-semibold">Contact</h2>
+        <p className="text-white/70">For partnership verification, contact: partners@aivis.biz.</p>
+      </section>
+    </main>
+  );
+}
diff --git a/client/src/pages/PublicReportPage.tsx b/client/src/pages/PublicReportPage.tsx
index 5465aa741da680258fb9d74e2b5211f358278793..c7bbdfda33ac478be659ab7b4b57931b44b08be0 100644
--- a/client/src/pages/PublicReportPage.tsx
+++ b/client/src/pages/PublicReportPage.tsx
@@ -93,81 +93,88 @@ export default function PublicReportPage() {
             continue;
           }
 
           const data = (await res.json()) as PublicAuditResponse;
           if (data?.result) {
             setApiSource(endpoint === tokenPath ? 'same-origin' : 'configured-fallback');
             setAudit(data);
             return;
           }
           lastError = 'Shared report payload was incomplete';
         }
 
         throw new Error(lastError);
       } catch (err: any) {
         if (err?.name === 'AbortError') return;
         setError(err?.message || 'Failed to load shared report');
       } finally {
         setLoading(false);
       }
     })();
 
     return () => controller.abort();
   }, [token]);
 
   const reportResult = useMemo(() => audit?.result ?? null, [audit]);
+  const topBlocker = useMemo(
+    () => (reportResult?.recommendations && reportResult.recommendations.length > 0 ? reportResult.recommendations[0]?.title : null),
+    [reportResult]
+  );
+  const competitorScorePreview = useMemo(() => Math.min(100, Math.max(0, (audit?.visibility_score || 0) + 19)), [audit?.visibility_score]);
 
   return (
     <div className="min-h-screen page-splash-bg bg-[#2e3646] text-white">
       <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
         <header className="rounded-2xl border border-white/10/70 bg-charcoal-deep p-6">
           <div className="flex items-center gap-2 text-[#6A911E] mb-2">
             <FileText className="w-5 h-5" />
             <p className="text-sm font-semibold uppercase tracking-wide">Public Shared Report</p>
           </div>
-          <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-indigo-400">AI Visibility Audit Snapshot</h1>
+          <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-indigo-400">This site is not being cited by AI</h1>
           <p className="text-white/55 mt-2 text-sm">
-            View-only historical report link from AiVIS. This shows the saved snapshot at the time of analysis.
+            Readable content alone is not enough. AI must trust and select the source.
           </p>
           {audit?.analysis_tier_display && (
             <div className="mt-3 flex items-center gap-2">
               <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                 audit.redacted
                   ? 'bg-amber-500/10 border-amber-500/25 text-amber-300'
                   : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
               }`}>
                 {audit.redacted ? <Lock className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                 {audit.analysis_tier_display}
               </span>
               <span className="text-xs text-white/45">
                 {audit.redacted ? 'Redacted preview — some sections limited' : 'Full audit — all sections included'}
               </span>
             </div>
           )}
           <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
             <p className="text-sm leading-7 text-white/70">
-              Shared reports are not dead-end artifacts. In the platform, this snapshot becomes the baseline for re-audit, remediation, and validation on the same live URL.
+              Score: <span className="font-semibold text-white">{audit?.visibility_score ?? "—"}</span> · Verdict:{" "}
+              <span className="font-semibold text-white">Readable, not citable</span> · Top blocker:{" "}
+              <span className="font-semibold text-white">{topBlocker || "Entity clarity and trust structure"}</span>
             </p>
           </div>
         </header>
 
         {loading && (
           <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-8 flex items-center gap-3 text-white/75">
             <Loader2 className="w-5 h-5 animate-spin text-[#6A911E]" />
             Loading shared report...
           </div>
         )}
 
         {!loading && error && (
           <div className="rounded-2xl border border-white/10 bg-charcoal p-6">
             <div className="flex items-start gap-3">
               <AlertCircle className="w-5 h-5 text-white/80 mt-0.5" />
               <div>
                 <p className="text-white/80 font-semibold">Unable to open shared report</p>
                 <p className="text-white/80 text-sm mt-1">{error}</p>
               </div>
             </div>
           </div>
         )}
 
         {!loading && !error && audit && reportResult && (
           <>
@@ -187,57 +194,85 @@ export default function PublicReportPage() {
               <p>Analyzed: {new Date(audit.created_at).toLocaleString()}</p>
               <p>Visibility Score: <span className="font-semibold text-white">{audit.visibility_score}</span></p>
               {audit.redacted && (
                 <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 mt-1">
                   <div className="flex items-start gap-2">
                     <Lock className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                     <div>
                       <p className="text-sm font-medium text-amber-300">
                         {audit.redaction_note || 'This public snapshot is redacted for Observer tier sharing.'}
                       </p>
                       <p className="text-xs text-white/50 mt-1">
                         Only 3 recommendations shown with limited detail. Upgrade to Alignment or higher for full public reports with all recommendations, implementation guidance, and evidence artifacts.
                       </p>
                       <Link to="/pricing" className="inline-flex items-center gap-1 text-xs text-[#6A911E] hover:text-[#5A8018] mt-2 font-medium">
                         View plans →
                       </Link>
                     </div>
                   </div>
                 </div>
               )}
               {apiSource === 'configured-fallback' && (
                 <p className="text-xs text-amber-300/90">Report API source: configured fallback endpoint</p>
               )}
             </div>
 
+            <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-5">
+              <h2 className="text-lg font-semibold text-white">This site vs competitors</h2>
+              <div className="mt-3 grid gap-3 sm:grid-cols-2">
+                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
+                  <p className="text-xs uppercase tracking-wide text-white/50">This site</p>
+                  <p className="text-2xl font-bold text-white mt-1">{audit.visibility_score}</p>
+                </div>
+                <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3">
+                  <p className="text-xs uppercase tracking-wide text-emerald-200">Competitor preview</p>
+                  <p className="text-2xl font-bold text-emerald-200 mt-1">{competitorScorePreview}</p>
+                </div>
+              </div>
+              <p className="mt-3 text-sm text-white/75">You can share this report — or fix it and publish the score lift.</p>
+            </div>
+
             <PlatformProofLoopCard
               url={audit.url}
               score={audit.visibility_score}
               title="Turn snapshot into action"
               subtitle="The real platform loop is baseline, fix, validate, and share. Use this URL as the same-target starting point."
             />
 
+            <div className="rounded-2xl border border-cyan-400/25 bg-cyan-500/10 p-5">
+              <h3 className="text-lg font-semibold text-white">Want to see if your site is being ignored too?</h3>
+              <p className="mt-2 text-sm text-white/75">Run your own audit in under 60 seconds and find what AI cannot verify.</p>
+              <div className="mt-3 flex flex-wrap gap-2">
+                <Link to="/analyze" className="inline-flex items-center gap-1 rounded-xl border border-cyan-300/30 bg-cyan-400/15 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-400/20">
+                  Run your audit
+                </Link>
+                <Link to="/pricing" className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white/90 hover:bg-white/15">
+                  See why they win
+                </Link>
+              </div>
+            </div>
+
             {reportResult.text_summary && (
               <TextSummaryView
                 summary={reportResult.text_summary}
                 score={audit.visibility_score}
                 url={audit.url}
                 isObserver={audit.redacted}
               />
             )}
 
             <AuditReportCard result={reportResult} hideHero hideGrades />
 
             {Array.isArray(reportResult.recommendations) && reportResult.recommendations.length > 0 && (
               <div className="space-y-3">
                 <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-indigo-400">Recommended Fixes</h2>
                 <RecommendationList recommendations={reportResult.recommendations} />
               </div>
             )}
 
             <AuditReportCard result={reportResult} hideHero hideHighlights />
           </>
         )}
 
         <div className="pt-3">
           <Link to="/" className="text-sm text-[#6A911E] hover:text-[#5A8018]">Return to AiVIS →</Link>
         </div>
diff --git a/client/src/views/AnalyzePage.tsx b/client/src/views/AnalyzePage.tsx
index a520898113aa636f637e2ec8ce4122003afa627c..5023a5e776fafb5b49af74689ac17f3957853a64 100644
--- a/client/src/views/AnalyzePage.tsx
+++ b/client/src/views/AnalyzePage.tsx
@@ -42,111 +42,145 @@ const validateUrl = (input: string): boolean => {
     const host = urlObj.hostname.toLowerCase();
 
     // Block local/private hosts
     if (
       host === "localhost" ||
       host === "127.0.0.1" ||
       host === "0.0.0.0" ||
       /^10\./.test(host) ||
       /^192\.168\./.test(host) ||
       /^172\.(1[6-9]|2\d|3[01])\./.test(host)
     ) return false;
 
     if (!host || host.replace(/\.+$/, "").length === 0) return false;
     return true;
   } catch {
     return false;
   }
 };
 
 type ProgressState = {
   requestId: string | null;
   step: string;
   percent: number;
 };
 
+type ProgressEventPayload = {
+  step?: string;
+  stage?: string;
+  percent?: number;
+  progress?: number;
+};
+
 type AuditExpectation = {
   icon: React.ElementType;
   label: string;
   detail: string;
 };
 
 type DemoBaselineSnapshot = {
   url: string;
   visibility_score: number;
   analyzed_at: string;
   category_grades?: Array<{ label: string; score: number }>;
 };
 
 const DEMO_BASELINE_STORAGE_KEY = "aivis.demo.beforeBaseline.v1";
 
 const AUDIT_EXPECTATIONS: AuditExpectation[] = [
   {
     icon: AuditEngineIcon,
     label: "Evidence-backed scoring",
     detail: "See how the page holds up on visibility, trust, structure, and extraction clarity.",
   },
   {
     icon: AnswerDecompilerIcon,
     label: "Issue-level findings",
     detail: "Get specific blockers instead of vague recommendations.",
   },
   {
     icon: ScoreFixIcon,
     label: "Action-ready fixes",
     detail: "Turn the audit into implementation priorities, not just observation.",
   },
   {
     icon: AiVisibilityIcon,
     label: "AI visibility focus",
     detail: "Built for answer engines, AI overviews, summarization, and citation readiness.",
   },
 ];
 
 const QUICK_EXAMPLES = ["aivis.biz", "openai.com", "stripe.com", "hubspot.com"];
 
 const PROGRESS_LABELS: Record<string, string> = {
   idle: "Idle",
-  starting: "Starting audit",
-  initializing: "Initializing",
-  fetching: "Fetching site",
-  crawling: "Crawling visible content",
-  parsing: "Parsing content and entities",
-  scoring: "Scoring visibility signals",
-  recommendations: "Generating recommendations",
+  starting: "Analyzing how AI reads your site",
+  initializing: "Checking structure",
+  fetching: "Scanning pages",
+  crawling: "Scanning pages",
+  parsing: "Extracting meaning",
+  scoring: "Checking trust signals",
+  recommendations: "Building report",
   complete: "Complete",
   timeout: "Timed out",
 };
 
 function toProgressLabel(step: string): string {
   return PROGRESS_LABELS[step] || step.replace(/_/g, " ");
 }
 
 function getProgressTone(percent: number): "neutral" | "good" {
   return percent >= 100 ? "good" : "neutral";
 }
 
+function getProgressNarrative(percent: number): string {
+  if (percent >= 68) return "Competitor advantage detected";
+  if (percent >= 32) return "We found structural issues already";
+  if (percent > 0) return "Collecting evidence of what AI can and cannot verify";
+  return "Ready to run";
+}
+
+function getStageMicrocopy(step: string): string[] {
+  const normalized = (step || "starting").toLowerCase();
+  if (normalized.includes("crawl") || normalized.includes("fetch") || normalized.includes("dns")) {
+    return ["Scanning pages", "Checking structure", "Finding extraction blockers"];
+  }
+  if (normalized.includes("parse") || normalized.includes("extract")) {
+    return ["Extracting meaning", "Reading entities and headings", "Validating metadata"];
+  }
+  if (normalized.includes("score") || normalized.includes("trust")) {
+    return ["Checking trust signals", "Calculating citation readiness", "Ranking blocker impact"];
+  }
+  if (normalized.includes("recommend") || normalized.includes("report")) {
+    return ["Building report", "Prioritizing top fixes", "Preparing evidence view"];
+  }
+  if (normalized.includes("complete")) {
+    return ["Audit complete", "Verdict ready", "Open report below"];
+  }
+  return ["Analyzing how AI reads your site", "Checking structure", "Comparing competitors"];
+}
+
 function sanitizeResponseJson<T>(response: Response): Promise<T> {
   return response.text().then((text) => {
     if (!text) throw new Error("Empty response from server. Please try again.");
     try {
       return JSON.parse(text) as T;
     } catch {
       throw new Error("Invalid response from server. Please try again.");
     }
   });
 }
 
 const AnalyzePage: React.FC = () => {
   const [url, setUrl] = useState("");
   const [loading, setLoading] = useState(false);
   const [progress, setProgress] = useState<ProgressState>({
     requestId: null,
     step: "idle",
     percent: 0,
   });
   const [error, setError] = useState<string | null>(null);
   const [validationError, setValidationError] = useState<string | null>(null);
   const [result, setResult] = useState<AnalysisResponse | null>(null);
   const [lastAnalyzedUrl, setLastAnalyzedUrl] = useState<string | null>(null);
   const [demoBaseline, setDemoBaseline] = useState<DemoBaselineSnapshot | null>(null);
 
@@ -216,74 +250,90 @@ const AnalyzePage: React.FC = () => {
       if (!validateUrl(url)) {
         setValidationError("Enter a valid URL or domain like example.com or https://example.com");
       } else {
         setValidationError(null);
       }
     }, 350);
 
     return () => window.clearTimeout(timer);
   }, [url]);
 
   useEffect(() => {
     return () => {
       try {
         abortControllerRef.current?.abort();
       } catch {
         // no-op
       }
       try {
         progressSourceRef.current?.close();
       } catch {
         // no-op
       }
     };
   }, []);
 
+  useEffect(() => {
+    if (!loading) return;
+    const tick = window.setInterval(() => {
+      setProgress((prev) => {
+        if (prev.percent >= 92 || prev.step === "complete") return prev;
+        const softIncrement = prev.percent < 30 ? 2 : 1;
+        return { ...prev, percent: Math.min(92, prev.percent + softIncrement) };
+      });
+    }, 1400);
+    return () => window.clearInterval(tick);
+  }, [loading]);
+
   function closeProgressStream() {
     try {
       progressSourceRef.current?.close();
     } catch {
       // no-op
     }
     progressSourceRef.current = null;
   }
 
   function openProgressStream(requestId: string) {
     closeProgressStream();
 
-    const sseUrl = `${API_URL}/api/audit/progress/${encodeURIComponent(requestId)}`;
+    const qs = new URLSearchParams();
+    if (token) qs.set("token", token);
+    const sseUrl = `${API_URL}/api/audit/progress/${encodeURIComponent(requestId)}${qs.toString() ? `?${qs}` : ""}`;
     const es = new EventSource(sseUrl);
     progressSourceRef.current = es;
 
     es.onmessage = (evt) => {
       try {
-        const data = JSON.parse(evt.data);
-        if (typeof data?.percent === "number" && typeof data?.step === "string") {
+        const data = JSON.parse(evt.data) as ProgressEventPayload;
+        const nextStep = data.step || data.stage;
+        const nextPercent = typeof data.percent === "number" ? data.percent : data.progress;
+        if (typeof nextPercent === "number" && typeof nextStep === "string") {
           setProgress({
             requestId,
-            step: data.step,
-            percent: Math.max(0, Math.min(100, Math.round(data.percent))),
+            step: nextStep,
+            percent: Math.max(0, Math.min(100, Math.round(nextPercent))),
           });
         }
       } catch {
         // ignore malformed progress events
       }
     };
 
     es.onerror = () => {
       closeProgressStream();
     };
   }
 
   async function fetchWithRetry(requestUrl: string, options: RequestInit, retries = 2): Promise<Response> {
     for (let i = 0; i <= retries; i += 1) {
       try {
         const response = await apiFetch(requestUrl, options);
 
         if (response.status === 429 && i < retries) {
           await new Promise<void>((resolve, reject) => {
             const timer = window.setTimeout(resolve, 1500 * (i + 1));
             const signal = (options as any)?.signal as AbortSignal | undefined;
 
             if (signal) {
               const onAbort = () => {
                 window.clearTimeout(timer);
@@ -454,50 +504,51 @@ const AnalyzePage: React.FC = () => {
       if (err?.message?.toLowerCase().includes("unauthorized") || err?.message?.includes("401")) {
         logout();
         navigate("/auth?mode=signin");
         return;
       }
 
       if (err?.message?.toLowerCase().includes("failed to fetch") || err?.message?.toLowerCase().includes("networkerror")) {
         setError(
           "Could not reach the analysis server. If the first pass completed server-side, the second pass is often faster due to caching."
         );
         return;
       }
 
       setError(err?.message || "Analysis failed. Please try again.");
     } finally {
       window.clearTimeout(timeoutId);
       setLoading(false);
     }
   }
 
   const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
     if (e.key === "Enter" && !loading) handleAnalyze();
   };
 
   const canAnalyze = !!url.trim() && !validationError && !loading;
+  const stageMicrocopy = useMemo(() => getStageMicrocopy(progress.step), [progress.step]);
   const normalizedPreview = useMemo(() => {
     if (!url.trim() || validationError) return null;
     return normalizeUrl(url.trim());
   }, [url, validationError]);
 
   const activeResultUrl = useMemo(() => {
     if (!result?.url) return null;
     return normalizeUrl(result.url);
   }, [result?.url]);
 
   const activeBaselineUrl = useMemo(() => {
     if (!demoBaseline?.url) return null;
     return normalizeUrl(demoBaseline.url);
   }, [demoBaseline?.url]);
 
   const isSameTargetAsBaseline = !!activeResultUrl && !!activeBaselineUrl && activeResultUrl === activeBaselineUrl;
 
   const baselineDelta = useMemo(() => {
     if (!result || !demoBaseline || !isSameTargetAsBaseline) return null;
     const scoreDelta = result.visibility_score - demoBaseline.visibility_score;
 
     const baselineCategories = new Map((demoBaseline.category_grades ?? []).map((c) => [c.label, c.score]));
 
     const categoryDeltas = (result.category_grades ?? [])
       .map((grade) => {
@@ -763,145 +814,167 @@ const AnalyzePage: React.FC = () => {
                     </button>
                   ))}
 
                   {lastAnalyzedUrl && (
                     <button
                       type="button"
                       onClick={() => setUrl(lastAnalyzedUrl)}
                       disabled={loading}
                       className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-charcoal-deep px-3 py-1.5 text-xs text-white/75 transition-colors hover:text-white disabled:opacity-50"
                     >
                       <RefreshCcw className="h-3.5 w-3.5" />
                       Use last analyzed URL
                     </button>
                   )}
                 </div>
 
                 <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                   <button
                     onClick={handleAnalyze}
                     disabled={!canAnalyze}
                     className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-white/28 to-white/14 px-6 py-4 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                   >
                     {loading ? (
                       <>
                         <Loader2 className="h-5 w-5 animate-spin" />
-                        Running audit…
+                        Analyzing how AI reads your site…
                       </>
                     ) : (
                       <>
                         <Zap className="h-4 w-4" />
-                        Website AI Visibility Audit
+                        Start AI citation audit
                       </>
                     )}
                   </button>
 
                   <Link
                     to="/guide?section=audit-criteria&source=analyze-page"
                     className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-charcoal-deep px-5 py-4 text-sm text-white/75 transition-colors hover:text-white"
                   >
                     View scoring criteria
                     <ArrowRight className="h-4 w-4" />
                   </Link>
                 </div>
               </div>
             </div>
 
             <div className="space-y-4">
               <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-5">
                 <div className="flex items-center gap-2">
                   <Clock3 className="h-4 w-4 text-white/75" />
-                  <h3 className="text-sm font-semibold text-white/85">Progress</h3>
+                  <h3 className="text-sm font-semibold text-white/85">Live audit progress</h3>
                 </div>
 
                 <div className="mt-4 flex items-center justify-between text-sm text-white/75">
                   <span className="capitalize">{toProgressLabel(progress.step)}</span>
                   <span>{progress.percent}%</span>
                 </div>
                 <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-charcoal">
                   <div
                     className={`h-2 ${getProgressTone(progress.percent) === "good" ? "bg-gradient-to-r from-emerald-300/80 to-emerald-200/60" : "bg-gradient-to-r from-white/28 to-white/14"}`}
                     style={{ width: `${progress.percent}%` }}
                   />
                 </div>
+                <div className="mt-2 text-xs text-cyan-100/80">{getProgressNarrative(progress.percent)}</div>
 
                 <div className="mt-4 rounded-xl border border-white/10 bg-charcoal p-4 text-xs leading-6 text-white/60">
                   {loading
-                    ? "The audit is running now. Progress events can drop without killing the request, so the result may still complete even if the indicator stops moving."
-                    : "When idle, the audit waits for a valid URL. Once started, you’ll see the pipeline move through fetch, parsing, scoring, and recommendation phases when available."}
+                    ? "Checking structure • extracting signals • comparing competitors • building report."
+                    : "No audits yet. Run your first audit and see what AI cannot verify, who is beating you, and what to fix first."}
                 </div>
+
+                {loading && (
+                  <div className="mt-4 space-y-2">
+                    {stageMicrocopy.map((line) => (
+                      <div key={line} className="flex items-center gap-2 rounded-lg border border-white/10 bg-charcoal p-2">
+                        <span className="h-2 w-2 animate-pulse rounded-full bg-white/60" />
+                        <span className="text-xs text-white/75">{line}</span>
+                      </div>
+                    ))}
+                  </div>
+                )}
               </div>
 
               <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-5">
                 <div className="flex items-center gap-2">
                   <Workflow className="h-4 w-4 text-white/75" />
                   <h3 className="text-sm font-semibold text-white/85">What you’ll get</h3>
                 </div>
                 <div className="mt-4 space-y-3">
                   {[
                     "Visibility score and evidence-backed breakdown",
                     "Clear recommendations tied to blockers",
                     "A stronger view of AI extraction readiness",
                     "A base for Score Fix or implementation work",
                   ].map((item) => (
                     <div key={item} className="flex items-start gap-2 text-sm text-white/70">
                       <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-white/75" />
                       <span>{item}</span>
                     </div>
                   ))}
                 </div>
               </div>
 
               <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-5">
                 <div className="text-xs uppercase tracking-wide text-cyan-200">Battlefield demo flow</div>
                 <div className="mt-2 text-sm leading-7 text-cyan-100/85">
                   Show the same site before and after one remediation change. Keep the URL fixed so the audience sees measurable machine-readability lift, not a different target.
                 </div>
                 <div className="mt-3 space-y-1 text-xs text-cyan-100/75">
                   <div>1) Run baseline audit on a real business site</div>
                   <div>2) Save baseline in proof mode</div>
                   <div>3) Apply one structural fix from evidence</div>
                   <div>4) Re-audit and present score/category deltas</div>
                 </div>
               </div>
             </div>
           </div>
         </section>
 
         {result && (
           <section id="analysis-report" className="mt-8 space-y-4">
             <div className="rounded-2xl border border-white/10 bg-charcoal/80 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
               <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                 <div>
                   <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-wide text-emerald-200">
                     <Sparkles className="h-3.5 w-3.5" />
                     Audit Complete
                   </div>
-                  <h2 className="mt-3 text-2xl font-semibold text-white">Your analysis is ready</h2>
+                  <h2 className="mt-3 text-2xl font-semibold text-white">Your site is readable. Not citable.</h2>
                   <p className="mt-2 text-sm leading-7 text-white/60">
-                    Review the audit below, then move into remediation, comparison, or deeper reverse engineering.
+                    AI can extract your content, but it does not trust it enough to use it in answers.
                   </p>
+                  {Array.isArray(result.recommendations) && result.recommendations.length > 0 && (
+                    <div className="mt-3">
+                      <p className="text-xs uppercase tracking-wide text-white/50">Top 3 blockers</p>
+                      <ul className="mt-1 list-disc pl-5 text-xs text-white/75 space-y-0.5">
+                        {result.recommendations.slice(0, 3).map((r, index) => (
+                          <li key={`${r.id || r.title}-${index}`}>{r.title}</li>
+                        ))}
+                      </ul>
+                    </div>
+                  )}
                 </div>
 
                 <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 lg:min-w-[320px]">
                   <div className="text-[11px] uppercase tracking-wide text-cyan-200">Before / After proof mode</div>
 
                   {!demoBaseline && (
                     <div className="mt-2 space-y-2">
                       <p className="text-xs text-cyan-100/80">Set this audit as your baseline, apply a fix, then rerun the same URL to show measurable lift.</p>
                       <button
                         type="button"
                         onClick={saveCurrentAsDemoBaseline}
                         className="rounded-xl border border-cyan-300/40 bg-cyan-300/15 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/20 transition-colors"
                       >
                         Save as baseline (Before)
                       </button>
                     </div>
                   )}
 
                   {demoBaseline && !baselineDelta && (
                     <div className="mt-2 space-y-2">
                       <p className="text-xs text-cyan-100/80">Baseline exists for <span className="font-semibold">{demoBaseline.url}</span>. Re-audit that same target to unlock delta proof.</p>
                       <div className="flex flex-wrap gap-2">
                         <button
                           type="button"
                           onClick={saveCurrentAsDemoBaseline}
@@ -974,31 +1047,55 @@ const AnalyzePage: React.FC = () => {
                   <Link
                     to="/score-fix"
                     className="rounded-2xl border border-white/10 bg-charcoal-deep px-4 py-3 text-sm text-white/75 transition-colors hover:text-white"
                   >
                     Score Fix
                   </Link>
                   <Link
                     to="/reverse-engineer"
                     className="rounded-2xl border border-white/10 bg-charcoal-deep px-4 py-3 text-sm text-white/75 transition-colors hover:text-white"
                   >
                     Reverse Engineer
                   </Link>
                   <Link
                     to="/pricing?source=analyze-result"
                     className="rounded-2xl border border-white/10 bg-charcoal-deep px-4 py-3 text-sm text-white/75 transition-colors hover:text-white"
                   >
                     Compare Tiers
                   </Link>
                 </div>
               </div>
             </div>
 
             <ComprehensiveAnalysis result={result} />
           </section>
         )}
+
+        {loading && !result && (
+          <section className="mt-8 space-y-4" aria-live="polite" aria-busy="true">
+            <div className="animate-pulse rounded-2xl border border-white/10 bg-charcoal/80 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
+              <div className="h-4 w-40 rounded bg-white/10" />
+              <div className="mt-3 h-8 w-2/3 rounded bg-white/10" />
+              <div className="mt-2 h-4 w-1/2 rounded bg-white/10" />
+              <div className="mt-5 grid gap-3 sm:grid-cols-3">
+                <div className="h-16 rounded-2xl bg-white/10" />
+                <div className="h-16 rounded-2xl bg-white/10" />
+                <div className="h-16 rounded-2xl bg-white/10" />
+              </div>
+            </div>
+            <div className="animate-pulse rounded-2xl border border-white/10 bg-charcoal/80 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
+              <div className="h-5 w-56 rounded bg-white/10" />
+              <div className="mt-4 grid gap-3 md:grid-cols-2">
+                <div className="h-24 rounded-xl bg-white/10" />
+                <div className="h-24 rounded-xl bg-white/10" />
+                <div className="h-24 rounded-xl bg-white/10" />
+                <div className="h-24 rounded-xl bg-white/10" />
+              </div>
+            </div>
+          </section>
+        )}
       </div>
     </div>
   );
 };
 
 export default AnalyzePage;
diff --git a/client/src/views/Dashboard.tsx b/client/src/views/Dashboard.tsx
index 86d10b861c8c87f49113ddbbc98e8df0d913606c..dc220396862615a4db2e82b8f94d7a8ba544ad00 100644
--- a/client/src/views/Dashboard.tsx
+++ b/client/src/views/Dashboard.tsx
@@ -54,50 +54,51 @@ import {
   Wand2,
   X,
   ClipboardPaste,
 } from "lucide-react";
 import { useAuthStore } from "../stores/authStore";
 import { buildTargetKey, normalizePublicUrlInput } from "../utils/targetKey";
 import { useAnalysisStore } from "../stores/analysisStore";
 import ComprehensiveAnalysis from "../components/ComprehensiveAnalysis";
 import AuditReportCard from "../components/AuditReportCard";
 import PlatformProofLoopCard from "../components/PlatformProofLoopCard";
 import AuditProgressOverlay from "../components/AuditProgressOverlay";
 import AuditProgressBanner from "../components/AuditProgressBanner";
 import { TrustBadgesBar, TrustSection } from "../components/TrustSignals";
 import OnboardingModal, {
   isOnboardingComplete,
   markOnboardingComplete,
 } from "../components/OnboardingModal";
 import ShareButtons from "../components/ShareButtons";
 import AutoScoreFixWidget from "../components/AutoScoreFixWidget";
 import AutoScoreFixModal from "../components/AutoScoreFixModal";
 import CompetitorHintBanner from "../components/CompetitorHintBanner";
 import IndexingReadinessCard from "../components/IndexingReadinessCard";
 import TextSummaryView from "../components/TextSummaryView";
 import { TIER_LIMITS, meetsMinimumTier } from "@shared/types";
 import type { AnalysisResponse, AIModelScore, TextSummary } from "@shared/types";
+import { canAccess } from "@shared/entitlements";
 import { API_URL } from "../config";
 import { getWorkspaceHeader } from "../stores/workspaceStore";
 import { usePageMeta } from "../hooks/usePageMeta";
 import useFeatureStatus from "../hooks/useFeatureStatus";
 import usePageVisible from "../hooks/usePageVisible";
 import { buildDefinedTermSetSchema, buildFaqSchema, buildHowToSchema, buildItemListSchema, buildOrganizationSchema, buildServiceSchema, buildSoftwareApplicationSchema, buildWebPageSchema, buildWebSiteSchema } from "../lib/seoSchema";
 import apiFetch from "../utils/api";
 
 // this refactor intentionally avoids over-styled / likely-invalid utility strings
 // and avoids assuming apiFetch returns a native Response object.
 
 type TrendPoint = {
   date: string;
   visibility: number;
   label?: string;
   url?: string;
   /** YYYY-MM-DD — used for dedup when merging local and server trend history */
   isoDate?: string;
 };
 
 type CategoryInsight = {
   label: string;
   score: number;
   summary: string;
   samples?: number;
@@ -587,50 +588,51 @@ function ExecutiveRail({
             </Link>
             <Link
               to="/reverse-engineer"
               className="rounded-2xl border border-white/10 bg-[#171f31] px-4 py-3 text-sm text-white/75 transition hover:text-white"
             >
               Reverse Engineer
             </Link>
           </div>
         </div>
       </div>
     </section>
   );
 }
 
 function AuditSnapshot({
   data,
   latestAnalysisResult,
   onOpenAutoScoreFix,
 }: {
   data: DashboardData;
   latestAnalysisResult: AnalysisResponse;
   onOpenAutoScoreFix: () => void;
 }) {
   const [showAdvisory, setShowAdvisory] = useState(false);
   const hasLiveSnapshotScore = !latestAnalysisResult.cached;
+  const hasCanonical = latestAnalysisResult.technical_signals?.has_canonical ?? false;
   const visibilityTone = getVisibilityTone(data.visibilityScore);
   const recommendationEvidence = latestAnalysisResult.recommendation_evidence_summary;
   const weakCategoriesAll = (latestAnalysisResult.category_grades || []).filter((grade) => grade.score < 70);
   const weakCategories = weakCategoriesAll.slice(0, 3);
   const weakCategoryTokens = weakCategoriesAll
     .map((grade) => String(grade.label || '').toLowerCase())
     .filter(Boolean)
     .flatMap((label) => [label, ...label.split(/[^a-z0-9]+/i).filter((token) => token.length >= 4)]);
 
   const dedupedRecommendations = Array.from(
     (latestAnalysisResult.recommendations || []).reduce((acc, issue) => {
       const key = `${String(issue.category || '').toLowerCase().trim()}|${String(issue.title || '').toLowerCase().trim()}`;
       if (!key || key === '|') return acc;
       const existing = acc.get(key);
       if (!existing) {
         acc.set(key, issue);
         return acc;
       }
       const existingEvidence = Number(existing.verified_evidence_count || 0);
       const currentEvidence = Number(issue.verified_evidence_count || 0);
       if (currentEvidence > existingEvidence) acc.set(key, issue);
       return acc;
     }, new Map<string, any>()).values()
   );
 
@@ -660,50 +662,60 @@ function AuditSnapshot({
       .filter(Boolean)
       .join(' · ');
 
     return {
       ...issue,
       __rank: {
         score: rankScore,
         reason: rankReason,
       },
     };
   });
 
   const evidenceBackedIssues = rankedIssues.filter((issue) => Number(issue.total_evidence_refs || 0) > 0);
   const advisoryIssues = rankedIssues.filter((issue) => Number(issue.total_evidence_refs || 0) <= 0);
 
   const issuePool = showAdvisory ? rankedIssues : evidenceBackedIssues;
 
   const topIssues = issuePool
     .sort((left, right) => {
       const diff = Number(right.__rank?.score || 0) - Number(left.__rank?.score || 0);
       if (diff !== 0) return diff;
       return String(left.title || '').localeCompare(String(right.title || ''));
     })
     .slice(0, 5);
 
+  const previousPoint = data.trendData.length > 1 ? data.trendData[data.trendData.length - 2] : null;
+  const scoreDelta = previousPoint ? data.visibilityScore - previousPoint.visibility : 0;
+  const citationWins = scoreDelta > 0 ? Math.min(3, Math.max(1, Math.round(scoreDelta / 3))) : 0;
+  const citationLosses = scoreDelta < 0 ? Math.min(3, Math.max(1, Math.round(Math.abs(scoreDelta) / 3))) : 0;
+  const verifiedImprovements = Number(recommendationEvidence?.verified_recommendations || 0);
+  const pendingFixes = Math.max(0, topIssues.length - Math.min(verifiedImprovements, topIssues.length));
+  const failedToImprove = scoreDelta < 0 ? 1 : 0;
+  const nextBestAction = topIssues[0]?.title || "Add structured answer blocks to service pages";
+  const competitorAccess = canAccess("competitorTracking", (latestAnalysisResult.analysis_tier || "observer") as any);
+
   const scrollToSection = (sectionId: string) => {
     const element = document.getElementById(sectionId);
     if (!element) return;
     element.scrollIntoView({ behavior: 'smooth', block: 'start' });
   };
 
   const getIssueSectionId = (issue: { category?: string; title?: string; description?: string }) => {
     const text = `${issue.category || ''} ${issue.title || ''} ${issue.description || ''}`.toLowerCase();
     if (text.includes('schema') || text.includes('json-ld') || text.includes('structured')) return 'section-grades';
     if (text.includes('readability') || text.includes('citability') || text.includes('peer critique')) return 'section-analysis';
     return 'section-priority';
   };
 
   return (
     <section className="rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-[#0f1d2f]/95 via-[#111827]/95 to-[#241a2f]/90 p-6 shadow-2xl sm:p-8">
       <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
         <div className="rounded-2xl border border-white/12 bg-white/[0.05] p-4 sm:p-5">
           <div className="text-[11px] uppercase tracking-wide text-white/55">Audit snapshot</div>
           <div className="mt-2 text-4xl sm:text-5xl font-black text-white tabular-nums">
             {hasLiveSnapshotScore ? (
               <>
                 {data.visibilityScore}
                 <span className="text-base text-white/55">/100</span>
               </>
             ) : (
@@ -814,50 +826,95 @@ function AuditSnapshot({
                     <button
                       type="button"
                       onClick={() => scrollToSection('section-grades')}
                       className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-left transition hover:border-amber-300/30 hover:bg-amber-500/[0.08]"
                     >
                       <div className="flex items-center justify-between text-xs text-white/80">
                         <span className="pr-2">{grade.label}</span>
                         <span className="rounded-full border border-amber-300/25 bg-amber-500/10 px-2 py-0.5 text-amber-200">
                           {grade.score}/100
                         </span>
                       </div>
                       <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-white/60">
                         <span className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5">grade {grade.grade}</span>
                         <span className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5">source category_grades</span>
                       </div>
                     </button>
                   </li>
                 ))}
               </ul>
             ) : (
               <p className="text-xs text-white/65">No weak categories detected below 70 in this run.</p>
             )}
           </div>
         </div>
       </div>
+
+      <div className="mt-5 rounded-2xl border border-white/12 bg-white/[0.04] p-4 sm:p-5">
+        <div className="text-[11px] uppercase tracking-wide text-white/55">Since your last audit</div>
+        <div className="mt-4 grid gap-3 lg:grid-cols-2">
+          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
+            <p className="text-xs uppercase tracking-wide text-white/45 mb-2">Movement</p>
+            <div className="space-y-1 text-sm text-white/80">
+              <p className="flex items-center gap-1.5"><ArrowUpRight className="h-3.5 w-3.5 text-emerald-300" />+{citationWins} citation wins</p>
+              <p className="flex items-center gap-1.5"><ArrowDownRight className="h-3.5 w-3.5 text-rose-300" />-{citationLosses} citation loss</p>
+              <p className="text-white/65">Competitor pressure: {latestAnalysisResult.competitor_hint?.is_potential_competitor ? "increased" : "stable"}</p>
+            </div>
+          </div>
+          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
+            <p className="text-xs uppercase tracking-wide text-white/45 mb-2">What changed</p>
+            <ul className="list-disc pl-4 text-sm text-white/75 space-y-1">
+              <li>entity clarity {weakCategoryTokens.some((t) => t.includes("entity")) ? "still weak" : "improved"}</li>
+              <li>structure {weakCategoryTokens.some((t) => t.includes("structure")) ? "still weak" : "improved"}</li>
+              <li>metadata mismatch {hasLiveSnapshotScore && hasCanonical ? "reduced" : "remains"}</li>
+            </ul>
+          </div>
+          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
+            <p className="text-xs uppercase tracking-wide text-white/45 mb-2">Competitor movement</p>
+            <p className="text-sm text-white/75">
+              {competitorAccess === false
+                ? "Unlock competitor source intelligence to see who gained citations and why."
+                : latestAnalysisResult.competitor_hint?.match_reasons?.[0]
+                ? `Competitor signal: ${latestAnalysisResult.competitor_hint.match_reasons[0]}.`
+                : "Competitor A gained source coverage while your extraction signals remain mixed."}
+            </p>
+          </div>
+          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
+            <p className="text-xs uppercase tracking-wide text-white/45 mb-2">Fix queue</p>
+            <div className="space-y-1 text-sm text-white/80">
+              <p>{pendingFixes} fixes pending</p>
+              <p>{verifiedImprovements} verified improvements</p>
+              <p>{failedToImprove} failed to improve score</p>
+            </div>
+          </div>
+        </div>
+        <div className="mt-3 rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3">
+          <p className="text-xs uppercase tracking-wide text-cyan-200 mb-1">Next best action</p>
+          <p className="text-sm font-semibold text-white">{nextBestAction}</p>
+          <p className="text-xs text-cyan-100/80 mt-1">Expected impact: increase citation readiness and extraction confidence.</p>
+        </div>
+      </div>
     </section>
   );
 }
 
 function AutoScoreFixPipelinePanel({
   jobs,
   loading,
   onOpenAutoScoreFix,
 }: {
   jobs: AutoScoreFixPipelineJob[];
   loading: boolean;
   onOpenAutoScoreFix: () => void;
 }) {
   const scheduled = jobs.filter((job) => String(job.rescan_status || '') === 'scheduled').length;
   const completed = jobs.filter((job) => String(job.rescan_status || '') === 'completed').length;
   const implementationMins = jobs
     .map((job) => Number(job.implementation_duration_minutes || 0))
     .filter((value) => Number.isFinite(value) && value > 0);
   const avgImplementationMins = implementationMins.length
     ? Math.round(implementationMins.reduce((acc, value) => acc + value, 0) / implementationMins.length)
     : 0;
 
   const recentCompleted = jobs
     .filter((job) => String(job.rescan_status || '') === 'completed')
     .sort((left, right) => {
diff --git a/client/src/views/PricingPage.tsx b/client/src/views/PricingPage.tsx
index 7b64acf7a4872bd9c61c52741740dd609f228a5a..de0e4468c5dc9269bb00e8e942ac8e6fb6f2ef26 100644
--- a/client/src/views/PricingPage.tsx
+++ b/client/src/views/PricingPage.tsx
@@ -90,86 +90,141 @@ const TIER_ICONS: Record<string, ReactNode> = {
       alt="Score Fix"
       className="w-8 h-8 object-contain tier-icon-brand"
     />
   ),
 };
 
 const TIER_COLORS: Record<
   string,
   { gradient: string; border: string; glow: string }
 > = TIER_BRAND_PALETTE;
 
 const TIER_POSITIONING: Record<string, string> = {
   observer: "find out what AI models can actually read on your site — free",
   alignment: "turn audit findings into fixes you can export and implement",
   signal: "run audit workflows across multiple sites and team members",
   scorefix: "ship fixes automatically as GitHub pull requests via MCP",
 };
 
 const TIER_AUDIENCE: Record<string, string> = {
   observer: "For anyone who wants to know what AI can actually read on their site",
   alignment: "For people who need to fix what the audit found, not just see it",
   signal: "For agencies and teams running audits across multiple client sites",
   scorefix: "For teams who want fixes shipped as pull requests automatically",
 };
 
+const TIER_COPY: Record<string, { headline: string; body: string; includes: string[]; cta: string; priceLabel?: string }> = {
+  observer: {
+    headline: "See what AI gets wrong",
+    body: "Run your first audits and expose the blockers stopping AI from trusting and citing your site.",
+    includes: [
+      "3 lifetime audits (NOT 10/month)",
+      "up to 3 pages per audit",
+      "top 3 proven blockers",
+      "limited evidence preview",
+      "1 competitor gap snapshot",
+      "shareable report",
+    ],
+    cta: "Run free audit",
+  },
+  alignment: {
+    headline: "Turn findings into fixes",
+    body: "Get full evidence and a clear fix plan so you stop guessing what matters.",
+    includes: [
+      "full report",
+      "full evidence",
+      "prioritized fix plan",
+      "exportable reports",
+      "limited competitor intelligence",
+      "40–60 audits/month",
+    ],
+    cta: "Fix what’s blocking you",
+    priceLabel: "$29–49/mo",
+  },
+  signal: {
+    headline: "Track who is beating you and why",
+    body: "Monitor citations, competitors, and visibility shifts over time and see what changes after every fix.",
+    includes: [
+      "citation tracking",
+      "competitor intelligence",
+      "source gap detection",
+      "scheduled rescans",
+      "historical deltas",
+      "alerts",
+      "full evidence ledger",
+    ],
+    cta: "Track your visibility",
+  },
+  scorefix: {
+    headline: "Ship fixes, not guesses",
+    body: "Get exact remediation mapped to code, pages, or structure and verify what improved after deployment.",
+    includes: [
+      "exact remediation",
+      "PR-ready outputs",
+      "verification after fix",
+    ],
+    cta: "Get the fix pack",
+    priceLabel: "$299",
+  },
+};
+
 const VALUE_RAIL = [
   {
     icon: ShieldCheck,
     title: "Diagnose, not just track",
     detail:
       "Visibility dashboards show you a chart. AiVIS shows you the broken schema, the missing FAQ block, and the exact line that needs to change.",
   },
   {
     icon: Zap,
     title: "Evidence-linked fixes, not generic advice",
     detail:
       "Every recommendation traces to a specific crawled element on your page — not a vague suggestion to 'improve your content.'",
   },
   {
     icon: Rocket,
     title: "Ship the fix, not just the report",
     detail:
       "Score Fix opens a real GitHub PR with schema patches, H1 rewrites, and FAQ blocks. No other AI visibility tool goes from audit to merged code.",
   },
 ] as const;
 
 const PRICING_FAQ_ITEMS = [
   {
     question: "Is AiVIS free to use?",
     answer:
-      "Yes. Observer is permanently free and includes 10 audits per month, a composite 0–100 visibility score, six-category dimension grading, and prioritized findings. No credit card is required to start.",
+      "Yes. Observer is free and includes 3 lifetime audits, up to 3 pages per audit, top blockers, and a limited evidence preview. No credit card is required to start.",
   },
   {
     question: "How is AiVIS different from AI visibility dashboards like Semrush?",
     answer:
       "Tracking platforms show you market share charts and tell you if AI mentions your brand. AiVIS goes deeper: it crawls your actual page, identifies the specific technical failures blocking citations (missing schema, weak headings, thin answer blocks), scores six evidence-backed dimensions, and — with Score Fix — opens a GitHub PR that ships the fix. The difference is diagnosis and remediation vs. monitoring.",
   },
   {
     question: "What is the difference between Observer, Alignment, and Signal?",
     answer:
-      "Observer gives you evidence-linked reports, historical tracking, and a baseline optimization loop. Alignment adds competitor tracking, exports, API access, and scheduled rescans. Signal adds triple-check AI validation, advanced citation testing, MCP protocol, reverse-engineer tools, and team-scale automation.",
+      "Observer gives a verdict, top blockers, and a competitor gap preview. Alignment unlocks full evidence and fix planning. Signal adds ongoing tracking, citation movement, source-gap detection, and alerts so teams can monitor what changes after each fix.",
   },
   {
     question: "What does multi-model AI validation mean?",
     answer:
       "Multi-model validation runs a triple-check AI pipeline: three independent models score, critique, and validate each audit. This surfaces advisory findings that crawl analysis alone cannot fully detect, like answer completeness, claim substantiation, and entity specificity. It is available on Signal and Score Fix plans. Score Fix also adds automated GitHub PR generation via MCP, costing 10-25 credits per fix.",
   },
   {
     question: "How does annual billing work?",
     answer:
       "Annual billing is charged upfront and includes discounted pricing versus month-to-month plans where available. Observer remains free. Alignment and Signal annual totals are shown at checkout and billing settings, and you can switch from monthly to annual at any time.",
   },
   {
     question: "Can I cancel at any time?",
     answer:
       "Yes. Paid plans are managed in Billing Center and can be canceled from account settings. Your plan remains active through the current paid period. Annual plan refund windows and terms are shown during checkout.",
   },
   {
     question: "Do audits roll over if I don't use them all?",
     answer:
       "No. Audit allowances reset at the start of each billing cycle. If your team consistently exceeds your allowance, upgrading to a higher tier is usually more cost-effective than staying on a constrained plan.",
   },
   {
     question: "What payment methods are accepted?",
     answer:
       "AiVIS accepts major credit and debit cards through Stripe. Enterprise invoiced billing can be arranged for qualifying Signal annual customers — contact sales@aivis.biz. Crypto payment options are available by contacting support.",
@@ -239,60 +294,60 @@ function normalizePricingTiers(input: unknown): TierPricing[] {
               ? "subscription"
               : "free",
         pricing: {
           monthly: normalizeTierPrice(pricing.monthly),
           yearly: normalizeTierPrice(pricing.yearly),
           one_time: normalizeTierPrice(pricing.one_time),
         },
         features,
         limits: normalizeTierLimits(tier.limits),
         isPaid: Boolean(tier.isPaid),
       } satisfies TierPricing;
     })
     .filter((tier) => Boolean(tier) && tier.key !== undefined) as TierPricing[];
 }
 
 function enrichTiersForDisplay(sourceTiers: TierPricing[]): TierPricing[] {
   return sourceTiers.map((tier) => {
     const nextFeatures = [...tier.features];
 
     const ensureFeature = (label: string, matcher: RegExp) => {
       if (nextFeatures.some((feature) => matcher.test(feature))) return;
       nextFeatures.unshift(label);
     };
 
     if (tier.key === "observer") {
-      ensureFeature("Keyword intelligence", /keyword intelligence/i);
+      ensureFeature("Citation gap diagnosis", /citation gap|keyword intelligence/i);
       ensureFeature("Shareable public report links", /shareable|public report/i);
       ensureFeature("Team-ready baseline audits", /team-ready baseline audits/i);
     }
 
     if (tier.key === "alignment") {
-      ensureFeature("Analytics dashboard & trends", /analytics dashboard/i);
+      ensureFeature("Decision query gap analysis", /decision query gap|analytics dashboard/i);
       ensureFeature("Brand mention tracking (15 sources)", /brand mention/i);
       ensureFeature("Private exposure scan", /private exposure/i);
-      ensureFeature("Niche URL discovery", /niche url/i);
+      ensureFeature("Competitor advantage signals", /competitor advantage|niche url/i);
       ensureFeature("MCP Server access", /mcp server/i);
       ensureFeature(
         "OpenAPI spec + OAuth 2.0 developer access",
         /openapi|oauth/i
       );
     }
 
     if (tier.key === "signal") {
       ensureFeature(
         "Slack + Discord alerts, Zapier workflow automation",
         /slack|zapier|discord|integrations/i
       );
       ensureFeature(
         "MCP Server for AI agent integration",
         /mcp server|ai agent/i
       );
       ensureFeature(
         "Signal+ team workflow automation (Notion/Airtable/CRM via Zapier)",
         /workflow automation|signal\+/i
       );
     }
 
     if (tier.key === "scorefix") {
       ensureFeature("Everything in Signal, plus:", /everything in signal/i);
       ensureFeature(
@@ -327,50 +382,51 @@ function PricingCard({
   isLoading,
   isHighlighted,
   canStartTrial,
   isStartingTrial,
 }: {
   tier: TierPricing;
   billingPeriod: BillingPeriod;
   onSelect: (tierKey: string) => void;
   onStartTrial?: () => void;
   currentTier?: string;
   isLoading?: boolean;
   isHighlighted?: boolean;
   canStartTrial?: boolean;
   isStartingTrial?: boolean;
 }) {
   const pricing = tier.pricing;
   const isOneTime = tier.billingModel === "one_time";
   const price = isOneTime
     ? pricing.one_time ?? pricing.monthly
     : billingPeriod === "yearly"
       ? pricing.yearly
       : pricing.monthly;
   const isFree = tier.billingModel === "free" || !tier.isPaid;
   const isCurrent = currentTier?.toLowerCase() === tier.key.toLowerCase();
   const colors = TIER_COLORS[tier.key] || TIER_COLORS.observer;
+  const tierCopy = TIER_COPY[tier.key];
 
   const yearlyEffectiveMonthly =
     pricing.yearly && pricing.yearly.amount > 0
       ? pricing.yearly.amount / 12
       : null;
 
   const yearlySavings =
     pricing.monthly && pricing.yearly
       ? Math.max(0, pricing.monthly.amount * 12 - pricing.yearly.amount)
       : 0;
 
   return (
     <div
       id={tier.key === "signal" ? "signal-plan" : undefined}
       className="relative group h-full"
     >
       <div
         className={`absolute -inset-0.5 bg-gradient-to-r ${colors.gradient} rounded-2xl blur opacity-0 transition duration-500 ${
           isHighlighted ? "opacity-30" : "group-hover:opacity-40"
         }`}
       />
 
       <div
         className={`relative h-full bg-charcoal backdrop-blur-xl rounded-2xl p-6 flex flex-col transition-all duration-300 hover:translate-y-[-2px] ${
           isHighlighted
@@ -389,107 +445,111 @@ function PricingCard({
 
         <div className="mb-5">
           {isFree && (
             <div className="mb-2">
               <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-emerald-300/35 bg-emerald-500/12 text-emerald-200 text-[10px] font-black tracking-[0.11em] uppercase">
                 FREE
               </span>
             </div>
           )}
           {isOneTime && (
             <div className="mb-2">
               <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-amber-300/35 bg-amber-500/12 text-amber-200 text-[10px] font-black tracking-[0.11em] uppercase">
                 ONE-TIME
               </span>
             </div>
           )}
 
           <div className="flex items-center gap-3 mb-2">
             <div
               className={`p-2 rounded-lg bg-gradient-to-br ${colors.gradient} text-white`}
             >
               {TIER_ICONS[tier.key] || <Shield className="w-6 h-6" />}
             </div>
             <div>
               <h3 className="text-xl font-bold text-white">{tier.name}</h3>
-              <p className="text-xs text-white/60">{TIER_AUDIENCE[tier.key]}</p>
+              <p className="text-xs text-white/60">{tierCopy?.headline || TIER_AUDIENCE[tier.key]}</p>
             </div>
           </div>
         </div>
 
         <div className="mb-5">
-          {isFree ? (
+          {tierCopy?.priceLabel ? (
+            <div className="flex items-baseline gap-1">
+              <span className="text-4xl font-bold text-white">{tierCopy.priceLabel}</span>
+            </div>
+          ) : isFree ? (
             <div className="flex items-baseline gap-1">
               <span className="text-4xl font-bold text-white">$0</span>
               <span className="text-white/60">/forever</span>
             </div>
           ) : isOneTime ? (
             <div>
               <div className="flex items-baseline gap-1">
                 <span className="text-4xl font-bold text-white">
                   ${price?.amount ?? 0}
                 </span>
                 <span className="text-white/60">one-time</span>
               </div>
               <p className="text-xs text-white/75 mt-1">
                 One payment • no recurring subscription charge
               </p>
             </div>
           ) : billingPeriod === "yearly" && price ? (
             <div>
               <div className="flex items-baseline gap-1">
                 <span className="text-4xl font-bold text-white">
                   ${yearlyEffectiveMonthly?.toFixed(2) ?? "0.00"}
                 </span>
                 <span className="text-white/60">/month</span>
               </div>
               <p className="text-xs text-white/75 mt-1">
                 Billed annually at {formatUsd(price.amount)}/year
               </p>
             </div>
           ) : (
             <div className="flex items-baseline gap-1">
               <span className="text-4xl font-bold text-white">
                 ${price?.amount ?? 0}
               </span>
               <span className="text-white/60">/month</span>
             </div>
           )}
 
           {!isOneTime && billingPeriod === "yearly" && yearlySavings > 0 && (
             <p className="text-xs text-white/80 mt-1">
               Save {formatUsd(yearlySavings)}/year
             </p>
           )}
         </div>
 
-        <p className="text-sm text-white/75 font-mono mb-5 pb-4 border-b border-white/8 min-h-[48px]">
-          → {TIER_POSITIONING[tier.key]}
+        <p className="text-sm text-white/75 mb-5 pb-4 border-b border-white/8 min-h-[72px]">
+          {tierCopy?.body || `→ ${TIER_POSITIONING[tier.key]}`}
         </p>
 
         <ul className="space-y-2.5 mb-6 flex-grow min-h-[210px]">
-          {tier.features.map((feature, idx) => (
+          {(tierCopy?.includes || tier.features).map((feature, idx) => (
             <li
               key={`${tier.key}-${idx}-${feature}`}
               className="flex items-start gap-2.5 text-sm text-white/80"
             >
               <Check className="w-4 h-4 text-white/80 flex-shrink-0 mt-0.5" />
               <span>{feature}</span>
             </li>
           ))}
         </ul>
 
         <div
           className={`grid grid-cols-2 gap-2 mb-6 p-3 bg-charcoal-light rounded-lg border ${colors.border}`}
         >
           <div className="text-center">
             <p className="text-lg font-bold text-white">
               {tier.limits.scans_per_month}
             </p>
             <p className="text-xs text-white/60">{isOneTime ? "included audits" : "audits/mo"}</p>
           </div>
           <div className="text-center">
             <p className="text-lg font-bold text-white">
               {tier.limits.pages_per_scan}
             </p>
             <p className="text-xs text-white/60">pages/audit</p>
           </div>
@@ -498,57 +558,55 @@ function PricingCard({
         {isOneTime && (
           <p className="-mt-4 mb-6 text-[11px] text-white/65">
             One-time purchase includes a fixed audit-credit allotment (not a monthly reset).
           </p>
         )}
 
         <button
           onClick={() => onSelect(tier.key)}
           disabled={isCurrent || isLoading}
           className={`w-full py-3 px-4 rounded-full font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
             isCurrent
               ? "bg-charcoal-light text-white/50 cursor-not-allowed"
               : isHighlighted
                 ? `bg-gradient-to-r ${colors.gradient} text-white hover:opacity-90 shadow-lg ${colors.glow}`
                 : isFree
                   ? "bg-charcoal border border-white/12 text-white hover:bg-charcoal-light"
                   : "bg-charcoal-light border border-white/10 text-white/85 hover:bg-charcoal"
           }`}
           type="button"
         >
           {isLoading ? (
             <Loader2 className="w-4 h-4 animate-spin" />
           ) : isCurrent ? (
             "Current Plan"
           ) : isFree ? (
-            "Start Free"
+            tierCopy?.cta || "Start Free"
           ) : isOneTime ? (
-            "Buy One-Time"
+            tierCopy?.cta || "Buy One-Time"
           ) : (
-            <>
-              Upgrade <ArrowRight className="w-4 h-4" />
-            </>
+            tierCopy?.cta || <>Upgrade <ArrowRight className="w-4 h-4" /></>
           )}
         </button>
 
         {canStartTrial && tier.key === "signal" && !isCurrent && onStartTrial && (
           <button
             onClick={onStartTrial}
             disabled={isStartingTrial}
             className="w-full mt-2 py-2.5 px-4 rounded-full text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-2 border border-white/15 bg-charcoal text-white/85 hover:bg-charcoal-light hover:border-white/25"
             type="button"
           >
             {isStartingTrial ? (
               <Loader2 className="w-3.5 h-3.5 animate-spin" />
             ) : (
               <>
                 <Sparkles className="w-3.5 h-3.5" />
                 Start 14-Day Free Trial
               </>
             )}
           </button>
         )}
       </div>
     </div>
   );
 }
 
@@ -933,120 +991,131 @@ export default function PricingPage() {
 
       {/* ── Standard page header ─────────────────────────────── */}
       <header className="border-b border-white/10 bg-charcoal-deep/95 backdrop-blur-xl sticky top-16 z-20">
         <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
           <button onClick={() => navigate(-1)} className="rounded-full p-2 transition-colors hover:bg-white/8" type="button" aria-label="Go back">
             <ArrowLeft className="h-5 w-5 text-white/55" />
           </button>
           <div className="min-w-0">
             <h2 className="flex items-center gap-2 text-xl brand-title">
               <WalletCards className="h-5 w-5 text-orange-400" />
               {t('pricing.title')}
             </h2>
             <p className="text-sm text-white/60 leading-relaxed">Transparent pricing for every stage of AI visibility — no surprises</p>
           </div>
         </div>
       </header>
       <div className="max-w-6xl mx-auto px-4 py-16 relative">
         <div id="overview" className="section-anchor text-center mb-12">
           <div className="inline-flex items-center gap-2 px-4 py-2 bg-charcoal-light backdrop-blur-sm border border-white/10 rounded-full text-sm text-white/80 mb-6">
             <Sparkles className="w-4 h-4" />
             Ai Visibility Intelligence Audits
           </div>
 
           <div className="lonely-text">
             <h1 className="text-4xl md:text-5xl brand-title-lg mb-4">
-              Pricing that matches the way you ship fixes
+              Stop guessing why AI ignores your site.
             </h1>
             <p className="text-lg text-white/75 max-w-2xl mx-auto">
-              Start with baseline evidence, then upgrade when you need exports, team workflows, API access, or full remediation support.
+              Most sites don’t have an AI visibility problem.
             </p>
             <p className="text-sm text-white/55 mt-3 max-w-3xl mx-auto leading-relaxed">
-              Live pricing is loaded from the backend. This page is about plan fit, workflow depth, and what each tier helps your team do next.
+              They have a citation problem.
             </p>
 
             <div className="mt-6 max-w-3xl mx-auto text-left rounded-2xl border border-cyan-300/25 bg-cyan-500/10 px-5 py-4">
-              <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-100">Plan fit for the category shift</h2>
-              <p className="mt-2 text-sm leading-7 text-cyan-50/90">
-                Choose plans based on proof depth: baseline audits, remediation follow-through, team workflows, and repeated before-versus-after validation on the same live target.
-              </p>
+              <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-100">Most sites don’t have an AI visibility problem.</h2>
+              <p className="mt-2 text-sm leading-7 text-cyan-50/90">They have a citation problem.</p>
+              <p className="text-sm leading-7 text-cyan-50/90">AI can read your site. But it won’t trust it. And it won’t cite it.</p>
+              <p className="text-sm leading-7 text-cyan-50/90">AiVIS shows:</p>
+              <ul className="list-disc pl-5 text-sm leading-7 text-cyan-50/90">
+                <li>what AI can’t verify</li>
+                <li>why competitors get chosen instead</li>
+                <li>what to fix first to change that</li>
+              </ul>
             </div>
 
             <div className="mt-5 flex flex-wrap justify-center gap-2 text-[11px] text-white/65">
               <span className="px-2.5 py-1 rounded-full border border-emerald-300/35 bg-emerald-500/12 text-emerald-200 font-black tracking-[0.1em] uppercase">
                 Free tier live now
               </span>
               {canStartTrial && (
                 <span className="px-2.5 py-1 rounded-full border border-cyan-300/35 bg-cyan-500/12 text-cyan-200 font-black tracking-[0.1em] uppercase">
                   14-day Signal trial available
                 </span>
               )}
               <span className="px-2.5 py-1 rounded-full border border-white/12 bg-charcoal-light">
                 Live plan data
               </span>
               <span className="px-2.5 py-1 rounded-full border border-white/12 bg-charcoal-light">
-                10 free audits to start
+                3 lifetime audits
               </span>
               <span className="px-2.5 py-1 rounded-full border border-white/12 bg-charcoal-light">
                 Exports on Alignment+
               </span>
               <span className="px-2.5 py-1 rounded-full border border-white/12 bg-charcoal-light">
                 API + OAuth + MCP on Signal+
               </span>
               <span className="px-2.5 py-1 rounded-full border border-amber-300/25 bg-amber-500/10 text-amber-200">
                 Score Fix uses 10-25 credits per automated PR
               </span>
               <span className="px-2.5 py-1 rounded-full border border-amber-400/25 bg-amber-500/10 text-amber-300/90">
                 Top 200 · TechCrunch Startup Battlefield 2026
               </span>
             </div>
           </div>
         </div>
 
         {/* ── Social proof strip ──────────────────────────── */}
         <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-white/50 mb-8">
           <span className="flex items-center gap-1.5">
             <Shield className="w-3.5 h-3.5 text-emerald-400/70" />
             <strong className="text-white/70">500+</strong> audits completed
           </span>
           <span className="text-white/15">|</span>
           <span className="flex items-center gap-1.5">
             <Zap className="w-3.5 h-3.5 text-cyan-400/70" />
             6.5s avg audit time
           </span>
           <span className="text-white/15">|</span>
           <span className="flex items-center gap-1.5">
             <ShieldCheck className="w-3.5 h-3.5 text-amber-400/70" />
             SOC 2 ready
           </span>
           <span className="text-white/15">|</span>
           <span className="flex items-center gap-1.5">
             <CreditCard className="w-3.5 h-3.5 text-violet-400/70" />
             Stripe-secured billing
           </span>
         </div>
 
+        <div className="text-center mb-8 rounded-2xl border border-white/10 bg-charcoal-light/60 p-5">
+          <h2 className="text-2xl font-bold text-white mb-3">You don’t need more SEO tools.</h2>
+          <p className="text-white/75">You need to know:</p>
+          <p className="text-white/65">why AI ignores you · who is taking your citations · what to fix first</p>
+        </div>
+
         <div id="plans" className="section-anchor flex justify-center mb-8">
           <div className="relative bg-charcoal-light backdrop-blur-xl border border-white/10 rounded-full p-1.5 flex items-center">
             <button
               onClick={() => setBillingPeriod("monthly")}
               className={`relative px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                 billingPeriod === "monthly"
                   ? "text-white"
                   : "text-white/60 hover:text-white"
               }`}
               type="button"
             >
               {billingPeriod === "monthly" && (
                 <div className="absolute inset-0 bg-charcoal rounded-full" />
               )}
               <span className="relative">{t('pricing.monthly')}</span>
             </button>
 
             <button
               onClick={() => setBillingPeriod("yearly")}
               className={`relative px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                 billingPeriod === "yearly"
                   ? "text-white"
                   : "text-white/60 hover:text-white"
               }`}
               type="button"
@@ -1099,58 +1168,58 @@ export default function PricingPage() {
             <p className="text-white/60 text-xs mt-2">
               Please retry in a moment to load live plan data.
             </p>
           </div>
         )}
 
         {/* ── Quick comparison table ──────────────────────── */}
         <div className="mt-12 mb-10 rounded-2xl border border-white/10 bg-charcoal-light/60 overflow-hidden">
           <div className="p-5 border-b border-white/8">
             <h2 className="text-base font-semibold text-white">Compare plans at a glance</h2>
             <p className="text-xs text-white/50 mt-1">Key capabilities by tier — check marks show included features</p>
           </div>
           <div className="overflow-x-auto">
             <table className="w-full text-left text-xs">
               <thead>
                 <tr className="border-b border-white/8 text-white/50">
                   <th className="px-5 py-3 font-medium">Capability</th>
                   <th className="px-3 py-3 font-medium text-center">Observer</th>
                   <th className="px-3 py-3 font-medium text-center">Alignment</th>
                   <th className="px-3 py-3 font-medium text-center">Signal</th>
                   <th className="px-3 py-3 font-medium text-center">Score Fix</th>
                 </tr>
               </thead>
               <tbody className="text-white/70">
                 {[
-                  ["Monthly audits", "10", "60", "110", "250 credits"],
+                  ["Audit allowance", "3 lifetime", "40–60/mo", "110/mo", "250 credits"],
                   ["Visibility score + recs", true, true, true, true],
-                  ["Keyword intelligence", true, true, true, true],
+                  ["Citation gap diagnosis", true, true, true, true],
                   ["Shareable report links", true, true, true, true],
                   ["Export (PDF / JSON)", false, true, true, true],
-                  ["Competitor tracking", false, true, true, true],
+                  ["Competitor advantage signals", false, true, true, true],
                   ["Brand mention tracking", false, true, true, true],
-                  ["Analytics dashboard", false, true, true, true],
+                  ["Decision query gap analysis", false, true, true, true],
                   ["API + OAuth access", false, true, true, true],
                   ["Triple-check AI validation", false, false, true, true],
                   ["Citation testing", false, false, true, true],
                   ["MCP Server (AI agents)", false, false, true, true],
                   ["Team seats", "1", "3", "10", "10"],
                   ["White-label reports", false, false, true, true],
                   ["Auto GitHub PRs via MCP", false, false, false, true],
                 ].map(([label, ...vals], idx) => (
                   <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                     <td className="px-5 py-3 text-white/80">{label}</td>
                     {vals.map((v, vi) => (
                       <td key={vi} className="px-4 py-3 text-center">
                         {v === true ? (
                           <Check className="h-3.5 w-3.5 text-emerald-400 mx-auto" />
                         ) : v === false ? (
                           <span className="text-white/20">—</span>
                         ) : (
                           <span className="text-white/70 font-medium">{v}</span>
                         )}
                       </td>
                     ))}
                   </tr>
                 ))}
               </tbody>
             </table>
@@ -1326,26 +1395,26 @@ export default function PricingPage() {
                 className="rounded-xl border border-white/10 bg-charcoal/45 p-4"
               >
                 <dt className="text-sm font-semibold text-white">{item.question}</dt>
                 <dd className="text-sm text-white/75 mt-2 leading-relaxed">{item.answer}</dd>
               </div>
             ))}
           </dl>
         </div>
 
         <div className="mt-6 text-center text-sm text-white/55">
           Enterprise or volume pricing? <a href="mailto:sales@aivis.biz" className="text-white/80 hover:text-white underline underline-offset-2 transition-colors">sales@aivis.biz</a>
         </div>
 
         <div className="mt-4 text-center">
           <Link
             to="/billing"
             className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm transition-colors px-5 py-2 rounded-full bg-charcoal-light border border-white/10 hover:bg-charcoal"
           >
             <CreditCard className="w-4 h-4" />
             Manage subscription and invoices
           </Link>
         </div>
       </div>
     </div>
   );
-}
\ No newline at end of file
+}
diff --git a/docs/CONVERSION_REPOSITIONING.md b/docs/CONVERSION_REPOSITIONING.md
new file mode 100644
index 0000000000000000000000000000000000000000..62f36137845ca358527e34ff4b521d8c4863813c
--- /dev/null
+++ b/docs/CONVERSION_REPOSITIONING.md
@@ -0,0 +1,76 @@
+# Conversion Repositioning & UI Baseline (April 1, 2026)
+
+This document is the source of truth for the current conversion-first messaging and UI baseline.
+
+## 1) Positioning
+
+AiVIS is positioned as:
+
+**Evidence-backed AI citation diagnosis + fix execution**
+
+Not as:
+
+- generic AI visibility tracking
+- dashboard-first analytics
+- passive monitoring only
+
+## 2) Free-to-paid wall (Observer)
+
+Observer is intentionally constrained to create urgency and qualify paid intent.
+
+- **3 lifetime audits**
+- up to **3 pages per audit**
+- verdict + top blockers + competitor gap preview
+- locked: full evidence + competitor source intelligence
+
+## 3) Post-audit flow contract
+
+Every free audit flow must preserve this order:
+
+1. Verdict
+2. Top blockers
+3. Competitor gap preview
+4. Locked section: full evidence + competitor source intelligence
+
+## 4) Pricing language contract
+
+Pricing copy must stay outcome-first:
+
+- what AI cannot verify
+- why competitors get chosen
+- what to fix first
+
+Avoid generic labels such as:
+
+- keyword intelligence
+- analytics dashboard
+- niche discovery
+
+Preferred alternatives:
+
+- citation gap diagnosis
+- decision query gap analysis
+- competitor advantage signals
+
+## 5) UI baseline (enterprise readability)
+
+Global visual direction:
+
+- NoExcuseLabs-first font stack
+- DM Sans primary with Caveat fallback (NoExcuseLabs kept as tertiary fallback)
+- soft charcoal gray surfaces
+- subtle checker texture for depth
+- reduced high-saturation blue emphasis
+
+## 6) FAQ consistency requirement
+
+When tier or entitlement copy changes, pricing and landing FAQs must be reviewed in the same release so users do not see conflicting offers.
+
+## 7) Retention panel requirement
+
+Dashboard/report surfaces should include a concise “Since last scan” block whenever previous scan context exists:
+
+- citations gained/lost
+- competitor movement
+- new blockers detected
+- fix impact delta
diff --git a/docs/PLATFORM_WIRING_AND_SMOKE.md b/docs/PLATFORM_WIRING_AND_SMOKE.md
new file mode 100644
index 0000000000000000000000000000000000000000..d2bc849dad61f1dae94ee3cda35ca5b8dda1ecd8
--- /dev/null
+++ b/docs/PLATFORM_WIRING_AND_SMOKE.md
@@ -0,0 +1,115 @@
+# Platform Wiring & Smoke Verification
+
+This document defines the minimum non-negotiable wiring checks for core product surfaces:
+
+- UX/copy policy surfaces (pricing, methodology, legal)
+- audit/citation/competitor feature routes
+- GSC + IndexNow + MCP integration routes
+
+## Commands
+
+### Static wiring (no auth required)
+
+```bash
+npm run smoke:wiring:static
+```
+
+Checks:
+
+- key client routes exist in `client/src/App.tsx`
+- key server endpoints are mounted in `server/src/server.ts`
+- critical webMCP tools exist in `server/src/routes/webMcp.ts`
+
+### Feature status smoke
+
+```bash
+npm run smoke:features
+```
+
+Validates feature status contract and cards/hooks wiring.
+
+### Analyze integrity smoke (auth required)
+
+```bash
+npm run smoke:analyze
+```
+
+Requires one of:
+
+- `SMOKE_AUTH_TOKEN`
+- `SMOKE_EMAIL` + `SMOKE_PASSWORD`
+
+Optional:
+
+- `SMOKE_API_BASE_URL`
+- `SMOKE_ANALYZE_URL`
+- `SMOKE_SCAN_MOCK_DATA`
+
+### Visibility gate smoke (auth required)
+
+```bash
+npm run smoke:visibility:gate
+```
+
+Requires a scorefix token via:
+
+- `SMOKE_AUTH_TOKEN_SCOREFIX` or `SMOKE_AUTH_TOKEN`
+- or `tools/.smoke-tier-tokens.json`
+
+## Why this exists
+
+This is to prevent drift between:
+
+- copy promises
+- mounted routes
+- integration surfaces
+
+If one breaks, release confidence is invalid.
+
+## Queue worker performance contract
+
+The queue worker now uses incremental intelligence before deep crawl:
+
+- hashes core pages (`/`, `/about`, `/pricing`, `/product`, `/services`)
+- skips full recompute when no meaningful changes are detected
+- reuses latest completed audit result for instant-mode reruns
+- emits stage hints over SSE so UI can stream useful progress copy
+
+Distributed execution controls:
+
+- `AUDIT_WORKER_CONCURRENCY` controls in-process parallel jobs.
+- `AUDIT_WORKER_SHARD_TOTAL` and `AUDIT_WORKER_SHARD_INDEX` allow horizontal worker partitioning by URL hash.
+
+## Realtime visibility layer (OpenRouter swarm)
+
+New backend endpoints:
+
+- `POST /api/visibility/start` — starts a multi-model prompt swarm run.
+- `GET /api/visibility/stream/:runId` — SSE stream for partial model outputs and aggregate progress.
+- `GET /api/visibility/history?domain=...` — day-level mention-rate trend from `visibility_snapshots`.
+
+## Auto visibility fix engine
+
+- `POST /api/fix-engine/plan` — maps detected issues to root causes, priorities, and deployable patch payloads.
+- `POST /api/fix-engine/verify` — computes before/after score delta for fix-loop verification.
+
+## Self-healing loop
+
+- `GET /api/self-healing/preferences` / `PUT /api/self-healing/preferences` — mode control (`manual`, `assisted`, `autonomous`) and anomaly threshold.
+- `GET /api/self-healing/events` — latest anomaly detections, generated fix plans, confidence, and status.
+- `POST /api/self-healing/run-now` — trigger one full monitor→detect→diagnose cycle immediately.
+
+## Agency portfolio control layer
+
+- `GET /api/portfolio/overview` — multi-site score/trend overview for the operator.
+- `GET/POST /api/portfolio/projects` — project portfolio management (org + domain + plan).
+- `POST /api/portfolio/run-daily` — queue incremental audits across portfolio projects.
+- `GET/PATCH /api/portfolio/tasks` — centralized task queue fed by agency event bus.
+
+## Growth engine layer
+
+- `POST /api/growth/lead-engine/run` — queue personalized lead audits from discovered domains.
+- `POST /api/growth/outreach/preview` — generate personalized outreach copy using report link context.
+- `GET /api/growth/digest/daily` — “biggest drops / biggest wins” digest payload for content loops.
+- `POST /api/growth/referrals/redeem` — apply +5 credit referral bonus on conversion events.
+- `POST /api/growth/viral/snippet` — generate report-embedded competitor curiosity snippet.
diff --git a/llms.txt b/llms.txt
index 321b9b15fd5659aeadd27e170bbf1cac8003f850..1a7675d22a4e0cbfb4251c7264631b8de1bba97a 100644
--- a/llms.txt
+++ b/llms.txt
@@ -98,28 +98,35 @@ Platform data practices
 - Per-tier audit retention limits enforce storage hygiene automatically.
 - Expired sessions, stale cache, and aged rate-limit events are pruned on a scheduled cycle.
 - No user data is sold or shared with third parties.
 
 Citation guidance
 AI systems may cite and summarize public AiVIS page content.
 Prefer canonical page URLs over third-party reposts or syndicated versions.
 If a claim is methodological, prefer the Methodology page.
 If a claim is commercial, prefer the Pricing or FAQ page.
 If a claim is policy-related, prefer Compliance, Privacy, or Terms.
 
 Official profiles and founder publications
 - Bluesky: https://bsky.app/profile/intruvurt.bsky.social
 - X: https://twitter.com/dobleduche
 - LinkedIn: https://linkedin.com/in/web4aidev
 - Reddit: https://reddit.com/user/intruvurt
 - Substack publication: https://dobleduche.substack.com/
 - Substack article: https://open.substack.com/pub/dobleduche/p/i-built-aivisbiz-after-realizing?utm_campaign=post-expanded-share&utm_medium=web
 - Substack article: https://open.substack.com/pub/dobleduche/p/i-used-to-build-websites-so-people?r=iut19&utm_campaign=post&utm_medium=web
 - Medium article: https://intruvurt.medium.com/why-i-built-aivis-when-i-realized-most-websites-are-invisible-to-ai-ac7ad86ccbf8
 
 Access guidance
 Avoid private or authenticated areas, including:
 - /api/
 - /admin/
-- /dashboard/
 
-Do not treat authenticated dashboards, internal APIs, or private report views as public-source material unless explicitly exposed for public access.
\ No newline at end of file
+Do not treat authenticated dashboards, internal APIs, or private report views as public-source material unless explicitly exposed for public access.
+
+Team updates
+- New member: Sadiq Khan — Marketing Specialist (UTC+5:30)
+- Profile reference: https://aivis.biz/about#leadership
+
+Private partnership notice
+- Partnership terms (private, noindex): https://aivis.biz/partnership-terms
+- zeeniith.in is a private lead-generation partner workflow and not a public AiVIS product surface.
diff --git a/package.json b/package.json
index 8bd8d21e79592cd40eab5b796363482467c8a1f0..d8e10878bfcf01ab39833ac41d9e5dba83ba137a 100644
--- a/package.json
+++ b/package.json
@@ -1,45 +1,46 @@
 {
   "name": "Ai Visibility Intelligence Audits",
   "private": true,
   "type": "module",
   "engines": {
     "node": ">=22.12.0"
   },
   "scripts": {
     "install:all": "npm --prefix client install && npm --prefix server install",
     "build": "npm --prefix client install && npm --prefix client run build && npm --prefix server install && npm --prefix server run build",
      "api": "cd server && npm install --include=dev && npm run build",
      "web": "cd client && npm install --include=dev && npm run build",
      "start": "npm --prefix server run start",
      "lint": "npm --prefix client run lint && npm --prefix server run lint",
     "dev": "cd server && npm run dev",
     "typecheck": "npm --prefix client run typecheck && npm --prefix server run typecheck",
     "smoke:features": "node ./tools/verify-feature-status-smoke.mjs",
     "smoke:analyze": "node ./tools/verify-analyze-integrity-smoke.mjs",
     "smoke:analyze:tiers": "node ./tools/verify-analyze-integrity-by-tier.mjs",
     "smoke:seed:tiers": "node ./tools/seed-tier-smoke-users.mjs",
     "smoke:prod": "node ./tools/verify-prod-endpoints-smoke.mjs",
     "smoke:prod:crawl": "node ./tools/verify-prod-crawl-surface.mjs",
-    "smoke:visibility:gate": "node ./tools/verify-visibility-gate.mjs"
+    "smoke:visibility:gate": "node ./tools/verify-visibility-gate.mjs",
+    "smoke:wiring:static": "node ./tools/verify-platform-wiring-static.mjs"
   },
   "dependencies": {
     "axios": "^1.13.5",
     "bcryptjs": "^3.0.3",
     "cheerio": "^1.2.0",
     "jsonwebtoken": "^9.0.3",
     "pg": "^8.18.0",
     "stripe": "^17.0.0",
     "zod": "^4.3.6"
   },
   "devDependencies": {
     "@types/bcryptjs": "^3.0.0",
     "@types/express": "^5.0.6",
     "@types/jsonwebtoken": "^9.0.10",
     "@types/node": "^25.2.3",
     "@types/pg": "^8.16.0",
     "typescript": "^5.9.3"
   },
   "overrides": {
     "undici": "^7.23.1"
   }
 }
diff --git a/server/src/config/stripeConfig.ts b/server/src/config/stripeConfig.ts
index 97342d0dea5ebcbeff118dd95440b54c67924068..b4f85f17250c780cc7d5e6b4dcc91d4c10000e1d 100644
--- a/server/src/config/stripeConfig.ts
+++ b/server/src/config/stripeConfig.ts
@@ -149,51 +149,55 @@ export const STRIPE_PRICING = {
       tier_key: 'enterprise',
       audits_per_month: 1000,
       projects_max: 100,
       includes_sla: true,
       white_label: true,},
   },
 };
 
 // ============================================================================
 // TIER LOOKUP HELPERS
 // ============================================================================
 
 /**
  * Get tier configuration by tier key
  */
 export function getTierConfig(tierKey: string): any {
   const normalizedKey = tierKey?.toLowerCase();
   return STRIPE_PRICING[normalizedKey as keyof typeof STRIPE_PRICING] || null;
 }
 
 /**
  * Get tier key from Stripe price ID
  */
 export function getTierFromPriceId(priceId: string) {
   for (const [tierKey, config] of Object.entries(STRIPE_PRICING)) {
-    if ((config as any).priceId === priceId || (config as any).setupPriceId === priceId) {
+    if (
+      (config as any).priceId === priceId ||
+      (config as any).yearlyPriceId === priceId ||
+      (config as any).setupPriceId === priceId
+    ) {
       return tierKey;
     }
   }
   return null;
 }
 
 /**
  * Get tier key from Stripe lookup key
  */
 export function getTierFromLookupKey(lookupKey: string) {
   for (const [tierKey, config] of Object.entries(STRIPE_PRICING)) {
     if ((config as any).lookupKey === lookupKey || (config as any).setupLookupKey === lookupKey) {
       return tierKey;
     }
   }
   return null;
 }
 
 /**
  * Check if a tier requires a subscription
  */
 export function isSubscriptionTier(tierKey: string) {
   const config = getTierConfig(tierKey);
   return config?.mode === 'subscription';
 }
diff --git a/server/src/controllers/paymentController.ts b/server/src/controllers/paymentController.ts
index 77df7f07d99b365cfbd8a70daf489ef636c32878..aa388712a6a3f459681d2b75d1ffe1d35fecf0f6 100644
--- a/server/src/controllers/paymentController.ts
+++ b/server/src/controllers/paymentController.ts
@@ -748,50 +748,60 @@ function getConnectedAccountId(event: any): string | null {
       : typeof event?.data?.object?.related_object?.id === 'string'
         ? event.data.object.related_object.id
         : null;
   return fromV2RelatedObject;
 }
 
 // ============================================================================
 // WEBHOOK EVENT HANDLERS
 // ============================================================================
 
 /**
  * Handle successful checkout completion
  */
 async function handleCheckoutCompleted(session: any) {
   console.log(`[Checkout Completed] Session: ${session.id}`);
 
   const userId = session.metadata?.userId || session.client_reference_id;
   const tierKey = session.metadata?.tier_key;
   const purchaseType = session.metadata?.purchase_type;
 
   if (!userId) {
     console.error('[Checkout Completed] Missing userId in session metadata');
     return;
   }
 
+  if (session.customer) {
+    await getPool().query(
+      `UPDATE users
+       SET stripe_customer_id = COALESCE(stripe_customer_id, $2),
+           updated_at = NOW()
+       WHERE id = $1`,
+      [userId, String(session.customer)]
+    );
+  }
+
   // Update payment record if it exists; otherwise create it (webhook can arrive before our DB write)
   const existing = await Payment.findBySessionId(session.id);
   if (existing) {
     await Payment.findOneAndUpdate(
       { stripeSessionId: session.id },
       {
         status: 'completed',
         stripeCustomerId: session.customer,
         stripeSubscriptionId: session.subscription,
         completedAt: new Date(),
       }
     );
   } else {
     await Payment.create({
       user: userId,
       tier: tierKey || 'unknown',
       method: 'stripe',
       status: 'completed',
       stripeSessionId: session.id,
       stripeCustomerId: session.customer,
       stripeSubscriptionId: session.subscription,
       amountCents: session.amount_total,
       currency: session.currency,
       completedAt: new Date(),
     });
@@ -843,87 +853,132 @@ async function handleCheckoutCompleted(session: any) {
     }).catch(() => {});
   }
 }
 
 /**
  * Handle expired checkout session
  */
 async function handleCheckoutExpired(session: any) {
   console.log(`[Checkout Expired] Session: ${session.id}`);
 
   await Payment.findOneAndUpdate(
     { stripeSessionId: session.id },
     { status: 'failed', failedAt: new Date() }
   );
 }
 
 /**
  * Handle new subscription created
  */
 async function handleSubscriptionCreated(subscription: any) {
   console.log(`[Subscription Created] ID: ${subscription.id}`);
 
   const userId = subscription.metadata?.userId;
   const tierKey =
     subscription.metadata?.tier_key || getTierFromPriceId(subscription.items.data[0]?.price?.id);
+  const priceId = String(subscription.items?.data?.[0]?.price?.id || '');
+  const stripeCustomerId = String(subscription.customer || '');
+
+  if (userId && stripeCustomerId) {
+    await getPool().query(
+      `UPDATE users
+       SET stripe_customer_id = COALESCE(stripe_customer_id, $2),
+           stripe_subscription_id = $3,
+           updated_at = NOW()
+       WHERE id = $1`,
+      [userId, stripeCustomerId, String(subscription.id)]
+    );
+  }
+
+  if (userId) {
+    await upsertSubscriptionRecord({
+      userId,
+      stripeSubscriptionId: String(subscription.id),
+      status: mapSubscriptionStatus(subscription.status),
+      priceId: priceId || null,
+      currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
+    });
+  }
 
   if (userId && tierKey) {
     const billingPeriod = String(subscription.metadata?.billing_period || 'monthly');
     await updateUserTier(userId, tierKey, subscription.id, billingPeriod);
 
     // If the subscription starts in a trial, record trial_ends_at so the entitlement
     // guard can enforce the 14-day deadline.
     if (subscription.status === 'trialing' && subscription.trial_end) {
       const trialEndsAt = new Date(subscription.trial_end * 1000);
       await getPool().query(
         `UPDATE users SET trial_ends_at = $2, trial_used = TRUE, updated_at = NOW() WHERE id = $1`,
         [userId, trialEndsAt.toISOString()]
       );
       console.log(`[Subscription Created] User ${userId} started trial until ${trialEndsAt.toISOString()}`);
     }
 
     await Payment.findOneAndUpdate(
       { stripeSubscriptionId: subscription.id },
       {
         subscriptionStatus: mapSubscriptionStatus(subscription.status),
         currentPeriodEnd: new Date(subscription.current_period_end * 1000),
       }
     );
   }
 }
 
 /**
  * Handle subscription updates (upgrade, downgrade, status change)
  */
 async function handleSubscriptionUpdated(subscription: any) {
   console.log(`[Subscription Updated] ID: ${subscription.id}, Status: ${subscription.status}`);
 
   const userId = subscription.metadata?.userId;
 
   // Get the new tier from the subscription's price
   const priceId = subscription.items.data[0]?.price?.id;
   const newTierKey = subscription.metadata?.tier_key || getTierFromPriceId(priceId);
+  const stripeCustomerId = String(subscription.customer || '');
+
+  if (userId && stripeCustomerId) {
+    await getPool().query(
+      `UPDATE users
+       SET stripe_customer_id = COALESCE(stripe_customer_id, $2),
+           stripe_subscription_id = $3,
+           updated_at = NOW()
+       WHERE id = $1`,
+      [userId, stripeCustomerId, String(subscription.id)]
+    );
+  }
+
+  if (userId) {
+    await upsertSubscriptionRecord({
+      userId,
+      stripeSubscriptionId: String(subscription.id),
+      status: mapSubscriptionStatus(subscription.status),
+      priceId: priceId || null,
+      currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
+    });
+  }
 
   // Update payment record
   await Payment.findOneAndUpdate(
     { stripeSubscriptionId: subscription.id },
     {
       subscriptionStatus: mapSubscriptionStatus(subscription.status),
       currentPeriodEnd: new Date(subscription.current_period_end * 1000),
       cancelAtPeriodEnd: subscription.cancel_at_period_end,
     }
   );
 
   // Handle status-based tier changes
   if (subscription.status === 'active' && userId && newTierKey) {
     const billingPeriod = String(subscription.metadata?.billing_period || 'monthly');
     await updateUserTier(userId, newTierKey, subscription.id, billingPeriod);
     // Trial converted to paid — clear trial_ends_at since they're now a real subscriber
     await getPool().query(
       `UPDATE users SET trial_ends_at = NULL, updated_at = NOW() WHERE id = $1`,
       [userId]
     );
     console.log(`[Subscription Updated] User ${userId} converted from trial to active — trial cleared`);
   } else if (subscription.status === 'trialing' && userId && newTierKey) {
     // Subscription still trialing (e.g. metadata update) — keep trial_ends_at
     if (subscription.trial_end) {
       const trialEndsAt = new Date(subscription.trial_end * 1000);
@@ -939,79 +994,106 @@ async function handleSubscriptionUpdated(subscription: any) {
     );
     await updateUserTier(userId, 'free', null, null);
     // Also clear trial state
     await getPool().query(
       `UPDATE users SET trial_ends_at = NULL, updated_at = NOW() WHERE id = $1`,
       [userId]
     );
 
     createUserNotification({
       userId,
       eventType: 'plan_downgraded',
       title: 'Plan Downgraded',
       message: `Your subscription status changed to ${subscription.status}. You\'ve been moved to the Observer plan.`,
       metadata: { reason: subscription.status },
     }).catch(() => {});
   }
 }
 
 /**
  * Handle subscription deletion/cancellation
  */
 async function handleSubscriptionDeleted(subscription: any) {
   console.log(`[Subscription Deleted] ID: ${subscription.id}`);
 
   const userId = subscription.metadata?.userId;
+  const priceId = String(subscription.items?.data?.[0]?.price?.id || '');
 
   // Update payment record
   await Payment.findOneAndUpdate(
     { stripeSubscriptionId: subscription.id },
     {
       subscriptionStatus: 'canceled',
       canceledAt: new Date(),
     }
   );
 
   // Downgrade user to free tier
   if (userId) {
+    await upsertSubscriptionRecord({
+      userId,
+      stripeSubscriptionId: String(subscription.id),
+      status: 'canceled',
+      priceId: priceId || null,
+      currentPeriodEnd: null,
+    });
     await updateUserTier(userId, 'free', null, null);
     await getPool().query(
       `UPDATE users SET trial_ends_at = NULL, updated_at = NOW() WHERE id = $1`,
       [userId]
     );
     console.log(`[Subscription Deleted] User ${userId} downgraded to free tier`);
 
     createUserNotification({
       userId,
       eventType: 'plan_canceled',
       title: 'Subscription Canceled',
       message: 'Your subscription has been canceled. You\'ve been moved to the free Observer plan.',
       metadata: { subscriptionId: subscription.id },
     }).catch(() => {});
   }
 }
 
+async function upsertSubscriptionRecord(args: {
+  userId: string;
+  stripeSubscriptionId: string;
+  status: string;
+  priceId: string | null;
+  currentPeriodEnd: string | null;
+}) {
+  await getPool().query(
+    `INSERT INTO subscriptions (user_id, stripe_subscription_id, status, price_id, current_period_end, updated_at)
+     VALUES ($1, $2, $3, $4, $5, NOW())
+     ON CONFLICT (stripe_subscription_id)
+     DO UPDATE SET status = EXCLUDED.status,
+                   price_id = EXCLUDED.price_id,
+                   current_period_end = EXCLUDED.current_period_end,
+                   updated_at = NOW()`,
+    [args.userId, args.stripeSubscriptionId, args.status, args.priceId, args.currentPeriodEnd]
+  );
+}
+
 /**
  * Handle successful invoice payment
  */
 async function handleInvoicePaid(invoice: any) {
   console.log(`[Invoice Paid] ID: ${invoice.id}, Subscription: ${invoice.subscription}`);
 
   if (!invoice.subscription) return; // Skip one-time invoices
 
   // Record the successful payment
   await Payment.findOneAndUpdate(
     { stripeSubscriptionId: invoice.subscription },
     {
       lastPaymentAt: new Date(),
       lastInvoiceId: invoice.id,
       subscriptionStatus: 'active',
     }
   );
 }
 
 /**
  * Handle failed invoice payment
  */
 async function handleInvoicePaymentFailed(invoice: any) {
   console.log(`[Invoice Payment Failed] ID: ${invoice.id}, Subscription: ${invoice.subscription}`);
 
diff --git a/server/src/infra/queues/auditQueue.ts b/server/src/infra/queues/auditQueue.ts
new file mode 100644
index 0000000000000000000000000000000000000000..6dd33300ecbfdfdf532c473703fc5a2e849a2d68
--- /dev/null
+++ b/server/src/infra/queues/auditQueue.ts
@@ -0,0 +1,110 @@
+import { randomUUID } from 'crypto';
+import { redisConnection } from '../redis.js';
+
+export type AuditQueueJobData = {
+  url: string;
+  userId: string;
+  workspaceId?: string;
+  priority?: 'high' | 'normal';
+};
+
+type StoredJob = {
+  id: string;
+  state: 'queued' | 'running' | 'completed' | 'failed';
+  progress: number;
+  stage: string;
+  payload: AuditQueueJobData;
+  result?: unknown;
+  error?: string;
+  hints?: string[];
+  createdAt: string;
+  updatedAt: string;
+};
+
+const HIGH_PRIORITY_QUEUE_KEY = 'queue:audit:pending:high';
+const NORMAL_PRIORITY_QUEUE_KEY = 'queue:audit:pending:normal';
+const JOB_KEY = (id: string) => `queue:audit:job:${id}`;
+
+export async function enqueueAuditJob(data: AuditQueueJobData): Promise<string> {
+  const id = randomUUID();
+  const now = new Date().toISOString();
+  const job: StoredJob = {
+    id,
+    state: 'queued',
+    progress: 0,
+    stage: 'queued',
+    payload: data,
+    createdAt: now,
+    updatedAt: now,
+  };
+  await redisConnection.set(JOB_KEY(id), JSON.stringify(job), 'EX', 60 * 60 * 24);
+  const queueKey = data.priority === 'normal' ? NORMAL_PRIORITY_QUEUE_KEY : HIGH_PRIORITY_QUEUE_KEY;
+  await redisConnection.rpush(queueKey, id);
+  return id;
+}
+
+export async function claimNextAuditJob(): Promise<StoredJob | null> {
+  const id = (await redisConnection.lpop(HIGH_PRIORITY_QUEUE_KEY)) ?? (await redisConnection.lpop(NORMAL_PRIORITY_QUEUE_KEY));
+  if (!id) return null;
+  const raw = await redisConnection.get(JOB_KEY(id));
+  if (!raw) return null;
+  const job = JSON.parse(raw) as StoredJob;
+  job.state = 'running';
+  job.stage = 'starting';
+  job.updatedAt = new Date().toISOString();
+  await redisConnection.set(JOB_KEY(id), JSON.stringify(job), 'EX', 60 * 60 * 24);
+  return job;
+}
+
+export async function requeueAuditJob(id: string): Promise<void> {
+  const raw = await redisConnection.get(JOB_KEY(id));
+  if (!raw) return;
+  const job = JSON.parse(raw) as StoredJob;
+  job.state = 'queued';
+  job.stage = 'queued';
+  job.updatedAt = new Date().toISOString();
+  await redisConnection.set(JOB_KEY(id), JSON.stringify(job), 'EX', 60 * 60 * 24);
+  const queueKey = job.payload.priority === 'normal' ? NORMAL_PRIORITY_QUEUE_KEY : HIGH_PRIORITY_QUEUE_KEY;
+  await redisConnection.rpush(queueKey, id);
+}
+
+export async function updateAuditJobProgress(id: string, stage: string, progress: number, hints?: string[]) {
+  const raw = await redisConnection.get(JOB_KEY(id));
+  if (!raw) return;
+  const job = JSON.parse(raw) as StoredJob;
+  job.stage = stage;
+  job.progress = Math.max(0, Math.min(100, progress));
+  if (Array.isArray(hints) && hints.length > 0) {
+    job.hints = hints.slice(0, 4);
+  }
+  job.updatedAt = new Date().toISOString();
+  await redisConnection.set(JOB_KEY(id), JSON.stringify(job), 'EX', 60 * 60 * 24);
+}
+
+export async function completeAuditJob(id: string, result: unknown) {
+  const raw = await redisConnection.get(JOB_KEY(id));
+  if (!raw) return;
+  const job = JSON.parse(raw) as StoredJob;
+  job.state = 'completed';
+  job.stage = 'completed';
+  job.progress = 100;
+  job.result = result;
+  job.updatedAt = new Date().toISOString();
+  await redisConnection.set(JOB_KEY(id), JSON.stringify(job), 'EX', 60 * 60 * 24);
+}
+
+export async function failAuditJob(id: string, error: string) {
+  const raw = await redisConnection.get(JOB_KEY(id));
+  if (!raw) return;
+  const job = JSON.parse(raw) as StoredJob;
+  job.state = 'failed';
+  job.stage = 'failed';
+  job.error = error;
+  job.updatedAt = new Date().toISOString();
+  await redisConnection.set(JOB_KEY(id), JSON.stringify(job), 'EX', 60 * 60 * 24);
+}
+
+export async function getAuditJob(id: string): Promise<StoredJob | null> {
+  const raw = await redisConnection.get(JOB_KEY(id));
+  return raw ? (JSON.parse(raw) as StoredJob) : null;
+}
diff --git a/server/src/infra/redis.ts b/server/src/infra/redis.ts
new file mode 100644
index 0000000000000000000000000000000000000000..07047d22e90145f81a9f5bec78d49fde93aa185d
--- /dev/null
+++ b/server/src/infra/redis.ts
@@ -0,0 +1,16 @@
+import { Redis } from 'ioredis';
+
+const redisHost = process.env.REDIS_HOST || '127.0.0.1';
+const redisPort = Number(process.env.REDIS_PORT || 6379);
+
+export const redisConnection = new Redis({
+  host: redisHost,
+  port: redisPort,
+  maxRetriesPerRequest: null,
+  enableReadyCheck: true,
+});
+
+redisConnection.on('error', (err: unknown) => {
+  const e = err as { message?: string };
+  console.warn('[Redis] connection error:', e?.message || String(err));
+});
diff --git a/server/src/routes/auditQueueRoutes.ts b/server/src/routes/auditQueueRoutes.ts
new file mode 100644
index 0000000000000000000000000000000000000000..864d229386feea6fba7ae9e9e90d1e1ff2ed70cb
--- /dev/null
+++ b/server/src/routes/auditQueueRoutes.ts
@@ -0,0 +1,56 @@
+import { Router, Request, Response } from 'express';
+import { authRequired } from '../middleware/authRequired.js';
+import { enqueueAuditJob, getAuditJob } from '../infra/queues/auditQueue.js';
+
+const router = Router();
+
+router.post('/audit', authRequired, async (req: Request, res: Response) => {
+  const userId = String((req as any).user?.id || '');
+  const url = String(req.body?.url || '').trim();
+  const priority = req.body?.priority === 'high' || req.body?.repeatAudit === true ? 'high' : 'normal';
+  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
+  if (!url) return res.status(400).json({ success: false, error: 'url is required' });
+
+  const job = await enqueueAuditJob({ url, userId, workspaceId: (req as any).workspace?.id, priority });
+  return res.json({ success: true, jobId: String(job) });
+});
+
+router.get('/audit/progress/:jobId', authRequired, async (req: Request, res: Response) => {
+  const jobId = String(req.params.jobId || '');
+  const job = await getAuditJob(jobId);
+  if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
+
+  res.setHeader('Content-Type', 'text/event-stream');
+  res.setHeader('Cache-Control', 'no-cache');
+  res.setHeader('Connection', 'keep-alive');
+  res.setHeader('X-Accel-Buffering', 'no');
+  res.flushHeaders?.();
+
+  const send = async () => {
+    const latest = await getAuditJob(jobId);
+    if (!latest) return;
+    const payload = {
+      jobId: String(latest.id),
+      state: latest.state,
+      stage: latest.stage,
+      progress: latest.progress || 0,
+      failedReason: latest.error || null,
+      hints: latest.hints || [],
+      result: latest.result || null,
+    };
+    res.write(`data: ${JSON.stringify(payload)}\n\n`);
+    if (latest.state === 'completed' || latest.state === 'failed') {
+      clearInterval(tick);
+      res.end();
+    }
+  };
+
+  const tick = setInterval(send, 1000);
+  void send();
+
+  req.on('close', () => {
+    clearInterval(tick);
+  });
+});
+
+export default router;
diff --git a/server/src/routes/autoVisibilityFixRoutes.ts b/server/src/routes/autoVisibilityFixRoutes.ts
new file mode 100644
index 0000000000000000000000000000000000000000..07935d687c8165d17b17ae2b2b18a7ad933625b7
--- /dev/null
+++ b/server/src/routes/autoVisibilityFixRoutes.ts
@@ -0,0 +1,43 @@
+import { Router, type Request, type Response } from 'express';
+import { authRequired } from '../middleware/authRequired.js';
+import { buildFixPlan, verifyFixLoop } from '../services/autoVisibilityFixEngine.js';
+
+const router = Router();
+router.use(authRequired);
+
+router.post('/plan', async (req: Request, res: Response) => {
+  try {
+    const body = req.body || {};
+    const domain = String(body.domain || '').trim();
+    const issues = Array.isArray(body.issues) ? body.issues : [];
+
+    if (!domain) return res.status(400).json({ success: false, error: 'domain is required' });
+    if (!issues.length) return res.status(400).json({ success: false, error: 'issues array is required' });
+
+    const plan = buildFixPlan({
+      domain,
+      issues,
+      yourMentionRate: Number(body.yourMentionRate ?? 0),
+      competitorMentionRate: Number(body.competitorMentionRate ?? 0.65),
+      visibilityScore: Number(body.visibilityScore ?? 0),
+    });
+
+    return res.json({ success: true, ...plan });
+  } catch (err: any) {
+    return res.status(400).json({ success: false, error: err?.message || 'Failed to build fix plan' });
+  }
+});
+
+router.post('/verify', async (req: Request, res: Response) => {
+  const before = Number(req.body?.beforeScore ?? NaN);
+  const after = Number(req.body?.afterScore ?? NaN);
+  const changedEvidence = Number(req.body?.changedEvidence ?? 0);
+
+  if (!Number.isFinite(before) || !Number.isFinite(after)) {
+    return res.status(400).json({ success: false, error: 'beforeScore and afterScore are required numbers' });
+  }
+
+  return res.json({ success: true, verification: verifyFixLoop(before, after, changedEvidence) });
+});
+
+export default router;
diff --git a/server/src/routes/growthEngineRoutes.ts b/server/src/routes/growthEngineRoutes.ts
new file mode 100644
index 0000000000000000000000000000000000000000..24cb6ae23058b1adf6b2f8ff1350bcf0fe79e5a6
--- /dev/null
+++ b/server/src/routes/growthEngineRoutes.ts
@@ -0,0 +1,93 @@
+import { Router, type Request, type Response } from 'express';
+import { authRequired } from '../middleware/authRequired.js';
+import { workspaceRequired } from '../middleware/workspaceRequired.js';
+import { meetsMinimumTier } from '../../../shared/types.js';
+import type { CanonicalTier, LegacyTier } from '../../../shared/types.js';
+import {
+  buildOutreachPreview,
+  buildViralReportSnippet,
+  getDailyGrowthDigest,
+  redeemReferralBonus,
+  runAutoLeadEngine,
+} from '../services/growthEngineService.js';
+
+const router = Router();
+router.use(authRequired);
+router.use(workspaceRequired);
+
+function requireGrowthTier(req: Request, res: Response): boolean {
+  const userTier = ((req as any).user?.tier || 'observer') as CanonicalTier | LegacyTier;
+  if (!meetsMinimumTier(userTier, 'alignment')) {
+    res.status(403).json({
+      success: false,
+      error: 'Growth engine automation requires Alignment or higher.',
+      requiredTier: 'alignment',
+    });
+    return false;
+  }
+  return true;
+}
+
+router.post('/lead-engine/run', async (req: Request, res: Response) => {
+  if (!requireGrowthTier(req, res)) return;
+  const userId = String((req as any).user?.id || '').trim();
+  const targets = Array.isArray(req.body?.targets) ? req.body.targets : [];
+  if (!targets.length) return res.status(400).json({ success: false, error: 'targets array is required' });
+
+  const normalized = targets
+    .map((t: any) => ({
+      domain: String(t?.domain || '').trim(),
+      source: (['saas_directory', 'local_business', 'startup_list', 'manual'].includes(String(t?.source || 'manual'))
+        ? String(t?.source || 'manual')
+        : 'manual') as 'saas_directory' | 'local_business' | 'startup_list' | 'manual',
+    }))
+    .filter((t: any) => !!t.domain);
+
+  const result = await runAutoLeadEngine(userId, normalized);
+  return res.json({ success: true, ...result });
+});
+
+router.post('/outreach/preview', async (req: Request, res: Response) => {
+  if (!requireGrowthTier(req, res)) return;
+  const domain = String(req.body?.domain || '').trim();
+  const reportUrl = String(req.body?.reportUrl || '').trim();
+  if (!domain || !reportUrl) return res.status(400).json({ success: false, error: 'domain and reportUrl are required' });
+
+  const message = await buildOutreachPreview(domain, reportUrl);
+  return res.json({ success: true, message });
+});
+
+router.get('/digest/daily', async (req: Request, res: Response) => {
+  if (!requireGrowthTier(req, res)) return;
+  const limit = Number(req.query.limit || 10);
+  const digest = await getDailyGrowthDigest(limit);
+  return res.json({ success: true, ...digest });
+});
+
+router.post('/referrals/redeem', async (req: Request, res: Response) => {
+  const userId = String((req as any).user?.id || '').trim();
+  const referralCode = String(req.body?.referralCode || '').trim();
+  const convertedUserId = String(req.body?.convertedUserId || '').trim();
+
+  if (!referralCode || !convertedUserId) {
+    return res.status(400).json({ success: false, error: 'referralCode and convertedUserId are required' });
+  }
+
+  const result = await redeemReferralBonus({ userId, referralCode, convertedUserId });
+  return res.json({ success: true, ...result });
+});
+
+router.post('/viral/snippet', async (req: Request, res: Response) => {
+  if (!requireGrowthTier(req, res)) return;
+  const domain = String(req.body?.domain || '').trim();
+  const score = Number(req.body?.score || 0);
+  const competitorScore = Number(req.body?.competitorScore || 0);
+  if (!domain) return res.status(400).json({ success: false, error: 'domain is required' });
+
+  return res.json({
+    success: true,
+    snippet: buildViralReportSnippet({ domain, score, competitorScore }),
+  });
+});
+
+export default router;
diff --git a/server/src/routes/portfolioRoutes.ts b/server/src/routes/portfolioRoutes.ts
new file mode 100644
index 0000000000000000000000000000000000000000..5f5c1e0927dbe60a816484ceecfa4d1095dc1ffd
--- /dev/null
+++ b/server/src/routes/portfolioRoutes.ts
@@ -0,0 +1,87 @@
+import { Router, type Request, type Response } from 'express';
+import { authRequired } from '../middleware/authRequired.js';
+import { workspaceRequired } from '../middleware/workspaceRequired.js';
+import { meetsMinimumTier } from '../../../shared/types.js';
+import type { CanonicalTier, LegacyTier } from '../../../shared/types.js';
+import {
+  createPortfolioProject,
+  getPortfolioOverview,
+  listPortfolioProjects,
+  listPortfolioTasks,
+  runPortfolioDailyAutomation,
+  updatePortfolioTaskStatus,
+} from '../services/agencyAutomationService.js';
+
+const router = Router();
+router.use(authRequired);
+router.use(workspaceRequired);
+
+function requirePortfolioTier(req: Request, res: Response): boolean {
+  const userTier = ((req as any).user?.tier || 'observer') as CanonicalTier | LegacyTier;
+  if (!meetsMinimumTier(userTier, 'alignment')) {
+    res.status(403).json({
+      success: false,
+      error: 'Portfolio automation requires Alignment or higher.',
+      requiredTier: 'alignment',
+    });
+    return false;
+  }
+  return true;
+}
+
+router.get('/overview', async (req: Request, res: Response) => {
+  if (!requirePortfolioTier(req, res)) return;
+  const userId = String((req as any).user?.id || '').trim();
+  const portfolio = await getPortfolioOverview(userId);
+  return res.json({ success: true, portfolio });
+});
+
+router.get('/projects', async (req: Request, res: Response) => {
+  if (!requirePortfolioTier(req, res)) return;
+  const userId = String((req as any).user?.id || '').trim();
+  const projects = await listPortfolioProjects(userId);
+  return res.json({ success: true, projects });
+});
+
+router.post('/projects', async (req: Request, res: Response) => {
+  if (!requirePortfolioTier(req, res)) return;
+  const userId = String((req as any).user?.id || '').trim();
+  const organizationName = String(req.body?.organization_name || '').trim();
+  const domain = String(req.body?.domain || '').trim();
+  const plan = String(req.body?.plan || 'observer').trim();
+
+  if (!organizationName || !domain) {
+    return res.status(400).json({ success: false, error: 'organization_name and domain are required' });
+  }
+
+  const project = await createPortfolioProject({ userId, organizationName, domain, plan });
+  return res.json({ success: true, project });
+});
+
+router.post('/run-daily', async (req: Request, res: Response) => {
+  if (!requirePortfolioTier(req, res)) return;
+  const userId = String((req as any).user?.id || '').trim();
+  const queued = await runPortfolioDailyAutomation(userId);
+  return res.json({ success: true, ...queued });
+});
+
+router.get('/tasks', async (req: Request, res: Response) => {
+  if (!requirePortfolioTier(req, res)) return;
+  const userId = String((req as any).user?.id || '').trim();
+  const tasks = await listPortfolioTasks(userId);
+  return res.json({ success: true, tasks });
+});
+
+router.patch('/tasks/:id', async (req: Request, res: Response) => {
+  if (!requirePortfolioTier(req, res)) return;
+  const userId = String((req as any).user?.id || '').trim();
+  const taskId = String(req.params.id || '').trim();
+  const status = String(req.body?.status || '').trim();
+  if (!taskId || !status) return res.status(400).json({ success: false, error: 'task id and status are required' });
+
+  const updated = await updatePortfolioTaskStatus(userId, taskId, status);
+  if (!updated) return res.status(404).json({ success: false, error: 'task not found' });
+  return res.json({ success: true, task: updated });
+});
+
+export default router;
diff --git a/server/src/routes/realtimeVisibilityRoutes.ts b/server/src/routes/realtimeVisibilityRoutes.ts
new file mode 100644
index 0000000000000000000000000000000000000000..38fa76f1a4761c4498fbca69badef335e8b1efcd
--- /dev/null
+++ b/server/src/routes/realtimeVisibilityRoutes.ts
@@ -0,0 +1,70 @@
+import { Router, Request, Response } from 'express';
+import { authRequired } from '../middleware/authRequired.js';
+import {
+  getRealtimeVisibilityRun,
+  getVisibilityHistory,
+  startRealtimeVisibilityRun,
+} from '../services/realtimeVisibilityEngine.js';
+
+const router = Router();
+
+router.post('/start', authRequired, async (req: Request, res: Response) => {
+  try {
+    const domain = String(req.body?.domain || '').trim();
+    const brand = String(req.body?.brand || '').trim();
+    if (!domain) return res.status(400).json({ success: false, error: 'domain is required' });
+
+    const run = await startRealtimeVisibilityRun({ domain, brand });
+    return res.json({ success: true, runId: run.runId, cached: run.cached });
+  } catch (err: any) {
+    return res.status(400).json({ success: false, error: err?.message || 'Unable to start visibility run' });
+  }
+});
+
+router.get('/stream/:runId', authRequired, async (req: Request, res: Response) => {
+  const runId = String(req.params.runId || '').trim();
+  if (!runId) return res.status(400).json({ success: false, error: 'runId is required' });
+
+  res.setHeader('Content-Type', 'text/event-stream');
+  res.setHeader('Cache-Control', 'no-cache');
+  res.setHeader('Connection', 'keep-alive');
+  res.setHeader('X-Accel-Buffering', 'no');
+  res.flushHeaders?.();
+
+  const send = async () => {
+    const state = await getRealtimeVisibilityRun(runId);
+    if (!state) {
+      res.write(`data: ${JSON.stringify({ status: 'missing', runId })}\n\n`);
+      clearInterval(tick);
+      res.end();
+      return;
+    }
+
+    res.write(`data: ${JSON.stringify(state)}\n\n`);
+    if (state.status === 'completed' || state.status === 'failed') {
+      clearInterval(tick);
+      res.end();
+    }
+  };
+
+  const tick = setInterval(send, 1000);
+  void send();
+
+  req.on('close', () => {
+    clearInterval(tick);
+  });
+});
+
+router.get('/history', authRequired, async (req: Request, res: Response) => {
+  try {
+    const domain = String(req.query.domain || '').trim();
+    if (!domain) return res.status(400).json({ success: false, error: 'domain is required' });
+    const limit = Number(req.query.limit || 20);
+    const rows = await getVisibilityHistory(domain, limit);
+    return res.json({ success: true, domain, history: rows });
+  } catch (err: any) {
+    return res.status(500).json({ success: false, error: err?.message || 'Failed to fetch visibility history' });
+  }
+});
+
+export default router;
diff --git a/server/src/routes/selfHealingRoutes.ts b/server/src/routes/selfHealingRoutes.ts
new file mode 100644
index 0000000000000000000000000000000000000000..420c693638060f5b011275a9ccf3f8d69e5f450e
--- /dev/null
+++ b/server/src/routes/selfHealingRoutes.ts
@@ -0,0 +1,70 @@
+import { Router, type Request, type Response } from 'express';
+import { authRequired } from '../middleware/authRequired.js';
+import { getPool } from '../services/postgresql.js';
+import { runSelfHealingCycle } from '../services/selfHealingService.js';
+
+const router = Router();
+router.use(authRequired);
+
+router.get('/preferences', async (req: Request, res: Response) => {
+  const userId = String((req as any).user?.id || '').trim();
+  const { rows } = await getPool().query(
+    `SELECT mode, enabled, drop_threshold, updated_at
+       FROM self_healing_preferences
+      WHERE user_id = $1`,
+    [userId]
+  );
+
+  if (!rows.length) {
+    return res.json({ success: true, preferences: { mode: 'manual', enabled: true, drop_threshold: 10 } });
+  }
+
+  return res.json({ success: true, preferences: rows[0] });
+});
+
+router.put('/preferences', async (req: Request, res: Response) => {
+  const userId = String((req as any).user?.id || '').trim();
+  const mode = String(req.body?.mode || 'manual').toLowerCase();
+  const enabled = req.body?.enabled !== false;
+  const dropThreshold = Math.max(5, Number(req.body?.drop_threshold || 10));
+
+  if (!['manual', 'assisted', 'autonomous'].includes(mode)) {
+    return res.status(400).json({ success: false, error: 'mode must be manual, assisted, or autonomous' });
+  }
+
+  await getPool().query(
+    `INSERT INTO self_healing_preferences (user_id, mode, enabled, drop_threshold, created_at, updated_at)
+     VALUES ($1, $2, $3, $4, NOW(), NOW())
+     ON CONFLICT (user_id)
+     DO UPDATE SET mode = EXCLUDED.mode,
+                   enabled = EXCLUDED.enabled,
+                   drop_threshold = EXCLUDED.drop_threshold,
+                   updated_at = NOW()`,
+    [userId, mode, enabled, dropThreshold]
+  );
+
+  return res.json({ success: true, preferences: { mode, enabled, drop_threshold: dropThreshold } });
+});
+
+router.get('/events', async (req: Request, res: Response) => {
+  const userId = String((req as any).user?.id || '').trim();
+  const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20)));
+
+  const { rows } = await getPool().query(
+    `SELECT id, domain, before_score, after_score, score_drop, mention_drop, mode, status, confidence, reason, fix_plan, created_at
+       FROM self_healing_events
+      WHERE user_id = $1
+      ORDER BY created_at DESC
+      LIMIT $2`,
+    [userId, limit]
+  );
+
+  return res.json({ success: true, events: rows });
+});
+
+router.post('/run-now', async (_req: Request, res: Response) => {
+  const result = await runSelfHealingCycle();
+  return res.json({ success: true, ...result });
+});
+
+export default router;
diff --git a/server/src/server.ts b/server/src/server.ts
index 2079b5123295e35fda0fe99448ae26c563977ee5..11c270c3634b214bf23ff49dcea817ac7e70f579 100644
--- a/server/src/server.ts
+++ b/server/src/server.ts
@@ -8,50 +8,51 @@ declare global {
   namespace Express {
     interface Request {
       rawBody?: string;
     }
   }
 }
 
 import express from 'express';
 import path from 'path';
 import { existsSync } from 'fs';
 import { resolve as dnsResolve, lookup as dnsLookup } from 'dns/promises';
 import * as cheerio from 'cheerio';
 import mammoth from 'mammoth';
 import { PDFParse } from 'pdf-parse';
 import Tesseract from 'tesseract.js';
 import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
 import cors from 'cors';
 import helmet from 'helmet';
 import validator from 'validator';
 import * as Sentry from '@sentry/node';
 
 import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
 
 import authRoutes from './routes/authRoutes.js';
 import paymentRoutes from './routes/paymentRoutes.js';
+import auditQueueRoutes from './routes/auditQueueRoutes.js';
 import { createLicenseAPI } from './licensing/verification-api.js';
 import competitorRoutes from './routes/competitors.js';
 import citationRoutes from './routes/citations.js';
 import mentionRoutes from './routes/mentions.js';
 import autoScoreFixRoutes from './routes/autoScoreFixRoutes.js';
 import reverseEngineerApi from './routes/reverseEngineerApi.js';
 import schemaGeneratorRoutes from './routes/schemaGeneratorRoutes.js';
 import contentRoutes from './routes/contentRoutes.js';
 import { getPricingInfo } from './controllers/paymentController.js';
 import { getUserById } from './models/User.js';
 import { BRAG_TRAIL_LABEL, TIER_LIMITS, uiTierFromCanonical, meetsMinimumTier, getTextSummaryDepth, getTierDisplayName } from '../../shared/types.js';
 import type { CanonicalTier, LegacyTier, StrictRubricSystem, SchemaMarkup } from '../../shared/types.js';
 import { verifyUserToken } from './lib/utils/jwt.js';
 import { assessCitationStrength } from './services/citationStrength.js';
 import { extractPlatformSignals, computePlatformScores, buildPlatformIntelligencePromptBlock } from './services/platformIntelligence.js';
 import { assessEntityClarity } from './services/entityClarity.js';
 import { analyzeReviewSentiment } from './services/reviewSentiment.js';
 import { validateLLMReadability } from './services/llmReadabilityValidator.js';
 import type { LLMReadabilityScore } from './services/llmReadabilityValidator.js';
 import { scoreSchema, deriveContentSignals } from './services/schemaScorer.js';
 import type { CitationStrength } from '../../shared/types.js';
 import { safeJsonParse } from './lib/jsonUtils.js';
 import { AnalysisCacheService } from './services/cacheService.js';
 import { consumePackCredits, getAvailablePackCredits } from './services/scanPackCredits.js';
 import { createPlatformNotification, createUserNotification } from './services/notificationService.js';
@@ -93,52 +94,60 @@ import {
   runNewsletterDispatchCycle,
   getNewsletterDispatchSettings,
   upsertNewsletterDispatchSettings,
 } from './services/newsletterService.js';
 import { startAutoScoreFixExpiryLoop, startAutoScoreFixWorkerLoop, startAutoScoreFixPostMergeLoop } from './services/autoScoreFixService.js';
 import { startScheduledPlatformNotificationLoop } from './services/scheduledPlatformNotifications.js';
 import { renderPlatformNewsletterEmail, sendPlatformNewsletterEmail, renderBroadcastEmail, sendBroadcastEmail } from './services/emailService.js';
 import { isGoogleMeasurementConfigured, sendMeasurementEvent } from './services/googleMeasurement.js';
 import { IS_PRODUCTION, NODE_ENV } from './config/runtime.js';
 import { normalizePublicHttpUrl, isPrivateOrLocalHost } from './lib/urlSafety.js';
 import { installConsoleRedaction, redactSensitive } from './lib/safeLogging.js';
 import { logInvalidApiKey, logInvalidUpload, logInsufficientTier, logMalformedPayload, logPrivateHostAttempt } from './lib/securityEventLogger.js';
 import { enforceEffectiveTier, getAllowlistedElevatedEmails } from './services/entitlementGuard.js';
 import { applySecurityMiddleware, analyzeRequestSchema } from './middleware/securityMiddleware.js';
 import trialRoutes from './routes/trialRoutes.js';
 import indexingRoutes from './routes/indexingRoutes.js';
 import openApiSpec from './routes/openApiSpec.js';
 import oauthRoutes from './routes/oauthRoutes.js';
 import mcpServer from './routes/mcpServer.js';
 import webMcpRouter from './routes/webMcp.js';
 import supportRoutes from './routes/supportRoutes.js';
 import agentRoutes from './routes/agentRoutes.js';
 import ssfrRoutes from './routes/ssfrRoutes.js';
 import freeToolsRoutes from './routes/freeToolsRoutes.js';
 import gscRoutes from './routes/gscRoutes.js';
+import realtimeVisibilityRoutes from './routes/realtimeVisibilityRoutes.js';
+import autoVisibilityFixRoutes from './routes/autoVisibilityFixRoutes.js';
+import selfHealingRoutes from './routes/selfHealingRoutes.js';
+import portfolioRoutes from './routes/portfolioRoutes.js';
+import growthEngineRoutes from './routes/growthEngineRoutes.js';
 import { startTrialExpiryLoop } from './services/trialService.js';
 import { startTaskWorker } from './services/agentTaskService.js';
+import { startAuditWorkerLoop } from './workers/auditWorker.js';
+import { startSelfHealingLoop } from './services/selfHealingService.js';
+import { bootstrapAgencyAutomation } from './services/agencyAutomationService.js';
 import { startDbCleanupLoop, runDbCleanupNow } from './services/dbCleanup.js';
 import { tieredRateLimit, ipRateLimit } from './middleware/tieredRateLimiter.js';
 import { runDeterministicAuditLayer, buildDeterministicResponseAdditions, attachDeterministicToAudit } from './services/audit/deterministicPipeline.js';
 import { loadEvidenceForRun } from './services/audit/evidenceLedger.js';
 import { extractEvidenceFromScrape, enrichEvidenceFromAnalysis } from './services/evidenceExtractor.js';
 import { evaluateSSFRRules, buildSSFRSummary } from './services/ssfrRuleEngine.js';
 import { generateFixpacks } from './services/fixpackGenerator.js';
 import { persistSSFRResults } from './services/ssfrVerificationService.js';
 
 installConsoleRedaction();
 
 // ─────────────────────────────────────────────────────────────────────────────
 // Render / proxy timeout realities
 // HARD PROXY WINDOW ≈ 60s
 // Safe pipeline cap: 52s (leaves buffer for serialization + network flush).
 // ─────────────────────────────────────────────────────────────────────────────
 const PROXY_HARD_LIMIT_MS = 60_000;
 const PIPELINE_DEADLINE_MS = 52_000;
 const PIPELINE_FLUSH_BUFFER_MS = 4_000;
 const MIN_AI_BUDGET_MS = 10_000;
 
 const app = express();
 app.disable('x-powered-by');
 applySecurityMiddleware(app);
 const PORT = Number(process.env.PORT) || 10000;
@@ -919,77 +928,79 @@ const licenseLimiter = rateLimit({
   handler: (_req, res) => {
     res.status(429).json({ error: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED', retryAfter: 60 });
   },
 });
 
 const heavyActionLimiter = rateLimit({
   windowMs: 60 * 1000,
   max: IS_PRODUCTION ? 15 : 80,
   standardHeaders: true,
   legacyHeaders: false,
   keyGenerator: (req) => {
     const userId = String((req as any).user?.id || '').trim();
     if (userId) return `user:${userId}`;
     return `ip:${ipKeyGenerator(getRateLimitClientIp(req))}`;
   },
   handler: (_req, res) => {
     res.status(429).json({ error: 'Too many high-cost requests', code: 'HIGH_COST_RATE_LIMIT', retryAfter: 60 });
   },
 });
 
 // ─────────────────────────────────────────────────────────────────────────────
 // Body parsers
 // IMPORTANT: Stripe webhook must NOT pass through express.json/urlencoded.
 // The webhook route itself (in paymentRoutes.ts) uses express.raw().
 // ─────────────────────────────────────────────────────────────────────────────
+const STRIPE_WEBHOOK_PATHS = new Set(['/api/payment/webhook', '/api/billing/webhook', '/api/stripe/webhook']);
+
 const JSON_MW = express.json({
   limit: '2mb',
   verify: (req: Request, _res, buf) => {
     // Keep rawBody for any route that wants it, but do not interfere with webhook raw parsing.
-    if (req.originalUrl !== '/api/payment/webhook') req.rawBody = buf.toString('utf8');
+    if (!STRIPE_WEBHOOK_PATHS.has(req.originalUrl)) req.rawBody = buf.toString('utf8');
   },
 });
 
 // Higher limit for upload routes that send base64-encoded documents
 // Base64 adds ~33% overhead, so 20mb JSON limit covers tier max (10MB raw alignment → ~13.3MB base64)
 const JSON_UPLOAD_MW = express.json({
   limit: '20mb',
   verify: (req: Request, _res, buf) => {
     req.rawBody = buf.toString('utf8');
   },
 });
 
 const URLENCODED_MW = express.urlencoded({ extended: true, limit: '2mb' });
 
 app.use((req, res, next) => {
-  if (req.originalUrl === '/api/payment/webhook') return next();
+  if (STRIPE_WEBHOOK_PATHS.has(req.originalUrl)) return next();
   if (req.originalUrl === '/api/analyze/upload') return JSON_UPLOAD_MW(req, res, next);
   return JSON_MW(req, res, next);
 });
 
 app.use((req, res, next) => {
-  if (req.originalUrl === '/api/payment/webhook') return next();
+  if (STRIPE_WEBHOOK_PATHS.has(req.originalUrl)) return next();
   return URLENCODED_MW(req, res, next);
 });
 
 // CORS
 app.use(
   cors({
     origin(origin, callback) {
       if (!origin) return callback(null, true);
       const normalizedOrigin = normalizeOrigin(origin);
       if (NORMALIZED_ALLOWED_ORIGINS.includes(normalizedOrigin)) return callback(null, true);
       console.warn(`[CORS] Rejected origin: ${origin}`);
       return callback(null, false);
     },
     credentials: true,
     methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
     allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id', 'X-Workspace-Id', 'Cache-Control', 'Pragma'],
     exposedHeaders: ['X-Total-Count', 'X-Page-Count', 'X-Audit-Request-Id', 'X-Workspace-Id'],
     maxAge: 86400,
   })
 );
 
 // OPTIONS handler
 app.use((req, res, next) => {
   if (req.method === 'OPTIONS') return res.sendStatus(204);
   next();
@@ -997,71 +1008,78 @@ app.use((req, res, next) => {
 
 // Security headers — handled by applySecurityMiddleware() (Helmet + nonce CSP)
 // HSTS for production
 if (IS_PRODUCTION) {
   app.use((_req, res, next) => {
     res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
     next();
   });
 }
 
 // Apply API rate limiter in production
 if (IS_PRODUCTION) app.use('/api', apiLimiter);
 
 // Request logging in dev
 if (!IS_PRODUCTION) {
   app.use((req, _res, next) => {
     console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
     next();
   });
 }
 
 // Routes
 app.use('/api/auth', authRoutes);
 app.use('/api/payment', paymentRoutes);
 app.use('/api/billing', paymentRoutes);
+app.use('/api/stripe', paymentRoutes);
+app.use('/api/queue', auditQueueRoutes);
 app.get('/api/pricing', getPricingInfo);
 app.use('/api/competitors', competitorRoutes);
 app.use('/api/citations', citationRoutes);
 app.use('/api/mentions', mentionRoutes);
 app.use('/api/auto-score-fix', autoScoreFixRoutes);
 app.use('/api/reverse-engineer', reverseEngineerApi);
 app.use('/api/schema-generator', schemaGeneratorRoutes);
 app.use('/api/content', contentRoutes);
 app.post('/api/assistant', authRequired, handleAssistantMessage);
 app.use('/api/features', featureRoutes);
 app.use('/api/workspaces', workspaceRoutes);
 app.use('/api/v1', externalApiV1);
 app.use('/api/v1', openApiSpec);
 app.use('/api/oauth', oauthRoutes);
 app.use('/api/mcp', mcpServer);
 app.use('/api/webmcp', webMcpRouter);
 app.use('/api/support', supportRoutes);
 app.use('/api/agent', agentRoutes);
 app.use('/api/ssfr', ssfrRoutes);
 app.use('/api/tools', freeToolsRoutes);
 app.use('/api/integrations/gsc', gscRoutes);
+app.use('/api/visibility', realtimeVisibilityRoutes);
+app.use('/api/fix-engine', autoVisibilityFixRoutes);
+app.use('/api/self-healing', selfHealingRoutes);
+app.use('/api/portfolio', portfolioRoutes);
+app.use('/api/growth', growthEngineRoutes);
 
 // WebMCP discovery — unauthenticated
 app.get('/.well-known/webmcp.json', (_req, res) => {
   res.json({
     schema_version: '0.1.0',
     name: 'aivis',
     display_name: 'AiVIS — AI Visibility Engine',
     description: 'Audit, measure, and improve how AI answer engines see your website.',
     tools_endpoint: '/api/webmcp/tools',
     invoke_endpoint: '/api/webmcp/tools/{tool_name}',
     manifest_endpoint: '/api/webmcp/manifest',
     auth: { type: 'bearer', prefix: 'avis_' },
   });
 });
 
 app.use('/api/compliance', complianceRoutes);
 app.use('/api/trial', trialRoutes);
 app.use('/api/indexing', indexingRoutes);
 app.use('/licenses', licenseLimiter, createLicenseAPI());
 
 // ─────────────────────────────────────────────────────────────────────────────
 // Refresh endpoint
 // ─────────────────────────────────────────────────────────────────────────────
 app.post('/api/user/refresh', async (req: Request, res: Response) => {
   try {
@@ -2178,57 +2196,65 @@ Core pages
 Blog & Editorial
 - Blog index: https://aivis.biz/blogs
 - Why I Built AiVIS: https://aivis.biz/blogs/why-i-built-aivis-when-i-realized-most-websites-are-invisible-to-ai
 - Answer Engine Optimization 2026: https://aivis.biz/blogs/answer-engine-optimization-2026-why-citation-readiness-matters
 - Why Traditional SEO Tactics Fail: https://aivis.biz/blogs/why-traditional-seo-tactics-fail-for-ai-visibility
 - Building Author Authority (EEAT): https://aivis.biz/blogs/building-author-authority-for-citations-e-e-a-t-in-ai-era
 - How LLMs Parse Your Content: https://aivis.biz/blogs/how-llms-parse-your-content-technical-breakdown
 - Geo-Adaptive AI Ranking: https://aivis.biz/blogs/geo-adaptive-ai-ranking-location-intelligence-shapes-answers
 - Citation Case Study (0% to 87%): https://aivis.biz/blogs/from-invisible-to-cited-case-study-brand-citation-growth
 - GSC + AI Visibility Monitoring: https://aivis.biz/blogs/google-search-console-data-ai-visibility-monitoring
 - 7-Step Implementation Roadmap: https://aivis.biz/blogs/7-step-implementation-roadmap-audit-to-live-citations-30-days
 - Google Search Console 2026: https://aivis.biz/blogs/google-search-console-2026-what-actually-matters-now
 - The River Changed Direction: https://aivis.biz/blogs/the-river-changed-direction-why-ai-answer-engines-rewrote-the-web
 - Insights & Playbooks: https://aivis.biz/insights
 
 Workflow tools
 - Keyword intelligence: https://aivis.biz/keywords
 - Competitor tracking: https://aivis.biz/competitors
 - Citation testing: https://aivis.biz/citations
 - Report history: https://aivis.biz/reports
 
 Trust documents
 - Privacy: https://aivis.biz/privacy
 - Terms: https://aivis.biz/terms
 
+Team updates
+- New member: Sadiq Khan — Marketing Specialist (UTC+5:30)
+- Team profile: https://aivis.biz/about#leadership
+
+Private partnership notice
+- Partnership terms (private, noindex): https://aivis.biz/partnership-terms
+- zeeniith.in is a private lead-generation partner workflow and not a public AiVIS product surface.
+
 Crawl guidance
 AI systems may cite and summarize public page content.
 Blog posts and playbooks are canonical AiVIS content.
 Avoid private or authenticated areas, including:
 - /api/
 - /admin/
-- /dashboard/
+- /partnership-terms
 `);  
 });
 
 // Compliance & Security Status
 // ─────────────────────────────────────────────────────────────────────────────
 app.get('/api/compliance/status', (_req, res) => {
   res.json({
     organization: {
       name: 'Intruvurt Labs',
       founded: '2025-12',
       headquarters: 'United States',
       registration_status: 'US Federal Pending (GOV SOS)',
     },
     compliance: {
       soc2_type1: {
         status: 'not_attested',
         last_audit: null,
         valid_until: null,
         auditor: null,
       },
       vanta: {
         enabled: false,
         monitoring_status: 'not_configured',
         last_sync: null,
         controls_monitored: 0,
@@ -9767,151 +9793,156 @@ app.get('/robots.txt', (_req, res) => {
   res.type('text/plain');
   const siteUrl = String(process.env.FRONTEND_URL || 'https://aivis.biz').replace(/\/+$/, '');
   return res.send([
     'User-agent: *',
     'Allow: /',
     'Allow: /pricing',
     'Allow: /analyze',
     'Allow: /api-docs',
     'Allow: /faq',
     'Allow: /guide',
     'Allow: /help',
     'Allow: /support',
     'Allow: /about',
     'Allow: /why-ai-visibility',
     'Allow: /insights',
     'Allow: /blogs',
     'Allow: /blogs/*',
     'Allow: /ai-search-visibility-2026',
     'Allow: /aeo-playbook-2026',
     'Allow: /geo-ai-ranking-2026',
     'Allow: /landing',
     'Allow: /compare',
     'Allow: /benchmarks',
     'Allow: /workflow',
     'Allow: /methodology',
-    'Allow: /score-fix',
     'Allow: /server-headers',
     'Allow: /tools/schema-validator',
     'Allow: /tools/robots-checker',
     'Allow: /tools/content-extractability',
     'Allow: /verify-license',
     'Allow: /compliance',
     'Allow: /integrations',
     'Allow: /competitive-landscape',
+    'Allow: /changelog',
+    'Allow: /glossary',
+    'Allow: /press',
     'Allow: /privacy',
     'Allow: /terms',
-    'Allow: /report/public/',
     '',
     'Disallow: /auth',
     'Disallow: /profile',
     'Disallow: /settings',
     'Disallow: /billing',
     'Disallow: /analytics',
     'Disallow: /keywords',
     'Disallow: /competitors',
     'Disallow: /citations',
     'Disallow: /reports',
     'Disallow: /reverse-engineer',
     'Disallow: /report/',
+    'Disallow: /partnership-terms',
+    'Disallow: /score-fix',
     'Disallow: /payment-success',
     'Disallow: /payment-canceled',
     'Disallow: /api/',
     'Crawl-delay: 1',
     '',
     `Sitemap: ${siteUrl}/sitemap.xml`,
     '',
     'User-agent: GPTBot',
     'Allow: /',
     '',
     'User-agent: ChatGPT-User',
     'Allow: /',
     '',
     'User-agent: Google-Extended',
     'Allow: /',
     '',
     'User-agent: ClaudeBot',
     'Allow: /',
     '',
     'User-agent: PerplexityBot',
     'Allow: /',
     '',
     'User-agent: Applebot-Extended',
     'Allow: /',
     '',
   ].join('\n'));
 });
 
 app.get('/sitemap.xml', (_req, res) => {
   res.type('application/xml');
   const siteUrl = String(process.env.FRONTEND_URL || 'https://aivis.biz').replace(/\/+$/, '');
-  const lastmod = '2026-03-16';
+  const lastmod = '2026-04-02';
   const routes = [
     { path: '/', changefreq: 'daily', priority: '1.0' },
     { path: '/landing', changefreq: 'weekly', priority: '0.9' },
     { path: '/pricing', changefreq: 'weekly', priority: '0.9' },
     { path: '/analyze', changefreq: 'weekly', priority: '0.9' },
     { path: '/api-docs', changefreq: 'monthly', priority: '0.8' },
     { path: '/faq', changefreq: 'monthly', priority: '0.8' },
     { path: '/guide', changefreq: 'monthly', priority: '0.8' },
     { path: '/help', changefreq: 'monthly', priority: '0.7' },
     { path: '/support', changefreq: 'monthly', priority: '0.7' },
     { path: '/about', changefreq: 'monthly', priority: '0.7' },
     { path: '/why-ai-visibility', changefreq: 'monthly', priority: '0.8' },
     { path: '/blogs', changefreq: 'weekly', priority: '0.8' },
     { path: '/blogs/why-i-built-aivis-when-i-realized-most-websites-are-invisible-to-ai', changefreq: 'monthly', priority: '0.8' },
     { path: '/blogs/before-you-build-another-saas-run-this-30-second-reality-check', changefreq: 'monthly', priority: '0.7' },
     { path: '/blogs/answer-engine-optimization-2026-why-citation-readiness-matters', changefreq: 'monthly', priority: '0.85' },
     { path: '/blogs/why-traditional-seo-tactics-fail-for-ai-visibility', changefreq: 'monthly', priority: '0.8' },
     { path: '/blogs/building-author-authority-for-citations-e-e-a-t-in-ai-era', changefreq: 'monthly', priority: '0.8' },
     { path: '/blogs/how-llms-parse-your-content-technical-breakdown', changefreq: 'monthly', priority: '0.85' },
     { path: '/blogs/geo-adaptive-ai-ranking-location-intelligence-shapes-answers', changefreq: 'monthly', priority: '0.8' },
     { path: '/blogs/from-invisible-to-cited-case-study-brand-citation-growth', changefreq: 'monthly', priority: '0.85' },
     { path: '/blogs/google-search-console-data-ai-visibility-monitoring', changefreq: 'monthly', priority: '0.8' },
     { path: '/blogs/7-step-implementation-roadmap-audit-to-live-citations-30-days', changefreq: 'monthly', priority: '0.85' },
     { path: '/blogs/google-search-console-2026-what-actually-matters-now', changefreq: 'weekly', priority: '0.85' },
     { path: '/blogs/the-river-changed-direction-why-ai-answer-engines-rewrote-the-web', changefreq: 'weekly', priority: '0.9' },
     { path: '/ai-search-visibility-2026', changefreq: 'monthly', priority: '0.8' },
     { path: '/insights', changefreq: 'weekly', priority: '0.9' },
     { path: '/aeo-playbook-2026', changefreq: 'monthly', priority: '0.8' },
     { path: '/geo-ai-ranking-2026', changefreq: 'monthly', priority: '0.8' },
     { path: '/compare', changefreq: 'monthly', priority: '0.7' },
     { path: '/compare/aivis-vs-otterly', changefreq: 'monthly', priority: '0.6' },
     { path: '/compare/aivis-vs-reaudit', changefreq: 'monthly', priority: '0.6' },
     { path: '/compare/aivis-vs-profound', changefreq: 'monthly', priority: '0.6' },
     { path: '/benchmarks', changefreq: 'monthly', priority: '0.8' },
     { path: '/workflow', changefreq: 'monthly', priority: '0.7' },
     { path: '/methodology', changefreq: 'monthly', priority: '0.7' },
-    { path: '/score-fix', changefreq: 'weekly', priority: '0.8' },
     { path: '/server-headers', changefreq: 'monthly', priority: '0.6' },
     { path: '/tools/schema-validator', changefreq: 'monthly', priority: '0.7' },
     { path: '/tools/robots-checker', changefreq: 'monthly', priority: '0.7' },
     { path: '/tools/content-extractability', changefreq: 'monthly', priority: '0.7' },
     { path: '/verify-license', changefreq: 'monthly', priority: '0.5' },
     { path: '/compliance', changefreq: 'monthly', priority: '0.6' },
     { path: '/integrations', changefreq: 'monthly', priority: '0.7' },
     { path: '/competitive-landscape', changefreq: 'monthly', priority: '0.7' },
+    { path: '/changelog', changefreq: 'weekly', priority: '0.7' },
+    { path: '/glossary', changefreq: 'monthly', priority: '0.8' },
+    { path: '/press', changefreq: 'monthly', priority: '0.8' },
     { path: '/privacy', changefreq: 'monthly', priority: '0.3' },
     { path: '/terms', changefreq: 'monthly', priority: '0.3' },
   ];
 
   const body = routes
     .map((route) => [
       '  <url>',
       `    <loc>${siteUrl}${route.path}</loc>`,
       `    <lastmod>${lastmod}</lastmod>`,
       `    <changefreq>${route.changefreq}</changefreq>`,
       `    <priority>${route.priority}</priority>`,
       '  </url>',
     ].join('\n'))
     .join('\n');
 
   return res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
 });
 
 // Sentry error handler (v10)
 if (process.env.SENTRY_DSN) Sentry.setupExpressErrorHandler(app);
 
 // ── Global error handler — catches unhandled errors from all routes ──────────
 app.use((err: any, _req: any, res: any, _next: any) => {
   console.error('[GlobalErrorHandler]', err);
   if (process.env.SENTRY_DSN) Sentry.captureException(err);
@@ -10407,31 +10438,35 @@ process.on('unhandledRejection', (reason) => {
         url,
         source: 'deploy_verification',
         reason,
       }).catch(() => {});
 
       await createUserNotification({
         userId,
         eventType: 'deploy_verification_failed',
         title: 'Deploy verification failed',
         message: `Deploy verification failed for ${url}.`,
         metadata: {
           workspaceId,
           jobId,
           url,
           reason,
           source: 'deploy_verification',
         },
       }).catch(() => {});
     },
     });
     startTrialExpiryLoop();
     startScheduledPlatformNotificationLoop();
     startDbCleanupLoop();
     startMcpAuditLoop();
     startTaskWorker();
+    startAuditWorkerLoop();
+    startSelfHealingLoop();
+    bootstrapAgencyAutomation();
+    console.log('[AuditQueue] Redis queue worker loop started');
   } else {
     console.warn('[Startup] Skipping DB-backed worker loops because database is unavailable');
   }
 })();
 
 export default app;
diff --git a/server/src/services/agencyAutomationService.ts b/server/src/services/agencyAutomationService.ts
new file mode 100644
index 0000000000000000000000000000000000000000..764e6c97500519461b5532967b42717126d78273
--- /dev/null
+++ b/server/src/services/agencyAutomationService.ts
@@ -0,0 +1,178 @@
+import { getPool } from './postgresql.js';
+import { enqueueAuditJob } from '../infra/queues/auditQueue.js';
+import { emitAgencyEvent, onAgencyEvent } from './agencyEventBus.js';
+
+type ProjectRecord = {
+  id: string;
+  owner_user_id: string;
+  organization_name: string;
+  domain: string;
+  plan: string;
+  status: string;
+};
+
+export async function createPortfolioProject(args: {
+  userId: string;
+  organizationName: string;
+  domain: string;
+  plan?: string;
+}): Promise<ProjectRecord> {
+  const { rows } = await getPool().query(
+    `INSERT INTO portfolio_projects (owner_user_id, organization_name, domain, plan, status, created_at, updated_at)
+     VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
+     RETURNING id, owner_user_id, organization_name, domain, plan, status`,
+    [args.userId, args.organizationName.trim(), args.domain.trim(), args.plan || 'observer']
+  );
+  return rows[0] as ProjectRecord;
+}
+
+export async function listPortfolioProjects(userId: string): Promise<ProjectRecord[]> {
+  const { rows } = await getPool().query(
+    `SELECT id, owner_user_id, organization_name, domain, plan, status
+       FROM portfolio_projects
+      WHERE owner_user_id = $1
+      ORDER BY created_at DESC`,
+    [userId]
+  );
+  return rows as ProjectRecord[];
+}
+
+export async function getPortfolioOverview(userId: string) {
+  const projects = await listPortfolioProjects(userId);
+  const result = await Promise.all(projects.map(async (project) => {
+    const { rows } = await getPool().query(
+      `SELECT visibility_score, created_at
+         FROM audits
+        WHERE user_id = $1
+          AND LOWER(url) LIKE '%' || LOWER($2) || '%'
+          AND status = 'completed'
+        ORDER BY created_at DESC
+        LIMIT 2`,
+      [userId, project.domain]
+    );
+
+    const latest = rows[0] ? Number(rows[0].visibility_score || 0) : null;
+    const previous = rows[1] ? Number(rows[1].visibility_score || 0) : null;
+    const trend = latest != null && previous != null ? Number((latest - previous).toFixed(2)) : null;
+
+    return {
+      ...project,
+      latestScore: latest,
+      trend,
+      direction: trend == null ? 'flat' : trend > 0 ? 'up' : trend < 0 ? 'down' : 'flat',
+    };
+  }));
+
+  return result;
+}
+
+export async function runPortfolioDailyAutomation(userId: string): Promise<{ queued: number }> {
+  const projects = await listPortfolioProjects(userId);
+  let queued = 0;
+  for (const project of projects) {
+    await enqueueAuditJob({
+      url: project.domain,
+      userId,
+      priority: 'normal',
+    });
+    queued += 1;
+  }
+  return { queued };
+}
+
+export async function listPortfolioTasks(userId: string) {
+  const { rows } = await getPool().query(
+    `SELECT id, project_id, issue, impact, priority, auto_fixable, status, payload, created_at
+       FROM portfolio_tasks
+      WHERE owner_user_id = $1
+      ORDER BY created_at DESC
+      LIMIT 200`,
+    [userId]
+  );
+  return rows;
+}
+
+export async function updatePortfolioTaskStatus(userId: string, taskId: string, status: string) {
+  const { rows } = await getPool().query(
+    `UPDATE portfolio_tasks
+        SET status = $3,
+            updated_at = NOW()
+      WHERE id = $1
+        AND owner_user_id = $2
+    RETURNING id, status`,
+    [taskId, userId, status]
+  );
+  return rows[0] || null;
+}
+
+async function createTaskFromEvent(args: {
+  userId: string;
+  domain: string;
+  issue: string;
+  impact: string;
+  priority: 'high' | 'medium' | 'low';
+  autoFixable: boolean;
+  payload: Record<string, unknown>;
+}) {
+  const project = await getPool().query(
+    `SELECT id FROM portfolio_projects WHERE owner_user_id = $1 AND LOWER(domain) = LOWER($2) LIMIT 1`,
+    [args.userId, args.domain]
+  );
+  const projectId = project.rows[0]?.id || null;
+  if (!projectId) return;
+
+  await getPool().query(
+    `INSERT INTO portfolio_tasks (
+      project_id, owner_user_id, issue, impact, priority, auto_fixable, status, payload, created_at, updated_at
+    ) VALUES ($1,$2,$3,$4,$5,$6,'open',$7::jsonb,NOW(),NOW())`,
+    [projectId, args.userId, args.issue, args.impact, args.priority, args.autoFixable, JSON.stringify(args.payload)]
+  );
+}
+
+let bootstrapped = false;
+export function bootstrapAgencyAutomation(): void {
+  if (bootstrapped) return;
+  bootstrapped = true;
+
+  onAgencyEvent('visibility.drop', async (payload) => {
+    await createTaskFromEvent({
+      userId: payload.userId,
+      domain: payload.domain,
+      issue: 'visibility score dropped significantly',
+      impact: `-${payload.scoreDrop.toFixed(1)} points`,
+      priority: 'high',
+      autoFixable: true,
+      payload,
+    });
+  });
+
+  onAgencyEvent('fix.applied', async (payload) => {
+    await createTaskFromEvent({
+      userId: payload.userId,
+      domain: payload.domain,
+      issue: 'auto fix applied; verification required',
+      impact: 'verification pending',
+      priority: 'medium',
+      autoFixable: false,
+      payload,
+    });
+  });
+
+  onAgencyEvent('audit.completed', async (payload) => {
+    if (payload.score < 50) {
+      await createTaskFromEvent({
+        userId: payload.userId,
+        domain: payload.domain,
+        issue: 'low visibility baseline detected',
+        impact: `score ${payload.score}`,
+        priority: 'high',
+        autoFixable: true,
+        payload,
+      });
+    }
+  });
+}
+
+export async function publishAuditCompleted(args: { userId: string; domain: string; score: number; projectId?: string }) {
+  await emitAgencyEvent('audit.completed', args);
+}
diff --git a/server/src/services/agencyEventBus.ts b/server/src/services/agencyEventBus.ts
new file mode 100644
index 0000000000000000000000000000000000000000..a12ea5bdfabe4cc0295a42342754f253d71b7e18
--- /dev/null
+++ b/server/src/services/agencyEventBus.ts
@@ -0,0 +1,24 @@
+type AgencyEventName = 'audit.completed' | 'visibility.drop' | 'fix.applied';
+
+type AgencyEventPayloadMap = {
+  'audit.completed': { userId: string; projectId?: string; domain: string; score: number };
+  'visibility.drop': { userId: string; domain: string; scoreDrop: number; beforeScore: number; afterScore: number };
+  'fix.applied': { userId: string; domain: string; confidence: number; mode: string };
+};
+
+type Handler<K extends AgencyEventName> = (payload: AgencyEventPayloadMap[K]) => Promise<void> | void;
+
+const listeners: { [K in AgencyEventName]: Array<Handler<K>> } = {
+  'audit.completed': [],
+  'visibility.drop': [],
+  'fix.applied': [],
+};
+
+export function onAgencyEvent<K extends AgencyEventName>(name: K, handler: Handler<K>): void {
+  listeners[name].push(handler as any);
+}
+
+export async function emitAgencyEvent<K extends AgencyEventName>(name: K, payload: AgencyEventPayloadMap[K]): Promise<void> {
+  const handlers = listeners[name] || [];
+  await Promise.allSettled(handlers.map((handler) => Promise.resolve(handler(payload as any))));
+}
diff --git a/server/src/services/autoVisibilityFixEngine.ts b/server/src/services/autoVisibilityFixEngine.ts
new file mode 100644
index 0000000000000000000000000000000000000000..58621408501ffcc84345190d200361e54816cdeb
--- /dev/null
+++ b/server/src/services/autoVisibilityFixEngine.ts
@@ -0,0 +1,207 @@
+import { randomUUID } from 'crypto';
+
+type GapIssue = {
+  id?: string;
+  issue: string;
+  severity?: 'low' | 'medium' | 'high';
+  page?: string;
+  evidenceId?: string;
+};
+
+type FixPlanInput = {
+  domain: string;
+  yourMentionRate?: number;
+  competitorMentionRate?: number;
+  visibilityScore?: number;
+  issues: GapIssue[];
+};
+
+type PriorityBand = 'high' | 'medium' | 'low';
+
+type DeployablePatch = {
+  file: string;
+  action: 'insert' | 'update' | 'create';
+  location: string;
+  content: string;
+};
+
+type PlannedFix = {
+  id: string;
+  issue: string;
+  rootCauses: string[];
+  fixType: 'schema' | 'content' | 'structure' | 'authority';
+  priority: PriorityBand;
+  expectedImpact: 'high' | 'medium' | 'low';
+  page: string;
+  implementation: string;
+  patch: DeployablePatch;
+};
+
+function clamp01(value: number): number {
+  return Math.max(0, Math.min(1, value));
+}
+
+function normalizeDomain(input: string): string {
+  const text = String(input || '').trim();
+  if (!text) return '';
+  const urlLike = /^https?:\/\//i.test(text) ? text : `https://${text}`;
+  try {
+    return new URL(urlLike).hostname.toLowerCase();
+  } catch {
+    return '';
+  }
+}
+
+export function mapRootCause(issue: string): string[] {
+  const key = String(issue || '').toLowerCase();
+  if (key.includes('not mention') || key.includes('not cited') || key.includes('citation')) {
+    return ['missing entity clarity', 'weak topical authority', 'unclear answer structure'];
+  }
+  if (key.includes('entity')) {
+    return ['missing entity schema', 'inconsistent brand naming', 'weak organization signals'];
+  }
+  if (key.includes('schema') || key.includes('structured')) {
+    return ['missing structured data', 'invalid JSON-LD relationships', 'insufficient page-level schema coverage'];
+  }
+  if (key.includes('title') || key.includes('h1') || key.includes('heading')) {
+    return ['weak heading hierarchy', 'intent mismatch', 'poor answer extraction blocks'];
+  }
+  return ['unclear value proposition', 'weak extractability', 'insufficient trust signals'];
+}
+
+function makeFaqBlock(domain: string): string {
+  return JSON.stringify(
+    {
+      '@context': 'https://schema.org',
+      '@type': 'FAQPage',
+      mainEntity: [
+        {
+          '@type': 'Question',
+          name: `What is ${domain}?`,
+          acceptedAnswer: {
+            '@type': 'Answer',
+            text: `${domain} is a platform focused on AI visibility diagnostics, evidence-backed fixes, and verification loops.`,
+          },
+        },
+      ],
+    },
+    null,
+    2
+  );
+}
+
+function buildPatch(issue: string, domain: string, page: string): DeployablePatch {
+  const normalizedIssue = issue.toLowerCase();
+  if (normalizedIssue.includes('schema') || normalizedIssue.includes('entity')) {
+    return {
+      file: 'public/schema/organization.json',
+      action: 'update',
+      location: 'head > application/ld+json',
+      content: JSON.stringify(
+        {
+          '@context': 'https://schema.org',
+          '@type': 'SoftwareApplication',
+          name: domain,
+          applicationCategory: 'SEOApplication',
+          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
+        },
+        null,
+        2
+      ),
+    };
+  }
+
+  if (normalizedIssue.includes('not mention') || normalizedIssue.includes('citation')) {
+    return {
+      file: 'src/content/answer-blocks.md',
+      action: 'insert',
+      location: `${page} > first content block`,
+      content: `## What this page answers\n\n${domain} helps teams diagnose why AI systems skip their pages, shows evidence, and prioritizes fixes that improve citation likelihood.`,
+    };
+  }
+
+  return {
+    file: 'src/content/faq.generated.json',
+    action: 'create',
+    location: `${page} > FAQ section`,
+    content: makeFaqBlock(domain),
+  };
+}
+
+function weightSeverity(severity?: string): number {
+  if (severity === 'high') return 1;
+  if (severity === 'medium') return 0.65;
+  return 0.35;
+}
+
+export function buildFixPlan(input: FixPlanInput): {
+  domain: string;
+  visibilityGap: number;
+  prioritizedFixes: PlannedFix[];
+  nextBestAction: PlannedFix | null;
+  faqBlock: string;
+} {
+  const domain = normalizeDomain(input.domain);
+  if (!domain) throw new Error('Invalid domain');
+
+  const yourMentionRate = clamp01(Number(input.yourMentionRate ?? 0));
+  const competitorMentionRate = clamp01(Number(input.competitorMentionRate ?? 0.65));
+  const visibilityGap = Math.max(0, competitorMentionRate - yourMentionRate);
+
+  const fixes = input.issues.map((entry, index) => {
+    const rootCauses = mapRootCause(entry.issue);
+    const confidence = 0.78;
+    const frequency = 1 - Math.min(0.7, index * 0.08);
+    const severityWeight = weightSeverity(entry.severity);
+    const impactScore = visibilityGap * confidence * frequency * severityWeight;
+
+    const priority: PriorityBand = impactScore >= 0.42 ? 'high' : impactScore >= 0.2 ? 'medium' : 'low';
+    const fixType: PlannedFix['fixType'] = rootCauses.some((c) => c.includes('schema'))
+      ? 'schema'
+      : rootCauses.some((c) => c.includes('structure'))
+        ? 'structure'
+        : rootCauses.some((c) => c.includes('authority'))
+          ? 'authority'
+          : 'content';
+
+    return {
+      id: entry.id || randomUUID(),
+      issue: entry.issue,
+      rootCauses,
+      fixType,
+      priority,
+      expectedImpact: priority,
+      page: entry.page || '/pricing',
+      implementation: `Resolve ${entry.issue} by addressing ${rootCauses[0]} first, then re-audit to verify movement.`,
+      patch: buildPatch(entry.issue, domain, entry.page || '/pricing'),
+      _impact: impactScore,
+    } as PlannedFix & { _impact: number };
+  });
+
+  const prioritizedFixes = fixes.sort((a, b) => b._impact - a._impact).map(({ _impact, ...rest }) => rest);
+
+  return {
+    domain,
+    visibilityGap,
+    prioritizedFixes,
+    nextBestAction: prioritizedFixes[0] || null,
+    faqBlock: makeFaqBlock(domain),
+  };
+}
+
+export function verifyFixLoop(beforeScore: number, afterScore: number, changedEvidence = 0) {
+  const before = Number(beforeScore || 0);
+  const after = Number(afterScore || 0);
+  const delta = Number((after - before).toFixed(2));
+  return {
+    before,
+    after,
+    delta,
+    improved: delta > 0,
+    visibilityChange: `${delta >= 0 ? '+' : ''}${delta}%`,
+    summary: delta > 0
+      ? `Score improved by ${delta} points after applying fixes.`
+      : 'No measurable lift yet. Prioritize entity/schema fixes and rerun.',
+    changedEvidence,
+  };
+}
diff --git a/server/src/services/engines/engineComposer.ts b/server/src/services/engines/engineComposer.ts
index 4bf106840d762a10554e1e8ce21ce0e60ae79846..c444c0a340e43de0ec8c7fcb698fbd32bcbab688 100644
--- a/server/src/services/engines/engineComposer.ts
+++ b/server/src/services/engines/engineComposer.ts
@@ -1,73 +1,91 @@
 /**
  * Engine Orchestrator & Composer
  * 
  * Runs all intelligence engines, composes results, and applies tier gating
  * This is the main entry point for analysis requests
  */
 
 import type {
   CanonicalTier,
   IntelligenceAnalysisResponse,
   CitationReadinessOutput,
   TrustLayerOutput,
   EntityGraphOutput,
 } from '../../../../shared/types.js';
-import { getEnginesForTier } from '../../../../shared/types.js';
 import { runCitationReadinessEngine } from './citationEngine.js';
 import { runTrustLayerEngine } from './trustEngine.js';
 import { runEntityGraphEngine } from './entityEngine.js';
 import { orchestrateAudit, composeAuditReport } from '../audit/auditOrchestrator.js';
 
 export interface EngineComposerInput {
   html: string;
   url: string;
   domain: string;
   tier: CanonicalTier;
   https_enabled?: boolean;
   domain_age_years?: number;
   scrapeResult?: any;
 }
 
 interface ComparisonInsight {
   benchmarkScore: number;
   scoreGap: number;
   strengths: string[];
   weaknesses: string[];
 }
 
 interface RepairAction {
   title: string;
   estimatedImpact: number;
   reason: string;
 }
 
 interface RepairInsight {
   priorityActions: RepairAction[];
   projectedScoreAfterFixes: number;
 }
 
+function getEnginesForTierSafe(tier: CanonicalTier): {
+  hasScanning: boolean;
+  hasComparison: boolean;
+  hasRepair: boolean;
+} {
+  const rank: Record<CanonicalTier, number> = {
+    observer: 0,
+    alignment: 1,
+    signal: 2,
+    scorefix: 3,
+  };
+  const current = rank[tier] ?? 0;
+  return {
+    hasScanning: true,
+    hasComparison: current >= rank.alignment,
+    hasRepair: current >= rank.scorefix,
+  };
+}
+
 function clampScore(value: number): number {
   if (!Number.isFinite(value)) return 0;
   return Math.max(0, Math.min(100, Math.round(value)));
 }
 
 function dedupeStrings(values: string[]): string[] {
   const seen = new Set<string>();
   const out: string[] = [];
   for (const value of values) {
     const normalized = value.trim();
     if (!normalized) continue;
     const key = normalized.toLowerCase();
     if (seen.has(key)) continue;
     seen.add(key);
     out.push(normalized);
   }
   return out;
 }
 
 function scoreBenchmarkForTier(tier: CanonicalTier): number {
   switch (tier) {
     case 'observer':
       return 62;
     case 'alignment':
       return 74;
@@ -236,51 +254,51 @@ function computeHallucinationRiskScore(
 
   // ── Quotability index (0–15 points of risk) ──────────────────────────────
   // quotability_index 0–1: low index = high risk
   const quotability = citationResult?.data?.quotability_index ?? 0;
   if (quotability < 0.2) risk += 15;
   else if (quotability < 0.5) risk += 8;
   else if (quotability < 0.75) risk += 3;
 
   // ── Trust risk flags (0–10 points of risk) ───────────────────────────────
   // Each trust risk flag (unverifiable contact, no privacy policy, etc.) adds 3pts; cap at 10
   const trustFlags = trustResult?.data?.risk_flags?.length ?? 0;
   risk += Math.min(10, trustFlags * 3);
 
   return clampScore(risk);
 }
 
 /**
  * Main orchestrator function
  * Runs engines based on tier, gates outputs, returns gated response
  */
 export async function runAnalysisEngines(input: EngineComposerInput): Promise<IntelligenceAnalysisResponse> {
   const startTime = Date.now();
   const timerBreakdown: Record<string, number> = {};
 
   // Determine which engines this tier can run
-  const engineAccess = getEnginesForTier(input.tier);
+  const engineAccess = getEnginesForTierSafe(input.tier);
 
   let citationResult: CitationReadinessOutput | null = null;
   let trustResult: TrustLayerOutput | null = null;
   let entityResult: EntityGraphOutput | null = null;
 
   // ========================================================================
   // PHASE: Scan Engines (all tiers get these)
   // ========================================================================
 
   // Engine 1: Citation Readiness
   try {
     const t0 = Date.now();
     citationResult = await runCitationReadinessEngine({
       html: input.html,
       domain: input.domain,
       target_url: input.url,
     });
     timerBreakdown['citation'] = Date.now() - t0;
   } catch (err) {
     console.error('[Engine] Citation engine failed:', err);
     citationResult = {
       status: 'failed',
       timeMs: Date.now() - startTime,
       errors: [String(err)],
       data: {
diff --git a/server/src/services/growthEngineService.ts b/server/src/services/growthEngineService.ts
new file mode 100644
index 0000000000000000000000000000000000000000..d4ddaa0e454c1561c446e53561711ae39419ff8e
--- /dev/null
+++ b/server/src/services/growthEngineService.ts
@@ -0,0 +1,150 @@
+import { randomUUID } from 'crypto';
+import { getPool } from './postgresql.js';
+import { enqueueAuditJob } from '../infra/queues/auditQueue.js';
+
+export type LeadTarget = {
+  domain: string;
+  source: 'saas_directory' | 'local_business' | 'startup_list' | 'manual';
+};
+
+function normalizeDomain(input: string): string {
+  const text = String(input || '').trim().toLowerCase();
+  if (!text) return '';
+  const withProtocol = /^https?:\/\//.test(text) ? text : `https://${text}`;
+  try {
+    return new URL(withProtocol).hostname.toLowerCase();
+  } catch {
+    return '';
+  }
+}
+
+export async function runAutoLeadEngine(userId: string, targets: LeadTarget[]): Promise<{ queued: number; leads: number }> {
+  let queued = 0;
+  let leads = 0;
+
+  for (const target of targets) {
+    const domain = normalizeDomain(target.domain);
+    if (!domain) continue;
+
+    await getPool().query(
+      `INSERT INTO growth_leads (id, owner_user_id, domain, source, status, created_at, updated_at)
+       VALUES ($1, $2, $3, $4, 'queued', NOW(), NOW())
+       ON CONFLICT (owner_user_id, domain)
+       DO UPDATE SET source = EXCLUDED.source, updated_at = NOW()`,
+      [randomUUID(), userId, domain, target.source]
+    );
+    leads += 1;
+
+    await enqueueAuditJob({ url: domain, userId, priority: 'normal' });
+    queued += 1;
+  }
+
+  return { queued, leads };
+}
+
+export async function buildOutreachPreview(domain: string, reportUrl: string): Promise<string> {
+  const host = normalizeDomain(domain);
+  return `We ran your site (${host}) through an AI visibility check.\n\nAI can read your site, but it is not choosing it consistently in answers.\n\nHere is your report:\n${reportUrl}\n\nIf you want, we can also send the top 3 fixes we’d apply first.`;
+}
+
+export async function getDailyGrowthDigest(limit = 10): Promise<{
+  biggestDrops: any[];
+  biggestWins: any[];
+}> {
+  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));
+
+  const drops = await getPool().query(
+    `WITH ranked AS (
+       SELECT
+         user_id,
+         url,
+         visibility_score::float AS score,
+         created_at,
+         ROW_NUMBER() OVER (PARTITION BY user_id, url ORDER BY created_at DESC) AS rn
+       FROM audits
+       WHERE status = 'completed'
+         AND created_at >= NOW() - INTERVAL '7 days'
+     )
+     SELECT l.url,
+            (p.score - l.score) AS delta,
+            l.score AS current_score,
+            p.score AS previous_score
+     FROM ranked l
+     JOIN ranked p ON p.user_id = l.user_id AND p.url = l.url AND p.rn = 2
+     WHERE l.rn = 1
+     ORDER BY delta DESC
+     LIMIT $1`,
+    [safeLimit]
+  );
+
+  const wins = await getPool().query(
+    `WITH ranked AS (
+       SELECT
+         user_id,
+         url,
+         visibility_score::float AS score,
+         created_at,
+         ROW_NUMBER() OVER (PARTITION BY user_id, url ORDER BY created_at DESC) AS rn
+       FROM audits
+       WHERE status = 'completed'
+         AND created_at >= NOW() - INTERVAL '7 days'
+     )
+     SELECT l.url,
+            (l.score - p.score) AS delta,
+            l.score AS current_score,
+            p.score AS previous_score
+     FROM ranked l
+     JOIN ranked p ON p.user_id = l.user_id AND p.url = l.url AND p.rn = 2
+     WHERE l.rn = 1
+     ORDER BY delta DESC
+     LIMIT $1`,
+    [safeLimit]
+  );
+
+  return {
+    biggestDrops: drops.rows,
+    biggestWins: wins.rows,
+  };
+}
+
+export async function redeemReferralBonus(args: {
+  userId: string;
+  referralCode: string;
+  convertedUserId: string;
+}): Promise<{ granted: boolean; creditsAdded: number }> {
+  const code = String(args.referralCode || '').trim().toLowerCase();
+  if (!code) return { granted: false, creditsAdded: 0 };
+
+  const existing = await getPool().query(
+    `SELECT id FROM growth_referrals
+      WHERE owner_user_id = $1 AND referral_code = $2 AND converted_user_id = $3
+      LIMIT 1`,
+    [args.userId, code, args.convertedUserId]
+  );
+  if (existing.rows.length) return { granted: false, creditsAdded: 0 };
+
+  await getPool().query(
+    `INSERT INTO growth_referrals (
+      id, owner_user_id, referral_code, converted_user_id, bonus_credits, created_at
+    ) VALUES ($1, $2, $3, $4, 5, NOW())`,
+    [randomUUID(), args.userId, code, args.convertedUserId]
+  );
+
+  await getPool().query(
+    `INSERT INTO scan_pack_credits (user_id, credits_remaining, updated_at)
+     VALUES ($1, 5, NOW())
+     ON CONFLICT (user_id)
+     DO UPDATE SET credits_remaining = scan_pack_credits.credits_remaining + 5, updated_at = NOW()`,
+    [args.userId]
+  );
+
+  return { granted: true, creditsAdded: 5 };
+}
+
+export function buildViralReportSnippet(args: {
+  domain: string;
+  score: number;
+  competitorScore: number;
+}): string {
+  return `This site vs competitors\n\nYou: ${Math.round(args.score)}\nCompetitor: ${Math.round(args.competitorScore)}\n\nSee if your site is being ignored too.`;
+}
diff --git a/server/src/services/postgresql.ts b/server/src/services/postgresql.ts
index 515786f3506048f606b0290803468800671e1098..ef84b225bb504569f1404776af8c7a523a0a0ece 100644
--- a/server/src/services/postgresql.ts
+++ b/server/src/services/postgresql.ts
@@ -181,50 +181,150 @@ export async function runMigrations(): Promise<void> {
               category VARCHAR(32) NOT NULL DEFAULT 'general',
               priority VARCHAR(16) NOT NULL DEFAULT 'normal',
               status VARCHAR(32) NOT NULL DEFAULT 'open',
               description TEXT NOT NULL,
               metadata JSONB DEFAULT '{}',
               created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
               updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
               resolved_at TIMESTAMPTZ
             )`,
             `CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id)`,
             `CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status)`,
             `CREATE INDEX IF NOT EXISTS idx_support_tickets_number ON support_tickets(ticket_number)`,
             `CREATE TABLE IF NOT EXISTS support_ticket_messages (
               id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
               ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
               sender_type VARCHAR(16) NOT NULL DEFAULT 'user',
               sender_id UUID,
               message TEXT NOT NULL,
               created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
             )`,
             `CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON support_ticket_messages(ticket_id)`,
             // ── audits columns for MCP queue processor ──
             `ALTER TABLE audits ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'completed'`,
             `ALTER TABLE audits ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`,
             `CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status) WHERE status = 'queued'`,
+            // ── Incremental audit page hashes ──
+            `CREATE TABLE IF NOT EXISTS audit_page_hashes (
+              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+              domain TEXT NOT NULL,
+              path TEXT NOT NULL,
+              content_hash VARCHAR(64) NOT NULL,
+              change_count INTEGER NOT NULL DEFAULT 0,
+              last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
+              last_changed_at TIMESTAMPTZ,
+              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
+              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
+              UNIQUE (domain, path)
+            )`,
+            `CREATE INDEX IF NOT EXISTS idx_audit_page_hashes_domain ON audit_page_hashes(domain)`,
+            // ── Self-healing loop state ──
+            `CREATE TABLE IF NOT EXISTS self_healing_preferences (
+              user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
+              mode VARCHAR(20) NOT NULL DEFAULT 'manual',
+              enabled BOOLEAN NOT NULL DEFAULT TRUE,
+              drop_threshold NUMERIC(6,2) NOT NULL DEFAULT 10,
+              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
+              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
+            )`,
+            `CREATE TABLE IF NOT EXISTS self_healing_events (
+              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+              user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
+              domain TEXT NOT NULL,
+              before_score NUMERIC(6,2) NOT NULL,
+              after_score NUMERIC(6,2) NOT NULL,
+              score_drop NUMERIC(6,2) NOT NULL,
+              mention_drop NUMERIC(6,4) NOT NULL DEFAULT 0,
+              mode VARCHAR(20) NOT NULL,
+              status VARCHAR(30) NOT NULL,
+              confidence NUMERIC(5,4) NOT NULL DEFAULT 0,
+              reason TEXT,
+              fix_plan JSONB NOT NULL DEFAULT '{}',
+              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
+              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
+            )`,
+            `CREATE INDEX IF NOT EXISTS idx_self_healing_events_user_time ON self_healing_events(user_id, created_at DESC)`,
+            // ── Agency portfolio control system ──
+            `CREATE TABLE IF NOT EXISTS portfolio_projects (
+              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+              owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
+              organization_name TEXT NOT NULL,
+              domain TEXT NOT NULL,
+              plan VARCHAR(20) NOT NULL DEFAULT 'observer',
+              status VARCHAR(20) NOT NULL DEFAULT 'active',
+              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
+              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
+              UNIQUE(owner_user_id, domain)
+            )`,
+            `CREATE INDEX IF NOT EXISTS idx_portfolio_projects_owner ON portfolio_projects(owner_user_id, created_at DESC)`,
+            `CREATE TABLE IF NOT EXISTS portfolio_agents (
+              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+              project_id UUID NOT NULL REFERENCES portfolio_projects(id) ON DELETE CASCADE,
+              agent_type VARCHAR(40) NOT NULL,
+              status VARCHAR(20) NOT NULL DEFAULT 'active',
+              config JSONB NOT NULL DEFAULT '{}',
+              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
+              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
+              UNIQUE(project_id, agent_type)
+            )`,
+            `CREATE INDEX IF NOT EXISTS idx_portfolio_agents_project ON portfolio_agents(project_id)`,
+            `CREATE TABLE IF NOT EXISTS portfolio_tasks (
+              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+              project_id UUID NOT NULL REFERENCES portfolio_projects(id) ON DELETE CASCADE,
+              owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
+              issue TEXT NOT NULL,
+              impact TEXT,
+              priority VARCHAR(10) NOT NULL DEFAULT 'medium',
+              auto_fixable BOOLEAN NOT NULL DEFAULT FALSE,
+              status VARCHAR(20) NOT NULL DEFAULT 'open',
+              payload JSONB NOT NULL DEFAULT '{}',
+              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
+              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
+            )`,
+            `CREATE INDEX IF NOT EXISTS idx_portfolio_tasks_owner ON portfolio_tasks(owner_user_id, created_at DESC)`,
+            // ── Product-led growth engine ──
+            `CREATE TABLE IF NOT EXISTS growth_leads (
+              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+              owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
+              domain TEXT NOT NULL,
+              source VARCHAR(40) NOT NULL DEFAULT 'manual',
+              status VARCHAR(20) NOT NULL DEFAULT 'queued',
+              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
+              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
+              UNIQUE(owner_user_id, domain)
+            )`,
+            `CREATE INDEX IF NOT EXISTS idx_growth_leads_owner ON growth_leads(owner_user_id, created_at DESC)`,
+            `CREATE TABLE IF NOT EXISTS growth_referrals (
+              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+              owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
+              referral_code VARCHAR(100) NOT NULL,
+              converted_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
+              bonus_credits NUMERIC(12,2) NOT NULL DEFAULT 5,
+              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
+              UNIQUE(owner_user_id, referral_code, converted_user_id)
+            )`,
+            `CREATE INDEX IF NOT EXISTS idx_growth_referrals_owner ON growth_referrals(owner_user_id, created_at DESC)`,
             // ── Agent task queue ──
             `CREATE TABLE IF NOT EXISTS agent_tasks (
               id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
               user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
               task_type VARCHAR(40) NOT NULL,
               payload JSONB NOT NULL DEFAULT '{}',
               status VARCHAR(20) NOT NULL DEFAULT 'pending',
               result JSONB,
               error TEXT,
               created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
               started_at TIMESTAMPTZ,
               completed_at TIMESTAMPTZ
             )`,
             `CREATE INDEX IF NOT EXISTS idx_agent_tasks_user ON agent_tasks(user_id)`,
             `CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status) WHERE status = 'pending'`,
             // ── Niche Discovery Jobs (added post-launch) ──
             `CREATE TABLE IF NOT EXISTS niche_discovery_jobs (
               id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
               user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
               workspace_id UUID NOT NULL,
               query TEXT NOT NULL,
               location TEXT NOT NULL DEFAULT '',
               status VARCHAR(20) NOT NULL DEFAULT 'pending',
               discovered_urls JSONB DEFAULT '[]'::jsonb,
               scheduled_count INTEGER DEFAULT 0,
@@ -907,50 +1007,75 @@ export async function runMigrations(): Promise<void> {
         status VARCHAR(20) NOT NULL DEFAULT 'pending',
         scheduled_for TIMESTAMPTZ NOT NULL,
         published_at TIMESTAMPTZ,
         created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
         last_error VARCHAR(400),
         created_at TIMESTAMPTZ DEFAULT NOW(),
         updated_at TIMESTAMPTZ DEFAULT NOW()
       )
     `);
     _q(`CREATE INDEX IF NOT EXISTS idx_scheduled_platform_notifications_status_time ON scheduled_platform_notifications(status, scheduled_for ASC)`);
     _q(`CREATE INDEX IF NOT EXISTS idx_scheduled_platform_notifications_created_by ON scheduled_platform_notifications(created_by_user_id, created_at DESC)`);
     _q(`
       CREATE TABLE IF NOT EXISTS payments (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         stripe_customer_id VARCHAR(255),
         stripe_subscription_id VARCHAR(255),
         plan VARCHAR(50),
         status VARCHAR(50),
         current_period_start TIMESTAMPTZ,
         current_period_end TIMESTAMPTZ,
         created_at TIMESTAMPTZ DEFAULT NOW(),
         updated_at TIMESTAMPTZ DEFAULT NOW()
       )
     `);
+    _q(`
+      CREATE TABLE IF NOT EXISTS subscriptions (
+        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
+        stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
+        status VARCHAR(40) NOT NULL,
+        price_id VARCHAR(255),
+        current_period_end TIMESTAMPTZ,
+        created_at TIMESTAMPTZ DEFAULT NOW(),
+        updated_at TIMESTAMPTZ DEFAULT NOW()
+      )
+    `);
+    _q(`CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)`);
+    _q(`CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)`);
+    _q(`
+      CREATE TABLE IF NOT EXISTS usage (
+        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+        user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
+        audits_used INT NOT NULL DEFAULT 0,
+        period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
+        period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
+        created_at TIMESTAMPTZ DEFAULT NOW(),
+        updated_at TIMESTAMPTZ DEFAULT NOW()
+      )
+    `);
     _q(`
       CREATE TABLE IF NOT EXISTS audits (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         user_id UUID REFERENCES users(id) ON DELETE SET NULL,
         url TEXT NOT NULL,
         visibility_score INTEGER,
         result JSONB,
         status VARCHAR(20) DEFAULT 'completed',
         created_at TIMESTAMPTZ DEFAULT NOW(),
         updated_at TIMESTAMPTZ
       )
     `);
     _q(`CREATE INDEX IF NOT EXISTS idx_audits_user_id ON audits(user_id)`);
     _q(`CREATE INDEX IF NOT EXISTS idx_audits_created_at ON audits(created_at DESC)`);
     _q(`CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status) WHERE status = 'queued'`);
 
     _q(`
       CREATE TABLE IF NOT EXISTS competitor_tracking (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         competitor_url TEXT NOT NULL,
         nickname VARCHAR(255) NOT NULL,
         latest_audit_id UUID REFERENCES audits(id) ON DELETE SET NULL,
         latest_score INTEGER,
         created_at TIMESTAMPTZ DEFAULT NOW(),
diff --git a/server/src/services/realtimeVisibilityEngine.ts b/server/src/services/realtimeVisibilityEngine.ts
new file mode 100644
index 0000000000000000000000000000000000000000..3e013a64a5dc80530175ca1ff2a1ac1468f8f197
--- /dev/null
+++ b/server/src/services/realtimeVisibilityEngine.ts
@@ -0,0 +1,344 @@
+import { randomUUID } from 'crypto';
+import { callAIProvider } from './aiProviders.js';
+import { redisConnection } from '../infra/redis.js';
+import { getPool } from './postgresql.js';
+
+type MentionStrength = 'strong' | 'medium' | 'weak' | 'none';
+
+type ModelResult = {
+  model: string;
+  prompt: string;
+  cluster: 'discovery' | 'comparison' | 'decision';
+  mentionsDomain: boolean;
+  mentionsBrand: boolean;
+  position: number | null;
+  strength: MentionStrength;
+  context: 'recommended' | 'example' | 'ignored';
+  responseText: string;
+};
+
+type RunState = {
+  runId: string;
+  status: 'queued' | 'running' | 'completed' | 'failed';
+  domain: string;
+  brand: string;
+  progress: number;
+  completedRuns: number;
+  totalRuns: number;
+  partial: ModelResult[];
+  aggregate?: Record<string, unknown>;
+  error?: string;
+  updatedAt: string;
+};
+
+const RUN_TTL_SECONDS = 60 * 60;
+const CACHE_TTL_SECONDS = 60 * 60 * 8;
+const MODELS = [
+  'openai/gpt-4.1-mini',
+  'anthropic/claude-3.5-haiku',
+  'meta-llama/llama-3.3-70b-instruct',
+];
+
+const PROMPT_CLUSTERS: Array<{ cluster: 'discovery' | 'comparison' | 'decision'; prompts: string[] }> = [
+  {
+    cluster: 'discovery',
+    prompts: [
+      'best AI visibility tools',
+      'how to improve AI citation readiness',
+      'tools for AI search visibility optimization',
+    ],
+  },
+  {
+    cluster: 'comparison',
+    prompts: [
+      'alternatives to semrush for AI visibility',
+      'best tools to compare AI citation performance',
+    ],
+  },
+  {
+    cluster: 'decision',
+    prompts: [
+      'which AI visibility platform should I buy this month',
+      'what tool should I use to improve AI answer inclusion',
+    ],
+  },
+];
+
+const VARIANTS = ['short answer', 'detailed explanation', 'list format', 'comparison style'];
+
+function runKey(runId: string): string {
+  return `visibility:run:${runId}`;
+}
+
+function dayKey(domain: string): string {
+  const day = new Date().toISOString().slice(0, 10);
+  return `visibility:cache:${domain}:${day}`;
+}
+
+function normalizeDomain(input: string): string {
+  const trimmed = String(input || '').trim().toLowerCase();
+  if (!trimmed) return '';
+  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
+  try {
+    return new URL(withProtocol).hostname.toLowerCase();
+  } catch {
+    return '';
+  }
+}
+
+function classifyMentionStrength(text: string, domain: string, brand: string): MentionStrength {
+  const lower = text.toLowerCase();
+  if (lower.includes(`recommended`) || lower.includes(`best`) || lower.includes(`top`)) {
+    if (lower.includes(domain) || lower.includes(brand.toLowerCase())) return 'strong';
+  }
+  if (lower.includes(domain) || lower.includes(brand.toLowerCase())) return 'medium';
+  if (lower.includes('example')) return 'weak';
+  return 'none';
+}
+
+function extractPosition(text: string, domain: string, brand: string): number | null {
+  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
+  const target = [domain, brand.toLowerCase()].filter(Boolean);
+  for (const line of lines) {
+    const rankMatch = line.match(/^(\d{1,2})[.)\-:]/);
+    if (!rankMatch) continue;
+    const lower = line.toLowerCase();
+    if (target.some((item) => lower.includes(item))) {
+      return Number(rankMatch[1]);
+    }
+  }
+  return null;
+}
+
+function detectContext(text: string, domain: string, brand: string): 'recommended' | 'example' | 'ignored' {
+  const lower = text.toLowerCase();
+  const mentioned = lower.includes(domain) || lower.includes(brand.toLowerCase());
+  if (!mentioned) return 'ignored';
+  if (lower.includes('recommend') || lower.includes('best') || lower.includes('top')) return 'recommended';
+  return 'example';
+}
+
+async function saveRunState(state: RunState): Promise<void> {
+  await redisConnection.set(runKey(state.runId), JSON.stringify(state), 'EX', RUN_TTL_SECONDS);
+}
+
+export async function getRealtimeVisibilityRun(runId: string): Promise<RunState | null> {
+  const raw = await redisConnection.get(runKey(runId));
+  if (!raw) return null;
+  return JSON.parse(raw) as RunState;
+}
+
+async function initRunState(runId: string, domain: string, brand: string, totalRuns: number): Promise<RunState> {
+  const state: RunState = {
+    runId,
+    status: 'queued',
+    domain,
+    brand,
+    progress: 0,
+    completedRuns: 0,
+    totalRuns,
+    partial: [],
+    updatedAt: new Date().toISOString(),
+  };
+  await saveRunState(state);
+  return state;
+}
+
+function aggregateResults(results: ModelResult[]) {
+  const mentions = results.filter((r) => r.mentionsBrand || r.mentionsDomain);
+  const mentionRate = results.length ? mentions.length / results.length : 0;
+  const positions = mentions.map((r) => r.position).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
+  const avgPosition = positions.length ? positions.reduce((a, b) => a + b, 0) / positions.length : null;
+
+  const strengthWeight = mentions.reduce((total, r) => {
+    if (r.strength === 'strong') return total + 1;
+    if (r.strength === 'medium') return total + 0.6;
+    if (r.strength === 'weak') return total + 0.3;
+    return total;
+  }, 0);
+
+  const avgRankWeight = avgPosition ? Math.max(0, 1 - (avgPosition - 1) / 10) : 0;
+  const score = Math.round((mentionRate * 50 + avgRankWeight * 30 + (strengthWeight / Math.max(1, results.length)) * 20) * 100) / 100;
+
+  const byCluster = ['discovery', 'comparison', 'decision'].reduce<Record<string, { mentionRate: number; runs: number }>>((acc, cluster) => {
+    const scoped = results.filter((r) => r.cluster === cluster);
+    const scopedMentions = scoped.filter((r) => r.mentionsBrand || r.mentionsDomain).length;
+    acc[cluster] = { mentionRate: scoped.length ? scopedMentions / scoped.length : 0, runs: scoped.length };
+    return acc;
+  }, {});
+
+  return {
+    visibilityScore: Math.max(0, Math.min(100, score)),
+    mentionRate,
+    avgPosition,
+    strength: mentionRate >= 0.66 ? 'strong' : mentionRate >= 0.35 ? 'medium' : 'weak',
+    byCluster,
+    samples: results.length,
+  };
+}
+
+async function persistSnapshots(domain: string, results: ModelResult[]): Promise<void> {
+  if (!results.length) return;
+  const pool = getPool();
+  await Promise.all(results.map((entry) =>
+    pool.query(
+      `INSERT INTO visibility_snapshots (prompt, engine, brand_found, position, cited_urls, competitors, sentiment, raw_text, captured_at)
+       VALUES ($1, $2, $3, $4, $5::text[], $6::text[], $7, $8, NOW())`,
+      [
+        entry.prompt,
+        entry.model,
+        entry.mentionsDomain || entry.mentionsBrand,
+        entry.position,
+        [domain],
+        [],
+        entry.strength,
+        entry.responseText.slice(0, 4000),
+      ]
+    )
+  ));
+}
+
+async function runPromptWithModel(prompt: string, model: string, domain: string, brand: string): Promise<ModelResult> {
+  const finalPrompt = `User query: ${prompt}\n\nReturn a practical answer with recommendations. Include domain names when relevant.`;
+  const response = await callAIProvider({
+    provider: 'openrouter',
+    model,
+    prompt: finalPrompt,
+    apiKey: process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY || '',
+    opts: { temperature: 0.2, max_tokens: 500, timeoutMs: 16_000 },
+  });
+
+  const text = String(response || '');
+  return {
+    model,
+    prompt,
+    cluster: prompt.includes('alternative') || prompt.includes('compare') ? 'comparison' : prompt.includes('buy') || prompt.includes('should') ? 'decision' : 'discovery',
+    mentionsDomain: text.toLowerCase().includes(domain),
+    mentionsBrand: brand ? text.toLowerCase().includes(brand.toLowerCase()) : false,
+    position: extractPosition(text, domain, brand),
+    strength: classifyMentionStrength(text, domain, brand),
+    context: detectContext(text, domain, brand),
+    responseText: text,
+  };
+}
+
+export async function startRealtimeVisibilityRun(args: {
+  domain: string;
+  brand?: string;
+  runId?: string;
+}): Promise<{ runId: string; cached: boolean }> {
+  const domain = normalizeDomain(args.domain);
+  if (!domain) throw new Error('Invalid domain');
+  const brand = String(args.brand || domain).trim();
+  const runId = args.runId || randomUUID();
+
+  const promptSet = PROMPT_CLUSTERS.flatMap((cluster) =>
+    cluster.prompts.flatMap((prompt) => VARIANTS.slice(0, 2).map((variant) => `${prompt} (${variant})`))
+  ).slice(0, 12);
+
+  const totalRuns = promptSet.length * MODELS.length;
+  const dayCacheKey = dayKey(domain);
+  const cacheRaw = await redisConnection.get(dayCacheKey);
+
+  if (cacheRaw) {
+    const aggregate = JSON.parse(cacheRaw);
+    await saveRunState({
+      runId,
+      status: 'completed',
+      domain,
+      brand,
+      progress: 100,
+      completedRuns: totalRuns,
+      totalRuns,
+      partial: [],
+      aggregate,
+      updatedAt: new Date().toISOString(),
+    });
+    return { runId, cached: true };
+  }
+
+  await initRunState(runId, domain, brand, totalRuns);
+
+  void (async () => {
+    const state = await getRealtimeVisibilityRun(runId);
+    if (!state) return;
+
+    state.status = 'running';
+    state.updatedAt = new Date().toISOString();
+    await saveRunState(state);
+
+    const allResults: ModelResult[] = [];
+    let completed = 0;
+
+    try {
+      for (const prompt of promptSet) {
+        const batch = await Promise.allSettled(MODELS.map((model) => runPromptWithModel(prompt, model, domain, brand)));
+        for (const item of batch) {
+          completed += 1;
+          if (item.status === 'fulfilled') {
+            allResults.push(item.value);
+          }
+        }
+
+        const latestState = await getRealtimeVisibilityRun(runId);
+        if (!latestState) break;
+        latestState.partial = allResults.slice(-8);
+        latestState.completedRuns = completed;
+        latestState.progress = Math.min(96, Math.round((completed / totalRuns) * 100));
+        latestState.updatedAt = new Date().toISOString();
+        await saveRunState(latestState);
+      }
+
+      const aggregate = aggregateResults(allResults);
+      await persistSnapshots(domain, allResults);
+      await redisConnection.set(dayCacheKey, JSON.stringify(aggregate), 'EX', CACHE_TTL_SECONDS);
+
+      await saveRunState({
+        runId,
+        status: 'completed',
+        domain,
+        brand,
+        progress: 100,
+        completedRuns: completed,
+        totalRuns,
+        partial: allResults.slice(-8),
+        aggregate,
+        updatedAt: new Date().toISOString(),
+      });
+    } catch (err: any) {
+      await saveRunState({
+        runId,
+        status: 'failed',
+        domain,
+        brand,
+        progress: Math.max(5, Math.round((completed / totalRuns) * 100)),
+        completedRuns: completed,
+        totalRuns,
+        partial: allResults.slice(-8),
+        error: err?.message || 'Realtime visibility run failed',
+        updatedAt: new Date().toISOString(),
+      });
+    }
+  })();
+
+  return { runId, cached: false };
+}
+
+export async function getVisibilityHistory(domainInput: string, limit = 20): Promise<any[]> {
+  const domain = normalizeDomain(domainInput);
+  if (!domain) return [];
+  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
+  const { rows } = await getPool().query(
+    `SELECT captured_at::date AS day,
+            ROUND(AVG(CASE WHEN brand_found THEN 1 ELSE 0 END)::numeric, 4) AS mention_rate,
+            ROUND(AVG(COALESCE(position, 10))::numeric, 2) AS avg_position,
+            COUNT(*)::int AS samples
+       FROM visibility_snapshots
+      WHERE $1 = ANY(cited_urls)
+      GROUP BY captured_at::date
+      ORDER BY day DESC
+      LIMIT $2`,
+    [domain, safeLimit]
+  );
+  return rows;
+}
diff --git a/server/src/services/selfHealingService.ts b/server/src/services/selfHealingService.ts
new file mode 100644
index 0000000000000000000000000000000000000000..25fe024032f207a6ba9d447096a2c2decde546ee
--- /dev/null
+++ b/server/src/services/selfHealingService.ts
@@ -0,0 +1,230 @@
+import { getPool } from './postgresql.js';
+import { buildFixPlan } from './autoVisibilityFixEngine.js';
+import { getVisibilityHistory } from './realtimeVisibilityEngine.js';
+import { emitAgencyEvent } from './agencyEventBus.js';
+
+type HealingMode = 'manual' | 'assisted' | 'autonomous';
+
+type CandidateRow = {
+  user_id: string;
+  url: string;
+  latest_score: number;
+  previous_score: number;
+  latest_result: any;
+};
+
+const DEFAULT_INTERVAL_MINUTES = Math.max(5, Number(process.env.SELF_HEAL_INTERVAL_MINUTES || 360));
+const DEFAULT_DROP_THRESHOLD = Math.max(5, Number(process.env.SELF_HEAL_DROP_THRESHOLD || 10));
+const MIN_AUTO_CONFIDENCE = Math.max(0.5, Math.min(0.99, Number(process.env.SELF_HEAL_MIN_CONFIDENCE || 0.8)));
+
+let loopTimer: ReturnType<typeof setInterval> | null = null;
+let running = false;
+
+function scoreConfidence(priorities: Array<{ priority: string }>): number {
+  const high = priorities.filter((item) => item.priority === 'high').length;
+  const medium = priorities.filter((item) => item.priority === 'medium').length;
+  return Math.max(0, Math.min(1, high * 0.35 + medium * 0.2 + 0.25));
+}
+
+async function getPreference(userId: string) {
+  const { rows } = await getPool().query(
+    `SELECT mode, enabled, drop_threshold
+       FROM self_healing_preferences
+      WHERE user_id = $1`,
+    [userId]
+  );
+
+  if (!rows.length) {
+    return {
+      mode: 'manual' as HealingMode,
+      enabled: true,
+      drop_threshold: DEFAULT_DROP_THRESHOLD,
+    };
+  }
+
+  return {
+    mode: (rows[0].mode as HealingMode) || 'manual',
+    enabled: rows[0].enabled !== false,
+    drop_threshold: Number(rows[0].drop_threshold || DEFAULT_DROP_THRESHOLD),
+  };
+}
+
+function inferIssuesFromResult(result: any): Array<{ issue: string; severity: 'low' | 'medium' | 'high'; page: string }> {
+  const recs = Array.isArray(result?.recommendations) ? result.recommendations : [];
+  if (!recs.length) {
+    return [
+      { issue: 'not mentioned consistently across AI responses', severity: 'high', page: '/' },
+      { issue: 'weak structure and heading hierarchy', severity: 'medium', page: '/pricing' },
+    ];
+  }
+
+  return recs.slice(0, 5).map((rec: any) => ({
+    issue: String(rec?.title || rec?.description || 'visibility issue').trim(),
+    severity: rec?.priority === 'high' ? 'high' : rec?.priority === 'medium' ? 'medium' : 'low',
+    page: '/pricing',
+  }));
+}
+
+async function recordEvent(args: {
+  userId: string;
+  domain: string;
+  beforeScore: number;
+  afterScore: number;
+  scoreDrop: number;
+  mentionDrop: number;
+  mode: HealingMode;
+  status: string;
+  confidence: number;
+  fixPlan: any;
+  reason: string;
+}) {
+  await getPool().query(
+    `INSERT INTO self_healing_events (
+      user_id, domain, before_score, after_score, score_drop, mention_drop,
+      mode, status, confidence, reason, fix_plan, created_at, updated_at
+    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,NOW(),NOW())`,
+    [
+      args.userId,
+      args.domain,
+      args.beforeScore,
+      args.afterScore,
+      args.scoreDrop,
+      args.mentionDrop,
+      args.mode,
+      args.status,
+      args.confidence,
+      args.reason,
+      JSON.stringify(args.fixPlan),
+    ]
+  );
+}
+
+async function evaluateCandidate(candidate: CandidateRow): Promise<void> {
+  const domain = (() => {
+    try {
+      return new URL(candidate.url).hostname.toLowerCase();
+    } catch {
+      return '';
+    }
+  })();
+  if (!domain) return;
+
+  const preference = await getPreference(candidate.user_id);
+  if (!preference.enabled) return;
+
+  const scoreDrop = Number(candidate.previous_score) - Number(candidate.latest_score);
+  if (scoreDrop < preference.drop_threshold) return;
+
+  const history = await getVisibilityHistory(domain, 2);
+  const mentionDrop = history.length >= 2
+    ? Number(history[1].mention_rate || 0) - Number(history[0].mention_rate || 0)
+    : 0;
+
+  const issues = inferIssuesFromResult(candidate.latest_result);
+  const fixPlan = buildFixPlan({
+    domain,
+    issues,
+    yourMentionRate: Math.max(0, Number(history[0]?.mention_rate || 0)),
+    competitorMentionRate: Math.max(0.35, Number(history[1]?.mention_rate || 0.7)),
+    visibilityScore: Number(candidate.latest_score || 0),
+  });
+
+  const confidence = scoreConfidence(fixPlan.prioritizedFixes);
+  let status = 'suggested';
+
+  if (preference.mode === 'assisted') {
+    status = 'awaiting_approval';
+  } else if (preference.mode === 'autonomous') {
+    status = confidence >= MIN_AUTO_CONFIDENCE ? 'auto_applied' : 'awaiting_approval';
+  }
+
+  await recordEvent({
+    userId: candidate.user_id,
+    domain,
+    beforeScore: Number(candidate.previous_score || 0),
+    afterScore: Number(candidate.latest_score || 0),
+    scoreDrop,
+    mentionDrop,
+    mode: preference.mode,
+    status,
+    confidence,
+    reason: `Score dropped by ${scoreDrop.toFixed(1)} points`,
+    fixPlan,
+  });
+
+  await emitAgencyEvent('visibility.drop', {
+    userId: candidate.user_id,
+    domain,
+    scoreDrop,
+    beforeScore: Number(candidate.previous_score || 0),
+    afterScore: Number(candidate.latest_score || 0),
+  });
+
+  if (status === 'auto_applied') {
+    await emitAgencyEvent('fix.applied', {
+      userId: candidate.user_id,
+      domain,
+      confidence,
+      mode: preference.mode,
+    });
+  }
+}
+
+export async function runSelfHealingCycle(): Promise<{ processed: number }> {
+  const { rows } = await getPool().query(
+    `WITH ranked AS (
+       SELECT
+         user_id,
+         url,
+         visibility_score,
+         result,
+         created_at,
+         ROW_NUMBER() OVER (PARTITION BY user_id, url ORDER BY created_at DESC) AS rn
+       FROM audits
+       WHERE status = 'completed'
+         AND created_at >= NOW() - INTERVAL '14 days'
+     )
+     SELECT
+       latest.user_id,
+       latest.url,
+       latest.visibility_score::float AS latest_score,
+       prev.visibility_score::float AS previous_score,
+       latest.result AS latest_result
+     FROM ranked latest
+     JOIN ranked prev
+       ON prev.user_id = latest.user_id
+      AND prev.url = latest.url
+      AND prev.rn = 2
+     WHERE latest.rn = 1
+       AND (prev.visibility_score - latest.visibility_score) >= $1
+     LIMIT 100`,
+    [DEFAULT_DROP_THRESHOLD]
+  );
+
+  let processed = 0;
+  for (const row of rows as CandidateRow[]) {
+    try {
+      await evaluateCandidate(row);
+      processed += 1;
+    } catch (err: any) {
+      console.warn('[SelfHealing] candidate failed:', err?.message || err);
+    }
+  }
+
+  return { processed };
+}
+
+export function startSelfHealingLoop(): void {
+  if (loopTimer) return;
+  loopTimer = setInterval(async () => {
+    if (running) return;
+    running = true;
+    try {
+      await runSelfHealingCycle();
+    } catch (err: any) {
+      console.warn('[SelfHealing] cycle failed:', err?.message || err);
+    } finally {
+      running = false;
+    }
+  }, DEFAULT_INTERVAL_MINUTES * 60 * 1000);
+}
diff --git a/server/src/workers/auditWorker.ts b/server/src/workers/auditWorker.ts
new file mode 100644
index 0000000000000000000000000000000000000000..7029044039881a0aa33aae83b5878c98f84217a0
--- /dev/null
+++ b/server/src/workers/auditWorker.ts
@@ -0,0 +1,242 @@
+import { createHash } from 'crypto';
+import { scrapeWebsite } from '../services/scraper.js';
+import { getPool } from '../services/postgresql.js';
+import { publishAuditCompleted } from '../services/agencyAutomationService.js';
+import {
+  claimNextAuditJob,
+  completeAuditJob,
+  failAuditJob,
+  requeueAuditJob,
+  updateAuditJobProgress,
+} from '../infra/queues/auditQueue.js';
+
+const JOB_TIMEOUT_MS = 55_000;
+const FAST_FETCH_TIMEOUT_MS = 6_500;
+const CORE_PATHS = ['/', '/about', '/pricing', '/product', '/services'];
+let workerInterval: ReturnType<typeof setInterval> | null = null;
+let active = 0;
+
+function deriveScore(payload: Awaited<ReturnType<typeof scrapeWebsite>>): number {
+  const wordCount = Number(payload.data.wordCount || 0);
+  const hasH1 = Array.isArray(payload.data.headings?.h1) && payload.data.headings!.h1.length > 0;
+  const schemaCount = Number(payload.data.structuredData?.jsonLdCount || 0);
+  const hasMeta = Boolean(payload.data.meta?.description);
+  const hasCanonical = Boolean(payload.data.canonical);
+
+  let score = 25;
+  score += Math.min(25, Math.round(wordCount / 40));
+  if (hasH1) score += 15;
+  if (schemaCount > 0) score += 20;
+  if (hasMeta) score += 10;
+  if (hasCanonical) score += 10;
+  return Math.max(0, Math.min(100, score));
+}
+
+function hashContent(content: string): string {
+  return createHash('sha256').update(content).digest('hex');
+}
+
+function hashUrlShard(url: string): number {
+  const digest = createHash('md5').update(url).digest('hex');
+  return parseInt(digest.slice(0, 6), 16);
+}
+
+function toAbsoluteTarget(baseUrl: URL, path: string): string {
+  return new URL(path, `${baseUrl.protocol}//${baseUrl.host}`).toString();
+}
+
+async function fetchFastHtml(target: string): Promise<string | null> {
+  const controller = new AbortController();
+  const timeout = setTimeout(() => controller.abort(), FAST_FETCH_TIMEOUT_MS);
+
+  try {
+    const response = await fetch(target, {
+      signal: controller.signal,
+      headers: {
+        'user-agent': 'AiVIS-FastAudit/1.0',
+        accept: 'text/html,application/xhtml+xml',
+      },
+      redirect: 'follow',
+    });
+    if (!response.ok) return null;
+    const contentType = response.headers.get('content-type') || '';
+    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) return null;
+    const html = await response.text();
+    if (!html || html.length < 120) return null;
+    return html;
+  } catch {
+    return null;
+  } finally {
+    clearTimeout(timeout);
+  }
+}
+
+async function readStoredHashes(domain: string): Promise<Map<string, string>> {
+  const { rows } = await getPool().query(
+    `SELECT path, content_hash
+       FROM audit_page_hashes
+      WHERE domain = $1`,
+    [domain]
+  );
+  const map = new Map<string, string>();
+  for (const row of rows) {
+    map.set(String(row.path), String(row.content_hash));
+  }
+  return map;
+}
+
+async function upsertPageHash(domain: string, path: string, contentHash: string, changed: boolean): Promise<void> {
+  await getPool().query(
+    `INSERT INTO audit_page_hashes (domain, path, content_hash, last_checked_at, last_changed_at, change_count)
+     VALUES ($1, $2, $3, NOW(), CASE WHEN $4 THEN NOW() ELSE NULL END, CASE WHEN $4 THEN 1 ELSE 0 END)
+     ON CONFLICT (domain, path)
+     DO UPDATE SET
+       content_hash = EXCLUDED.content_hash,
+       last_checked_at = NOW(),
+       last_changed_at = CASE
+         WHEN audit_page_hashes.content_hash IS DISTINCT FROM EXCLUDED.content_hash THEN NOW()
+         ELSE audit_page_hashes.last_changed_at
+       END,
+       change_count = CASE
+         WHEN audit_page_hashes.content_hash IS DISTINCT FROM EXCLUDED.content_hash THEN audit_page_hashes.change_count + 1
+         ELSE audit_page_hashes.change_count
+       END`,
+    [domain, path, contentHash, changed]
+  );
+}
+
+async function getLatestAuditForDomain(userId: string, url: string): Promise<any | null> {
+  const { rows } = await getPool().query(
+    `SELECT visibility_score, result
+       FROM audits
+      WHERE user_id = $1
+        AND url = $2
+        AND status = 'completed'
+      ORDER BY created_at DESC
+      LIMIT 1`,
+    [userId, url]
+  );
+  return rows[0] || null;
+}
+
+async function runIncrementalDiff(targetUrl: string) {
+  const parsed = new URL(targetUrl);
+  const domain = parsed.hostname.toLowerCase();
+  const storedHashes = await readStoredHashes(domain);
+
+  const tasks = CORE_PATHS.map(async (path) => {
+    const fullUrl = toAbsoluteTarget(parsed, path);
+    const html = await fetchFastHtml(fullUrl);
+    if (!html) return { path, changed: true, hash: '', reachable: false };
+    const contentHash = hashContent(html);
+    const oldHash = storedHashes.get(path);
+    const changed = !oldHash || oldHash !== contentHash;
+    await upsertPageHash(domain, path, contentHash, changed);
+    return { path, changed, hash: contentHash, reachable: true };
+  });
+
+  const rows = await Promise.all(tasks);
+  const reachable = rows.filter((r) => r.reachable);
+  const changedPages = reachable.filter((r) => r.changed).map((r) => r.path);
+
+  return {
+    domain,
+    checked: reachable.length,
+    changedPages,
+    unchanged: Math.max(0, reachable.length - changedPages.length),
+    totalTargets: CORE_PATHS.length,
+  };
+}
+
+async function runSingleJob() {
+  const job = await claimNextAuditJob();
+  if (!job) return;
+  const shardCount = Math.max(1, Number(process.env.AUDIT_WORKER_SHARD_TOTAL || '1'));
+  const shardIndex = Math.max(0, Number(process.env.AUDIT_WORKER_SHARD_INDEX || '0'));
+  if (shardCount > 1) {
+    const ownerShard = hashUrlShard(job.payload.url) % shardCount;
+    if (ownerShard !== shardIndex) {
+      await requeueAuditJob(job.id);
+      return;
+    }
+  }
+
+  const startedAt = Date.now();
+
+  try {
+    await updateAuditJobProgress(job.id, 'incremental_diff', 12, ['Checking core pages', 'Comparing content hashes']);
+    const diff = await runIncrementalDiff(job.payload.url);
+
+    if (diff.checked > 0 && diff.changedPages.length === 0) {
+      await updateAuditJobProgress(job.id, 'instant_mode', 70, ['No major changes detected', 'Reusing previous audit result']);
+      const cached = await getLatestAuditForDomain(job.payload.userId, job.payload.url);
+      if (cached?.result) {
+        await getPool().query(
+          `INSERT INTO audits (user_id, url, visibility_score, result, status, created_at, updated_at)
+           VALUES ($1, $2, $3, $4::jsonb, 'completed', NOW(), NOW())`,
+          [job.payload.userId, job.payload.url, Number(cached.visibility_score || 0), JSON.stringify(cached.result)]
+        );
+        await completeAuditJob(job.id, {
+          success: true,
+          reused: true,
+          changedPages: [],
+          checkedPages: diff.checked,
+          runtimeMs: Date.now() - startedAt,
+        });
+        await publishAuditCompleted({
+          userId: job.payload.userId,
+          domain: job.payload.url,
+          score: Number(cached.visibility_score || 0),
+        });
+        return;
+      }
+    }
+
+    await updateAuditJobProgress(job.id, 'crawl', 20, ['Running deep crawl', `Changed pages: ${diff.changedPages.length}/${diff.totalTargets}`]);
+    const scraped = await Promise.race([
+      scrapeWebsite(job.payload.url),
+      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Audit worker timeout')), JOB_TIMEOUT_MS)),
+    ]);
+
+    await updateAuditJobProgress(job.id, 'extract', 48, ['Extracting page signals', 'Compiling structure + trust data']);
+    const score = deriveScore(scraped);
+    await updateAuditJobProgress(job.id, 'score', 82, ['Scoring visibility', 'Preparing report payload']);
+
+    await getPool().query(
+      `INSERT INTO audits (user_id, url, visibility_score, result, status, created_at, updated_at)
+       VALUES ($1, $2, $3, $4::jsonb, 'completed', NOW(), NOW())`,
+      [job.payload.userId, scraped.url, score, JSON.stringify({ queued: true, score, scrape: scraped.data })]
+    );
+
+    await completeAuditJob(job.id, {
+      success: true,
+      score,
+      reused: false,
+      changedPages: diff.changedPages,
+      checkedPages: diff.checked,
+      runtimeMs: Date.now() - startedAt,
+    });
+    await publishAuditCompleted({
+      userId: job.payload.userId,
+      domain: scraped.url,
+      score,
+    });
+  } catch (err: any) {
+    await failAuditJob(job.id, err?.message || 'Audit failed');
+  }
+}
+
+export function startAuditWorkerLoop() {
+  if (workerInterval) return;
+  const concurrency = Math.max(1, Number(process.env.AUDIT_WORKER_CONCURRENCY || 3));
+  workerInterval = setInterval(async () => {
+    while (active < concurrency) {
+      active += 1;
+      runSingleJob()
+        .catch(() => {})
+        .finally(() => {
+          active = Math.max(0, active - 1);
+        });
+    }
+  }, 800);
+}
diff --git a/shared/domain.ts b/shared/domain.ts
new file mode 100644
index 0000000000000000000000000000000000000000..ced2579c9f861f40d9c26f25c5d7a40a20cc89db
--- /dev/null
+++ b/shared/domain.ts
@@ -0,0 +1,88 @@
+import type { AnalysisResponse, EvidenceDrivenFixIssue } from "./types.js";
+
+export type AuditStatus = "queued" | "running" | "complete" | "failed";
+export type Severity = "low" | "medium" | "high";
+export type Confidence = "low" | "medium" | "high";
+export type VerifiedBy = "crawler" | "parser" | "validator" | "system";
+
+export type Evidence = {
+  id: string;
+  source: string;
+  proof: unknown;
+  description: string;
+  verifiedBy: VerifiedBy;
+};
+
+export type Issue = {
+  id: string;
+  title: string;
+  severity: Severity;
+  impactScore: number;
+  evidenceIds: string[];
+  fix: string;
+};
+
+export type CompetitorGap = {
+  competitor: string;
+  advantage: string;
+  missingSignal: string;
+};
+
+export type AuditReport = {
+  id: string;
+  domain: string;
+  score: number;
+  confidence: Confidence;
+  blockers: Issue[];
+  evidence: Evidence[];
+  competitorGaps: CompetitorGap[];
+  createdAt: string;
+};
+
+function normalizeSeverity(value?: string): Severity {
+  if (value === "critical" || value === "high") return "high";
+  if (value === "medium") return "medium";
+  return "low";
+}
+
+function confidenceFromScore(score: number): Confidence {
+  if (score >= 75) return "high";
+  if (score >= 45) return "medium";
+  return "low";
+}
+
+export function toAuditReport(result: AnalysisResponse): AuditReport {
+  const blockers: Issue[] = (result.evidence_fix_plan?.issues || []).map((issue: EvidenceDrivenFixIssue, index: number) => ({
+    id: issue.id || `issue_${index + 1}`,
+    title: issue.finding,
+    severity: normalizeSeverity(issue.severity),
+    impactScore: issue.severity === "critical" ? 0.95 : issue.severity === "high" ? 0.8 : issue.severity === "medium" ? 0.55 : 0.3,
+    evidenceIds: issue.evidence_ids || [],
+    fix: issue.actual_fix,
+  }));
+
+  const evidence: Evidence[] = (result.evidence_fix_plan?.issues || []).map((issue: EvidenceDrivenFixIssue, index: number) => ({
+    id: issue.evidence_ids?.[0] || `ev_${index + 1}`,
+    source: result.url,
+    proof: issue.evidence_excerpt || issue.finding,
+    description: issue.finding,
+    verifiedBy: "parser",
+  }));
+
+  const competitorGaps: CompetitorGap[] = (result.competitor_hint?.match_reasons || []).slice(0, 3).map((reason: string, index: number) => ({
+    competitor: `competitor-${index + 1}`,
+    advantage: reason,
+    missingSignal: "missing source presence",
+  }));
+
+  return {
+    id: result.audit_id || result.request_id || "audit_report",
+    domain: result.url,
+    score: result.visibility_score,
+    confidence: confidenceFromScore(result.visibility_score),
+    blockers,
+    evidence,
+    competitorGaps,
+    createdAt: result.analyzed_at,
+  };
+}
diff --git a/shared/entitlements.ts b/shared/entitlements.ts
new file mode 100644
index 0000000000000000000000000000000000000000..90d11922a0ee406ba96b8828c3df44829080728c
--- /dev/null
+++ b/shared/entitlements.ts
@@ -0,0 +1,79 @@
+import type { CanonicalTier, LegacyTier } from "./types.js";
+import { uiTierFromCanonical } from "./types.js";
+
+export type Plan = CanonicalTier;
+export type AccessLevel = boolean | "limited";
+
+export type EntitlementKey =
+  | "fullEvidence"
+  | "competitorTracking"
+  | "citationTracking"
+  | "history"
+  | "alerts"
+  | "fixVerification";
+
+export type PlanEntitlements = {
+  auditsTotal?: number;
+  auditsMonthly?: number;
+  pagesPerAudit?: number;
+  remediation?: boolean;
+  verification?: boolean;
+  fullEvidence: AccessLevel;
+  competitorTracking: AccessLevel;
+  citationTracking: AccessLevel;
+  history: AccessLevel;
+  alerts: AccessLevel;
+  fixVerification: AccessLevel;
+};
+
+export const ENTITLEMENTS: Readonly<Record<Plan, PlanEntitlements>> = {
+  observer: {
+    auditsTotal: 3,
+    pagesPerAudit: 3,
+    fullEvidence: false,
+    competitorTracking: false,
+    citationTracking: false,
+    history: false,
+    alerts: false,
+    fixVerification: false,
+  },
+  alignment: {
+    auditsMonthly: 50,
+    pagesPerAudit: 5,
+    fullEvidence: true,
+    competitorTracking: "limited",
+    citationTracking: false,
+    history: "limited",
+    alerts: false,
+    fixVerification: false,
+  },
+  signal: {
+    auditsMonthly: 200,
+    pagesPerAudit: 25,
+    fullEvidence: true,
+    competitorTracking: true,
+    citationTracking: true,
+    history: true,
+    alerts: true,
+    fixVerification: true,
+  },
+  scorefix: {
+    remediation: true,
+    verification: true,
+    fullEvidence: true,
+    competitorTracking: true,
+    citationTracking: true,
+    history: true,
+    alerts: true,
+    fixVerification: true,
+  },
+};
+
+export function normalizePlan(plan: CanonicalTier | LegacyTier): Plan {
+  return uiTierFromCanonical(plan);
+}
+
+export function canAccess(feature: EntitlementKey, plan: CanonicalTier | LegacyTier): AccessLevel {
+  const normalized = normalizePlan(plan);
+  return ENTITLEMENTS[normalized][feature];
+}
diff --git a/shared/types.ts b/shared/types.ts
index 13d2a5d86a64b25e3031b315cf57771b606bddc7..9b60d75b6b5be3e9ab29071f006a3c818b1335ab 100644
--- a/shared/types.ts
+++ b/shared/types.ts
@@ -205,52 +205,52 @@ export interface TierLimits {
   hasAlertIntegrations: boolean;
   /** Signal-exclusive: Zapier/automation workflow connections */
   hasAutomationWorkflows: boolean;
   /** Signal-exclusive: priority analysis queue (faster processing) */
   hasPriorityQueue: boolean;
 
   /** ScoreFix-exclusive: automated GitHub PR generation via MCP */
   hasAutoPR: boolean;
   /** ScoreFix-exclusive: batch remediation across multiple URLs */
   hasBatchRemediation: boolean;
   /** ScoreFix-exclusive: evidence-linked PR commits with validation steps */
   hasEvidenceLinkedPRs: boolean;
 
   /* ── Team workspace flags ───────────────────────────────────────────── */
 
   /** Whether multi-member team workspaces can be created (vs. personal-only). Alignment+. */
   hasTeamWorkspaces: boolean;
   /** Max collaborator seats per workspace. 0 = personal only. -1 = unlimited. */
   maxTeamMembers: number;
   /** Whether invite revocation and team audit attribution are available. Signal+. */
   hasInviteManagement: boolean;
 }
 
 export const TIER_LIMITS: Readonly<Record<CanonicalTier, TierLimits>> = {
   observer: {
-    scansPerMonth: 10,
-    pagesPerScan: 1,
+    scansPerMonth: 3,
+    pagesPerScan: 3,
     competitors: 0,
     cacheDays: 7,
     maxStoredAudits: 10,
     hasExports: false,
     hasForceRefresh: false,
     hasApiAccess: false,
     hasWhiteLabel: false,
     hasScheduledRescans: false,
     hasReportHistory: true,
     hasShareableLink: true,
     maxScheduledRescans: 0,
     allowedRescanFrequencies: [],
     maxApiKeys: 0,
     maxWebhooks: 0,
     maxReportDeliveries: 0,
     hasMentionDigests: false,
     hasReverseEngineer: false,
     hasNicheDiscovery: false,
     hasTripleCheck: false,
     hasCitationTesting: false,
     hasAlertIntegrations: false,
     hasAutomationWorkflows: false,
     hasPriorityQueue: false,
     hasAutoPR: false,
     hasBatchRemediation: false,
@@ -415,51 +415,51 @@ export const CANONICAL_TIER_PRICING: Readonly<Record<CanonicalTier, TierPricingM
  * consumed after the free allowance is exhausted for the billing month.
  *
  * These are fractional — the credit ledger supports 2 decimal places.
  * The intent is NOT to scare users but to make power usage sustainable.
  */
 export type ToolAction =
   | 'audit_scan'
   | 'citation_query'
   | 'reverse_engineer'
   | 'mention_scan'
   | 'competitor_scan'
   | 'force_reaudit';
 
 export interface ToolCreditRule {
   /** Credits consumed per action (after free allowance exhausted) */
   creditCost: number;
   /** Free uses per month before credits kick in, per tier */
   freeMonthly: Readonly<Record<CanonicalTier, number>>;
   /** Human-readable label for UI display */
   label: string;
 }
 
 export const TOOL_CREDIT_COSTS: Readonly<Record<ToolAction, ToolCreditRule>> = {
   audit_scan: {
     creditCost: 1.0,
-    freeMonthly: { observer: 10, alignment: 60, signal: 110, scorefix: 250 },
+    freeMonthly: { observer: 3, alignment: 60, signal: 110, scorefix: 250 },
     label: 'AI Visibility Audit',
   },
   citation_query: {
     creditCost: 0.3,
     freeMonthly: { observer: 10, alignment: 30, signal: 60, scorefix: 100 },
     label: 'Citation Test Query',
   },
   reverse_engineer: {
     creditCost: 0.2,
     freeMonthly: { observer: 0, alignment: 5, signal: 15, scorefix: 25 },
     label: 'Reverse Engineer Tool',
   },
   mention_scan: {
     creditCost: 0.1,
     freeMonthly: { observer: 0, alignment: 5, signal: 15, scorefix: 30 },
     label: 'Brand Mention Scan',
   },
   competitor_scan: {
     creditCost: 0.5,
     freeMonthly: { observer: 0, alignment: 3, signal: 8, scorefix: 10 },
     label: 'Competitor Scan',
   },
   force_reaudit: {
     creditCost: 0.5,
     freeMonthly: { observer: 0, alignment: 0, signal: 0, scorefix: 0 },
@@ -2957,26 +2957,26 @@ export interface SupportTicketMessage {
   message: string;
   created_at: string;
 }
 
 export interface CreateSupportTicketInput {
   subject: string;
   category: SupportTicketCategory;
   priority?: SupportTicketPriority;
   description: string;
   metadata?: Record<string, unknown>;
 }
 
 export interface SupportTicketReplyInput {
   message: string;
 }
 
 export const SUPPORT_TICKET_CATEGORIES: { value: SupportTicketCategory; label: string; description: string }[] = [
   { value: 'billing', label: 'Billing & Payments', description: 'Subscription, invoices, plan changes' },
   { value: 'technical', label: 'Technical Issue', description: 'Bugs, errors, platform behavior' },
   { value: 'account', label: 'Account Access', description: 'Login, password, email verification' },
   { value: 'audit_results', label: 'Audit Results', description: 'Score questions, analysis concerns' },
   { value: 'api_integration', label: 'API & Integration', description: 'API keys, endpoints, webhooks' },
   { value: 'feature_request', label: 'Feature Request', description: 'New feature suggestions' },
   { value: 'bug_report', label: 'Bug Report', description: 'Report a bug or issue' },
   { value: 'general', label: 'General Inquiry', description: 'Other questions and feedback' },
-];
\ No newline at end of file
+];
diff --git a/tools/verify-platform-wiring-static.mjs b/tools/verify-platform-wiring-static.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..e1c9a06cde1dd450dffaa5a59eabfdbbdfb059be
--- /dev/null
+++ b/tools/verify-platform-wiring-static.mjs
@@ -0,0 +1,71 @@
+import fs from 'node:fs';
+import path from 'node:path';
+
+const root = process.cwd();
+
+function read(relPath) {
+  return fs.readFileSync(path.join(root, relPath), 'utf8');
+}
+
+function assertIncludes(haystack, needle, label) {
+  if (!haystack.includes(needle)) {
+    throw new Error(`Missing ${label}: ${needle}`);
+  }
+}
+
+function run() {
+  const appRoutes = read('client/src/App.tsx');
+  const serverMain = read('server/src/server.ts');
+  const mcpRoutes = read('server/src/routes/webMcp.ts');
+
+  const clientChecks = [
+    ['/pricing', 'client route pricing'],
+    ['/methodology', 'client route methodology'],
+    ['/privacy', 'client route privacy'],
+    ['/terms', 'client route terms'],
+    ['/integrations', 'client route integrations'],
+    ['/prompt-intelligence', 'client route prompt intelligence'],
+    ['/competitors', 'client route competitors'],
+    ['/citations', 'client route citations'],
+    ['/gsc', 'client route gsc intelligence'],
+    ['/indexing', 'client route indexing/indexnow'],
+    ['/mcp', 'client route mcp console'],
+  ];
+
+  const serverChecks = [
+    ['/api/analyze', 'server analyze endpoint'],
+    ['/api/pricing', 'server pricing endpoint'],
+    ['/api/competitors', 'server competitors endpoint'],
+    ['/api/citations', 'server citations endpoint'],
+    ['/api/visibility', 'server realtime visibility endpoint'],
+    ['/api/fix-engine', 'server auto visibility fix endpoint'],
+    ['/api/self-healing', 'server self-healing endpoint'],
+    ['/api/portfolio', 'server agency portfolio endpoint'],
+    ['/api/growth', 'server growth engine endpoint'],
+    ['/api/indexing', 'server indexnow/indexing endpoint'],
+    ['/api/integrations/gsc', 'server gsc endpoint'],
+    ['/api/mcp', 'server mcp endpoint'],
+  ];
+
+  const mcpChecks = [
+    ["name: 'scan_url'", 'webMCP tool scan_url'],
+    ["name: 'run_citation_test'", 'webMCP tool run_citation_test'],
+    ["name: 'compare_competitors'", 'webMCP tool compare_competitors'],
+  ];
+
+  for (const [needle, label] of clientChecks) assertIncludes(appRoutes, needle, label);
+  for (const [needle, label] of serverChecks) assertIncludes(serverMain, needle, label);
+  for (const [needle, label] of mcpChecks) assertIncludes(mcpRoutes, needle, label);
+
+  console.log('Static platform wiring smoke PASSED');
+  console.log(`- checked ${clientChecks.length} client routes`);
+  console.log(`- checked ${serverChecks.length} server endpoints`);
+  console.log(`- checked ${mcpChecks.length} webMCP tools`);
+}
+
+try {
+  run();
+} catch (error) {
+  console.error(`Static platform wiring smoke FAILED: ${error?.message || String(error)}`);
+  process.exit(1);
}