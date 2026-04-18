// client/src/utils/insightGenerator.ts
import type { AnalysisResponse, Recommendation } from "@shared/types";
import { Zap, Activity, Target, Eye, FileText, TrendingUp, Shield } from "lucide-react";
import { createElement } from "react";

export interface RichInsight {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: "cyan" | "purple" | "coral";
  priority: "critical" | "high" | "medium";
  impact: string;
  detailedAnalysis: string;
  actionSteps: string[];
  expectedOutcome: string;
  timeframe: string;
  difficulty: "easy" | "medium" | "hard";
  resources?: { title: string; description: string }[];
}

function recommendationToInsight(rec: Recommendation, result: AnalysisResponse, index: number): RichInsight {
  const priorityMap: Record<string, "critical" | "high" | "medium"> = {
    high: "critical",
    medium: "high",
    low: "medium",
  };
  const difficultyMap: Record<string, "easy" | "medium" | "hard"> = {
    easy: "easy",
    medium: "medium",
    hard: "hard",
  };

  const priority = priorityMap[rec.priority] || "medium";
  const color: "cyan" | "purple" | "coral" = priority === "critical" ? "coral" : priority === "high" ? "purple" : "cyan";
  const iconByCategory: Record<string, any> = {
    schema: FileText,
    content: Activity,
    technical: Shield,
    readability: Eye,
    authority: TrendingUp,
    structure: Target,
  };

  const categoryKey = (rec.category || "").toLowerCase();
  const icon = createElement(
    Object.keys(iconByCategory).find((k) => categoryKey.includes(k))
      ? iconByCategory[Object.keys(iconByCategory).find((k) => categoryKey.includes(k)) as string]
      : Zap,
    { className: "w-5 h-5" },
  );

  const measuredContext = [
    `Visibility score: ${result.visibility_score}/100`,
    `Word count: ${result.content_analysis?.word_count || 0}`,
    `Schema count: ${result.schema_markup?.json_ld_count || 0}`,
    `HTTPS: ${result.technical_signals?.https_enabled ? "enabled" : "disabled"}`,
  ].join(" · ");

  const implementationText =
    typeof rec.implementation === "string"
      ? rec.implementation
      : rec.implementation == null
        ? ""
        : String(rec.implementation);

  const implementationSteps = implementationText
    .split(/\n|\r|\.|;/)
    .map((step) => step.trim())
    .filter(Boolean)
    .slice(0, 8);

  return {
    id: rec.id || `rec-${index}`,
    icon,
    title: rec.priority === "low" ? `${String(rec.title || "Recommendation")} (Optional)` : String(rec.title || "Recommendation"),
    description: String(rec.description || "No description provided."),
    color,
    priority,
    impact: String(rec.impact || "Moderate improvement"),
    detailedAnalysis: `This recommendation is generated from your latest live audit results and should be treated as a real implementation item.\n\nMeasured audit context: ${measuredContext}.\n\nCategory: ${rec.category}${rec.evidence_ids?.length ? `\nEvidence IDs: ${rec.evidence_ids.join(", ")}` : ""}`,
    actionSteps: implementationSteps.length > 0 ? implementationSteps : ["Implement the change described above and rerun the audit to verify score/category improvement."],
    expectedOutcome: "Improves the related audit category and increases the likelihood of stronger AI visibility on subsequent re-audits.",
    timeframe: rec.estimatedTimeMinutes ? `${rec.estimatedTimeMinutes} min` : undefined,
    difficulty: difficultyMap[rec.difficulty] || "medium",
    resources: rec.evidence_ids?.length
      ? [{ title: "Evidence references", description: rec.evidence_ids.join(", ") }]
      : undefined,
  };
}

