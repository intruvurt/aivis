# Score Decay Is Real: How Your Website Quietly Loses AI Visibility While You're Not Looking

**Platform:** Substack  
**Newsletter:** dobleduche / intruvurt  
**Tags:** AI Visibility, Content Strategy, Site Monitoring, AEO, Citation Readiness  
**Subtitle/Hook:** Your AI visibility score from 3 months ago means nothing today. Here's why scores decay — and how to stay ahead of it automatically.  
**Estimated read time:** 11 min  

---

There's a pattern I keep seeing that nobody talks about.

A founder or marketing lead runs an AI visibility audit on their site. Score comes back at 74. Good score. They're satisfied. They send the report to their dev team, address a few of the flagged issues, and move on.

Three months later, their brand stops appearing in AI-generated answers about their category. Their competitor — who launched 6 months ago with a worse site — is getting cited instead.

They run the audit again. Score is now 51.

Nothing changed on their site. So what happened?

This is score decay. And it's one of the structural dynamics of AI visibility that I haven't seen explained anywhere, so I'm going to explain it now.

---

## What AI Visibility Actually Depends On (And Why It Changes)

Your AI visibility score is not a static property of your website. It's a measure of your site's relationship with an external ecosystem that changes constantly — AI model behavior, competitor positioning, crawler access policies, schema validity, content freshness, and platform crawl frequency.

When that ecosystem shifts and your site doesn't, your effective visibility score degrades even if you change nothing.

Let me walk through the four main decay vectors.

---

## Decay Vector 1: Competitor Improvement

Your score is partially relative. When AI models decide who to cite in a given answer, they're selecting from a pool of candidate sources. If your score is 74 and your closest competitor's score was 60 when you last checked — you were ahead. If that competitor's team spent the last quarter rebuilding their schema, fixing their heading hierarchy, adding FAQ sections, and unblocking AI crawlers — their score might now be 82.

You didn't get worse. They got better. But the citation outcome changed.

AI models don't cite based on absolute quality thresholds. They cite based on relative quality comparisons across candidate pages for a given query. If every other site in your category upgrades their structural signals, your static 74 starts losing citation competitions you used to win.