export function generateRichInsights(result: AnalysisResponse): RichInsight[] {
  if (Array.isArray(result.recommendations) && result.recommendations.length > 0) {
    return result.recommendations.map((rec, index) => recommendationToInsight(rec, result, index));
  }

  const insights: RichInsight[] = [];

  // Safely extract nested data
  const contentData = result.content_analysis;
  const schemaData = result.schema_markup;
  const technicalData = result.technical_signals;
  const score = result.visibility_score ?? 0;
  const topicalKeywords = result.topical_keywords;

  // Helper to check existence before accessing properties
  const hasContentData = contentData !== undefined && contentData !== null;
  const hasTechnicalData = technicalData !== undefined && technicalData !== null;
  const hasSchemaData = schemaData !== undefined && schemaData !== null;

  // Critical: Missing Structured Data
  if (hasSchemaData && (schemaData.json_ld_count || 0) === 0) {
    insights.push({
      id: "schema-markup",
      icon: createElement(FileText, { className: "w-5 h-5" }),
      title: "Implement Structured Data (Critical)",
      description: "Your website has no Schema.org markup, severely limiting AI understanding and citation potential.",
      color: "coral",
      priority: "critical",
      impact: "Structured data materially improves AI interpretability and citation potential. Without it, AI systems must infer intent from raw markup, which often reduces visibility across major answer engines.",
      detailedAnalysis: `Schema.org JSON-LD is how AI search engines classify your content. Without it, they guess, and usually guess wrong.

Why it matters:
1. AI crawlers look for explicit type signals (Article, FAQ, Product, Organization)
2. Pages with well-implemented FAQ schema are more likely to be selected for direct-answer citations
3. Google AI Overviews pull structured data directly into rich results
4. Without schema, your page is typically disadvantaged versus competitors with explicit machine-readable structure

What you're missing right now:
- No machine-readable content classification → AI must infer meaning from raw HTML
- No FAQ signals → question-answer queries bypass your site entirely
- No Organization entity → AI can't associate your content with a trusted brand

Every day without structured data is traffic lost to schema-equipped competitors.`,
      actionSteps: [
        "Choose appropriate schema types: Start with Article schema for blog posts, FAQ schema for Q&A content, Organization schema for your company info, and Product schema if you sell anything.",
        "Use Google's Structured Data Markup Helper (https://www.google.com/webmasters/markup-helper/) to generate your first JSON-LD schema - it's free and takes 10 minutes.",
        "Add the generated JSON-LD code to your HTML <head> section or right before the closing </body> tag. No complex installation needed.",
        "Test your implementation with Google's Rich Results Test tool to ensure it's valid and error-free.",
        "Expand gradually: Add FAQ schema to pages with common questions, HowTo schema for tutorials, and Review schema for testimonials.",
        "Monitor Google Search Console for 'Enhancements' section to track which schemas are being recognized."
      ],
      expectedOutcome: "Within 2-4 weeks of implementation, teams often observe stronger eligibility for AI answer extraction, improved snippet selection, and clearer topical authority signals. Outcome magnitude varies by baseline quality and crawl cadence.",
      timeframe: "1-3 hours for initial implementation, ongoing optimization",
      difficulty: "easy",
      resources: [
        {
          title: "Schema.org Documentation",
          description: "Official schemas for all content types - comprehensive reference"
        },
        {
          title: "Google's Structured Data Guide",
          description: "Step-by-step tutorials with code examples and best practices"
        },
        {
          title: "JSON-LD Generator Tools",
          description: "Free tools that create schema markup without coding knowledge"
        },
        {
          title: "Schema Validator Extensions",
          description: "Browser extensions to test schema implementation instantly"
        }
      ]
    });
  }

  // Critical/High: Content Depth Issues
  if (hasContentData) {
    const wordCount = contentData.word_count || 0;
    if (wordCount < 800) {
      const isCritical = wordCount < 300;
      insights.push({
        id: "content-depth",
        icon: createElement(Activity, { className: "w-5 h-5" }),
        title: isCritical ? "Expand Content Immediately (Critical)" : "Increase Content Depth (High Priority)",
        description: `Your ${wordCount}-word content is ${isCritical ? "critically" : "significantly"} below AI search engines' threshold for comprehensive answers.`,
        color: isCritical ? "coral" : "purple",
        priority: isCritical ? "critical" : "high",
        impact: `AI systems like ChatGPT and Perplexity prioritize content that thoroughly answers user queries. Content with sufficient depth and structure is generally more likely to be cited in AI-generated responses. Your current ${wordCount} words may signal superficial coverage.`,
        detailedAnalysis: `AI search engines synthesize answers; they don't just match keywords. Your ${wordCount}-word page is falling short of what they need to cite you.

Key facts:
1. AI models weight comprehensive content 4–5× more than thin pages
2. Top-cited pages in AI results average 1,200–2,000 words
3. ChatGPT / Perplexity ask: "Does this page fully answer the query?" If not, they skip it
4. Thin content signals low expertise, making your entire domain less trustworthy

What's happening to your traffic:
- Users asking AI about your topic get answers sourced from deeper competitor pages
- Your page is evaluated, deemed insufficient, and not cited, making it invisible to the end user
- Each missed citation reinforces AI's preference for competitors over your domain

The fix isn't padding word count, it's adding genuine value: examples, data, steps, and FAQs that make your page the single best resource on the topic.`,
        actionSteps: [
          `Analyze search intent: For your target topic, what questions are users really asking? Use tools like AnswerThePublic or 'People Also Ask' boxes to identify 8-12 related questions.`,
          `Create a comprehensive outline: Organize your expanded content into clear sections with H2/H3 headings that directly answer specific questions. Aim for 5-8 major sections.`,
          `Add depth to each section: Include specific examples, data points, case studies, or step-by-step instructions. Each section should be 150-250 words minimum.`,
          `Include expert insights or unique perspectives: What can you share that competitors don't? Original research, real-world examples, or specific methodologies add differentiation.`,
          `Address common objections or variations: Anticipate follow-up questions and address them within the content. This signals completeness to AI systems.`,
          `Add visual elements: Screenshots, diagrams, or charts break up text and provide additional context that AI systems recognize as comprehensive coverage.`,
          `Write a strong conclusion with key takeaways: Summarize the 3-5 most important points, making it easy for AI to extract your core message.`
        ],
        expectedOutcome: "Content expanded with clearer structure often improves visibility signals within 3-4 weeks after recrawl. Teams usually see stronger answer inclusion and richer citation context compared with thin pages.",
        timeframe: "2-4 hours for 1000-word comprehensive rewrite",
        difficulty: "medium",
        resources: [
          {
            title: "AI Content Analyzer Tools",
            description: "Free tools showing how AI systems interpret your content depth"
          },
          {
            title: "Competitor Content Analysis",
            description: "Analyze top-ranking pages to understand depth expectations"
          },
          {
            title: "Content Outline Templates",
            description: "Proven structures for comprehensive topic coverage"
          },
          {
            title: "Readability Checkers",
            description: "Ensure expanded content maintains clarity for AI parsing"
          }
        ]
      });
    }
  }

  // Critical: Missing H1 Tag
  if (hasContentData && !contentData.has_proper_h1) {
    insights.push({
      id: "h1-tag",
      icon: createElement(Target, { className: "w-5 h-5" }),
      title: "Add H1 Heading Tag (Critical)",
      description: "Your page lacks an H1 tag, the primary signal AI systems use to understand your content's main topic.",
      color: "coral",
      priority: "critical",
      impact: "H1 tags are a strong primary-topic signal for both crawlers and answer engines. Without one, systems are less likely to confidently identify page focus, which can reduce citation probability.",
      detailedAnalysis: `The H1 is the #1 signal AI crawlers use to determine your page's topic. Without it, your page is effectively untitled.

How AI uses your H1:
1. Matches it against user queries to decide topical relevance
2. Extracts your primary claim or value proposition
3. Weights all content beneath it; a strong H1 amplifies everything below
4. Generates citations and summaries from it verbatim

Good vs. bad H1 examples:
-  "Welcome" or "Home": tells AI nothing about your expertise
-  "Our Services": too generic, lost among millions of identical H1s
-  "How to Implement Schema Markup for Better AI Visibility": specific, query-aligned
-  "Best Personal Injury Lawyer in Dallas - Free Case Review": niche, intent-rich

This is a 5-minute fix with outsized impact, and the single fastest way to improve your AI discoverability.`,
      actionSteps: [
        "Identify your page's single most important topic or question it answers. This becomes your H1.",
        "Write a clear, descriptive H1 (50-70 characters) using natural language. Include your primary keyword but prioritize clarity.",
        "Add the H1 tag immediately after your opening <body> tag or at the top of your main content area. Use <h1>Your Heading Here</h1>.",
        "Ensure you have ONLY ONE H1 per page - multiple H1s confuse AI systems about your primary topic.",
        "Make sure your H1 accurately reflects your content. Misleading H1s hurt AI trust signals.",
        "Use H2 and H3 tags for section headings to create a clear content hierarchy AI systems can parse easily."
      ],
      expectedOutcome: "Adding a clear, descriptive H1 tag usually improves interpretability after re-crawl, helping models better understand page focus. Exact score movement varies by page baseline.",
      timeframe: "5-10 minutes",
      difficulty: "easy",
      resources: [
        {
          title: "HTML Heading Best Practices",
          description: "Guidelines for creating effective H1-H6 structure"
        },
        {
          title: "Heading Tag Audit Tools",
          description: "Free tools to analyze your current heading structure"
        },
        {
          title: "AI-Optimized Heading Examples",
          description: "Real examples of H1s that perform well in AI search"
        }
      ]
    });
  }

  // High: HTTPS Security
  if (hasTechnicalData && !technicalData.https_enabled) {
    insights.push({
      id: "https-security",
      icon: createElement(Shield, { className: "w-5 h-5" }),
      title: "Enable HTTPS Encryption (High Priority)",
      description: "Your site lacks HTTPS, a critical trust signal for both users and AI search engines.",
      color: "purple",
      priority: "high",
      impact: "Non-HTTPS sites are commonly deprioritized by search and AI systems. HTTPS is a foundational trust signal; missing it can materially reduce citation eligibility.",
      detailedAnalysis: `HTTPS is a baseline trust gate. AI platforms won't cite sites they consider unsafe.

Why every AI platform cares:
1. Data integrity: HTTPS proves content hasn't been tampered with in transit
2. User safety: AI has ethical guardrails against directing users to insecure sites
3. Authority signal: authoritative sites almost always use HTTPS; lacking it can flag your page as outdated or risky

Direct consequences of no HTTPS:
- Google AI Overviews deprioritize non-secure pages
- ChatGPT's web browsing skips HTTP sites when HTTPS alternatives exist
- Perplexity discounts trust scores for non-encrypted domains
- Citation probability usually drops versus secure competitors

The fix is free and fast. Let's Encrypt provides certificates at no cost, and most hosts offer one-click SSL activation (typically under 30 minutes).`,
      actionSteps: [
        "Check if your hosting provider offers free SSL certificates (most do via Let's Encrypt or similar services).",
        "Enable HTTPS through your hosting control panel - often just a single toggle or button click.",
        "If your host doesn't provide SSL, purchase a certificate ($10-50/year) or use Cloudflare's free SSL proxy.",
        "After enabling SSL, update all internal links to use https:// instead of http://.",
        "Set up 301 redirects from HTTP to HTTPS to ensure all visitors use the secure version.",
        "Update your sitemap and Google Search Console settings to reflect the HTTPS version.",
        "Test thoroughly - check for mixed content warnings (HTTP resources loaded on HTTPS pages) using browser developer tools."
      ],
      expectedOutcome: "HTTPS implementation strengthens trust posture and technical eligibility quickly. Teams usually see improved crawl and trust outcomes after reprocessing, alongside stronger user confidence.",
      timeframe: "30 minutes to 2 hours depending on hosting setup",
      difficulty: "easy",
      resources: [
        {
          title: "Let's Encrypt Free SSL",
          description: "Free, automated SSL certificates trusted by all browsers"
        },
        {
          title: "Cloudflare Free SSL",
          description: "Free SSL proxy with additional performance benefits"
        },
        {
          title: "HTTPS Migration Checklist",
          description: "Complete guide to switching from HTTP to HTTPS safely"
        },
        {
          title: "SSL Test Tools",
          description: "Verify your SSL implementation is secure and valid"
        }
      ]
    });
  }

  // High/Medium: Optimize for AI Question-Answer Format
  if (score < 70) {
    insights.push({
      id: "qa-optimization",
      icon: createElement(Eye, { className: "w-5 h-5" }),
      title: "Optimize for Question-Answer Format (High Priority)",
      description: "Restructure content to directly answer user questions in a format AI systems prefer.",
      color: "cyan",
      priority: score < 50 ? "high" : "medium",
      impact: "Content formatted as clear question-answer pairs is generally easier for answer engines to extract and cite. This is one of the strongest practical content optimizations for AI visibility.",
      detailedAnalysis: `AI search is question-driven. Users ask ChatGPT / Perplexity natural-language questions, so your content must provide structured, extractable answers.

The winning Q&A format:
1. Use the exact question as an H2 heading (e.g., "How Do I Add Schema Markup?")
2. Follow with a 2-3 sentence direct answer; this is what AI extracts and cites
3. Expand with 150–300 words of supporting detail, examples, or steps
4. Repeat for 8–12 related questions on the page

Why this works:
- AI evaluates: "Does this page give a clear answer to query X?" Q&A format makes the answer unmistakable
- FAQ schema wrapping these pairs can improve citation consistency when the content is accurate and complete
- Each Q&A block is an independent citation target, so more blocks means more chances to appear

Common user query patterns to mirror:
- "How do I…" → step-by-step answers
- "What is the best…" → comparison + recommendation
- "Why does…" → cause-and-effect explanation
- "How much does…" → pricing / cost breakdown`,
      actionSteps: [
        "Research 8-12 common questions users ask about your topic using Google's 'People Also Ask' boxes, Reddit, Quora, or AI chat logs.",
        "Restructure your content with each question as an H2 heading, written exactly as users would ask it (e.g., 'How Do I Add Schema Markup to My Website?').",
        "Provide a concise 2-3 sentence answer immediately after each question heading. This is the 'snippet' AI systems will extract and cite.",
        "Follow each concise answer with 150-300 words of supporting detail, examples, or step-by-step instructions for users who want depth.",
        "Implement FAQ schema markup (JSON-LD) wrapping your Q&A pairs to explicitly signal the structure to AI systems.",
        "Use natural language throughout - write as if directly answering a human, not optimizing for keyword density.",
        "Test your content by asking ChatGPT or Perplexity your target questions and seeing if they cite your page. Iterate based on results."
      ],
      expectedOutcome: "Q&A-formatted content with accurate FAQ schema commonly improves answerability and citation consistency within 4-6 weeks. Impact depends on baseline structure, authority signals, and recrawl timing.",
      timeframe: "3-6 hours for comprehensive Q&A restructure",
      difficulty: "medium",
      resources: [
        {
          title: "FAQ Schema Generator",
          description: "Free tool to create FAQ JSON-LD from your Q&A content"
        },
        {
          title: "Question Research Tools",
          description: "Discover what questions users are actually asking"
        },
        {
          title: "AI Citation Analysis",
          description: "Tools showing how often your content is cited by AI platforms"
        },
        {
          title: "Q&A Content Templates",
          description: "Proven formats for maximum AI citability"
        }
      ]
    });
  }

  // Medium: Build Topical Authority
  if (score < 80 && (!topicalKeywords || topicalKeywords.length < 10)) {
    insights.push({
      id: "topical-authority",
      icon: createElement(TrendingUp, { className: "w-5 h-5" }),
      title: "Build Topical Authority (Medium Priority)",
      description: "Create comprehensive content clusters to establish expertise that AI systems recognize and reward.",
      color: "purple",
      priority: "medium",
      impact: "AI search engines heavily weight topical authority. Sites with a coherent cluster of high-quality related pages usually perform better for citation eligibility than one-off pages. This is long-term strategic positioning.",
      detailedAnalysis: `AI doesn't evaluate pages in isolation; it assesses your entire site's expertise. One page on a topic = generic. Ten interlinked pages = authority.

How topical authority works:
1. AI asks: "Is this site an expert, or a one-off page?" Depth wins
2. Content clusters (1 pillar + 8–15 subtopics) signal comprehensive expertise
3. Internal linking between cluster pages amplifies each page's authority
4. Sites with strong clusters maintain visibility even as algorithms change

Example: building authority for "Schema Markup":
- Pillar page: Schema Markup Fundamentals (2,000–3,000 words)
- Subtopic: How to Add FAQ Schema (step-by-step)
- Subtopic: Article Schema Best Practices
- Subtopic: Product Schema for E-Commerce
- Subtopic: Schema Validation & Troubleshooting
- Subtopic: Case Study - Schema implementation outcomes and lessons learned

Result: AI categorizes your site as a Schema authority → citations increase exponentially. One-off pages can't compete with a well-structured cluster.`,
      actionSteps: [
        "Identify your core expertise areas - topics where you have genuine knowledge and can create 10+ valuable pages.",
        "Create a topic map: one pillar page covering the broad topic (2000-3000 words), and 8-15 subtopic pages diving deep into specific aspects (800-1500 words each).",
        "Write the pillar page first, covering fundamentals and linking to all subtopic pages you'll create.",
        "Build out subtopic pages systematically, 1-2 per week. Each should comprehensively cover its specific aspect with unique insights.",
        "Interlink aggressively - pillar page links to all subtopics, subtopics link back to pillar and to related subtopics.",
        "Implement schema markup across all pages, using Article schema for guides and FAQ schema for Q&A sections.",
        "Update and refresh content quarterly - topical authority requires freshness. Add new subtopics as the field evolves.",
        "Monitor which pages AI systems cite most frequently and double down on similar content angles."
      ],
      expectedOutcome: "Building a high-quality topical cluster over 3-6 months generally improves authority coverage and cross-page citation opportunities versus isolated pages. Exact lift depends on quality, evidence strength, and crawl frequency.",
      timeframe: "Ongoing - 2-3 months for initial cluster, continuous expansion",
      difficulty: "hard",
      resources: [
        {
          title: "Topic Cluster Planning Templates",
          description: "Frameworks for organizing pillar + subtopic content structure"
        },
        {
          title: "Topical Authority Analysis Tools",
          description: "Measure your site's authority coverage vs competitors"
        },
        {
          title: "Content Calendar Systems",
          description: "Organize systematic cluster development over time"
        },
        {
          title: "Internal Linking Best Practices",
          description: "Strategies for effective cluster interlinking"
        }
      ]
    });
  }

  // Medium: Technical Performance Optimization
  if (score >= 50 && score < 80) {
    insights.push({
      id: "technical-performance",
      icon: createElement(Zap, { className: "w-5 h-5" }),
      title: "Optimize Technical Performance (Medium Priority)",
      description: "Improve page speed, mobile experience, and technical trust fundamentals for better AI crawlability.",
      color: "cyan",
      priority: "medium",
      impact: "Fast, technically sound sites are crawled more frequently and indexed more comprehensively by AI search engines. Performance affects both direct ranking and how often your updated content is discovered.",
      detailedAnalysis: `Content quality gets you cited, but technical performance determines whether AI can even access and crawl your content in the first place.

What AI crawlers require:
1. Page load under 3 seconds: ChatGPT's browser times out on slow pages
2. Clean semantic HTML: easier to parse = more content indexed
3. Mobile-first design: Perplexity deprioritizes poor mobile experiences
4. Canonical tags: prevents duplicate-content confusion in AI indexing
5. Core Web Vitals passing: Google AI Overviews use page experience as a ranking signal

Crawl budget impact:
- AI systems allocate limited time per domain, so slow sites get fewer pages crawled
- Slow page responses can reduce crawl depth and lower the share of content AI systems process reliably
- Fast, clean sites get crawled deeper and re-indexed more frequently

Priority note: Fix content gaps (thin pages, missing schemas) first. Once content is solid, technical optimization acts as a multiplier, and a well-structured 90/100 PageSpeed site compounds every content improvement you make.`,
      actionSteps: [
        "Run Google PageSpeed Insights on your key pages. Aim for scores above 90 for both mobile and desktop.",
        "Optimize images - compress all images using tools like TinyPNG or ImageOptim. Lazy-load images below the fold.",
        "Minimize CSS and JavaScript - remove unused code, minify files, and defer non-critical scripts.",
        "Implement browser caching to speed up repeat visits - set appropriate cache headers for static resources.",
        "Add canonical tags to all pages to prevent duplicate content issues - especially important for e-commerce sites.",
        "Ensure mobile responsiveness - test on actual mobile devices, not just browser emulation. Fix any layout issues or tiny text.",
        "Set up proper robots.txt and XML sitemap to guide AI crawlers to your most important content efficiently.",
        "Monitor Core Web Vitals in Google Search Console and address any failing metrics systematically."
      ],
      expectedOutcome: "Technical optimization generally improves AI visibility over 4-8 weeks, with compound benefits as systems crawl your site more reliably and comprehensively.",
      timeframe: "1-2 weeks for comprehensive technical audit and optimization",
      difficulty: "medium",
      resources: [
        {
          title: "Google PageSpeed Insights",
          description: "Free performance analysis with specific optimization recommendations"
        },
        {
          title: "Core Web Vitals Guide",
          description: "Understanding and improving key performance metrics"
        },
        {
          title: "Image Optimization Tools",
          description: "Compress images without visible quality loss"
        },
        {
          title: "Technical Trust Checklist",
          description: "Comprehensive list of technical optimizations"
        }
      ]
    });
  }

  // Sort insights by priority: critical first, then high, then medium
  const priorityRank = { critical: 0, high: 1, medium: 2 };
  insights.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);

  // Return all generated insights when no server recommendations are available
  return insights;
}