This is why [AiVIS Competitor Tracking](https://aivis.biz/competitors) exists on Alignment tier and above. You need to know when your competitors' scores are changing, not just your own. Tracking your own score in isolation gives you half the picture.

The feature runs automatic rescans on competitor URLs and alerts you when their visibility signals improve beyond a threshold. It detects new schema types they've added, content depth increases, crawler access changes, and structural improvements. If your competitor just added FAQPage schema to their top 3 landing pages, you want to know that this week — not in six months when you notice you've stopped showing up in answers.

---

## Decay Vector 2: Content Staleness

AI models — particularly Perplexity, which does real-time web crawls — weight content freshness. A page with a publish date from 2021 and no significant updates is going to score lower on freshness signals than a page last modified two months ago, even if the content is otherwise identical.

This affects more than just publication dates. Crawler logs track how frequently your page changes. Sites that update regularly get crawled more frequently, which means their content is more likely to be in the real-time index when a query is processed.

There are specific types of staleness that trigger score decay:

**Statistical staleness** — If your page cites statistics ("X% of companies do Y") and those stats are from sources more than 2 years old, AI models doing source verification will flag the information as potentially outdated. This is especially damaging for YMYL categories (health, finance, legal, tech).

**Competitive price/feature staleness** — Pages that compare product features or pricing are scored on citation frequency. If competitors have updated their feature sets and your comparison page wasn't updated, AI models will start preferring fresher competitor analysis pages over yours.

**Author entity staleness** — If your author schema points to a LinkedIn profile or Twitter account that hasn't been active in a year, entity verification signals weaken. AI models trying to verify expertise will find a stale signal chain.

**Internal link rot** — Every 404 or broken internal link on your site degrades your structural integrity score. Sites accumulate broken links gradually as pages get removed, URLs change, or subdomains get retired. An audit that showed 0 broken links a year ago might show 12 today.

---

## Decay Vector 3: AI Crawler Policy Drift

This one is invisible and surprisingly common.

CDN providers, security tools, and hosting panels push automatic updates. Some of those updates include bot mitigation rules. Some of those bot mitigation rules catch AI crawlers as collateral damage.

I've talked to founders who had GPTBot explicitly allowed in their robots.txt — and then Cloudflare pushed a new security ruleset that included a challenge page for unknown bot patterns. GPTBot hits the challenge page. Can't complete it. Returns an error. Gets marked as a site that returns 5xx errors on crawl. Disappears from OpenAI's index.

Their robots.txt still said allow. But the effective access changed under them without anyone touching their robots.txt.

I've also seen Vercel deployments where a middleware rule added `noIndex` headers in production that shouldn't have been there — a config mistake from a staging environment that bled into production. Their sitemap showed hundreds of pages. Their crawlable index had 3.

The only way to know your current effective crawler access — not what your robots.txt says, but what a crawler actually sees when it hits your domain — is to test it. [AiVIS Robots Checker](https://aivis.biz/tools/robots-checker) pings your domain as each AI crawler and reports on the actual response chain, including redirect behavior, challenge detection, and security header conflicts.

---

## Decay Vector 4: Schema Validity Expiration

Schema markup can become invalid as vocabularies evolve. deprecated JSON-LD properties cause validator warnings that AI models' structured data parsers flag as low-confidence schema.

The most commonly invalidated patterns I see:

**WebSite with sitelinks searchbox** — Google deprecated the Sitelinks Searchbox feature in September 2026. Sites with `potentialAction: SearchAction` in their WebSite schema are now running deprecated markup that structured data parsers flag.

**Product schema without required 2026+ fields** — Google updated Product schema requirements in late 2026 to require `hasMerchantReturnPolicy` and `shippingDetails` for e-commerce pages. Sites with older Product schema now have incomplete markup.

**FAQ schema with more than 10 Q&A pairs** — Technically valid, but since Google stopped showing FAQPage rich results for most queries, AI models have updated their weighting of FAQ schema. Sites that built 20-entry FAQ blocks specifically to chase rich results now have bloated schema that contributes noise.

**Organization schema missing contactPoint** — Not required, but increasingly expected. Organization schema without any contact method is scored as lower-confidence entity declaration.

Schema standards aren't static. They evolve, deprecate, and add new required fields on roughly a 12-18 month cycle. An audit from a year ago may show valid schema. Run the same validator today and you might have 3 deprecation warnings.

---

## How Score Decay Actually Shows Up In Practice

The frustrating thing about score decay is that it's not announced. You don't get a notification that your AI visibility dropped. You just stop being cited.

The symptom pattern looks like this:

**Month 1-2 post-audit:** You're getting cited in AI answers for your primary queries. Your score is 74, things are good.

**Month 3-4:** Frequency of citations starts dropping. You might attribute this to seasonality or algorithm changes.

**Month 5-6:** A content audit shows your competitor is getting cited in contexts where you used to appear. Someone asks ChatGPT "what's the best tool for X" and your competitor is named, you're not.

**Month 7+:** You run another full audit and discover you're now at 51. One of your core service pages has broken internal links. GPTBot is partially blocked by a Cloudflare rule you didn't know existed. Your competitor added 4 new service pages with FAQPage schema last quarter.

The decay was happening in real time. You just couldn't see it.

---

## The Fix: Continuous Scoring, Not Snapshot Audits

One-off audits are a starting point. They tell you where you are on the day you run them. They do nothing to protect you from the vectors I described above.

What actually prevents score decay is continuous monitoring with automated re-auditing that catches drift early.

This is what [AiVIS Scheduled Rescans](https://aivis.biz/settings?section=advanced) does on Alignment tier and above. You configure which URLs to monitor — your homepage, your top 5 service pages, your most-cited blog posts — and set a rescan frequency (weekly, biweekly, or monthly depending on your tier). The system re-runs the full 28-point audit on each URL on your configured schedule and sends alerts when something meaningful changes.

"Meaningful" is calibrated. Minor fluctuations below a threshold don't trigger alerts. But when your score for a specific URL drops by more than 8 points, or when a new hard blocker appears, or when your structured data goes from valid to invalid — you hear about it in time to do something.

Combined with [Competitor Tracking](https://aivis.biz/competitors), you get a two-sided view: your own decay trend, and your competitors' improvement trend. The gap between those two lines is your effective citation advantage or disadvantage.

---

## What to Monitor and at What Frequency

Not all pages decay at the same rate. Here's a rough prioritization framework:

**High frequency (weekly):**
- Your primary landing page / homepage
- Your top-cited product or service page (the one that appears most in AI answers for your core query)
- Any page that contains pricing or feature comparison content

**Medium frequency (biweekly):**
- Secondary service pages
- Your About / Team page (if it includes author credentials)
- Blog posts that drive meaningful organic traffic

**Low frequency (monthly):**
- Blog archives
- Case studies
- Documentation pages

For most businesses, 3-5 URLs on weekly monitoring and 10-15 on monthly is sufficient to catch decay before it compounds.

---

## A Note on Why AI Visibility Auditing Is Different From SEO Auditing

Traditional SEO health monitoring tools (Semrush, Ahrefs, Screaming Frog) will not catch most of these decay signals. They're built to track Google ranking factors: backlinks, crawl errors in GSC, Core Web Vitals, anchor text distribution.

They do not track:
- AI crawler-specific block states
- JSON-LD validity against current structured data specs
- Content freshness signals as scored by inference pipelines
- Competitor AI visibility score changes
- Citation frequency trends across ChatGPT, Perplexity, Claude, Google AI Overview

AI visibility auditing requires measuring what AI models actually check. That's a different instrument from what the SEO industry has been building.

Score decay is not a Google problem. It's an AI pipeline problem. Solve it with tools designed for the actual measurement surface.

If you want to run a fresh baseline, the full audit is at [aivis.biz/analyze](https://aivis.biz/analyze). Observer tier is free, 10 scans. Scheduled rescans start on Alignment at $49/mo. Reply if you want to talk through what to prioritize based on your score.

---

*Next issue: How AI models use your competitor's citations to build their internal ranking of authorities in your category. The mechanism is different from how most people think, and understanding it changes how you approach content strategy entirely.*
