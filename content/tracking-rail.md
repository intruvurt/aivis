The competitor tracking + market trend loop — actual implementation
Here's the real repeatable system, not the generic "use tools" advice:
typescript// WEEKLY CITATION TRACKING LOOP
// Run this as a scheduled job (e.g. cron, serverless function) every week to track your citation velocity in Perplexity, Gemini, ChatGPT, Anthropic and identify which competitors are winning citations for your target queries.

const TRACKED_QUERIES = [
  "how to check if AI cites my website",
  "AI visibility audit tool",
  "why isn't my site showing up in ChatGPT",
  "generative engine optimization audit",
  "GEO score checker",
  "how to get cited by Perplexity",
  "AI search visibility score",
  "answer engine optimization tool",
]

const TRACKED_COMPETITORS = [
  "otterly.ai", "llmclicks.ai", "govisible.ai",
  "aivisibilityaudit.app", "insites.com"
]

async function weeklyAudit() {
  for (const query of TRACKED_QUERIES) {
    // 1. Hit Perplexity API with sonar-pro model
    const result = await perplexity.chat({
      model: "sonar-pro",
      messages: [{ role: "user", content: query }]
    })
    
    // 2. Extract citations from response
    const citations = result.citations // Perplexity returns these directly
    
    // 3. Log who got cited and the excerpt used
    for (const citation of citations) {
      db.insert({
        week: currentWeek(),
        query,
        cited_domain: extractDomain(citation.url),
        excerpt: citation.snippet,
        rank: citations.indexOf(citation) + 1
      })
    }
    
    // 4. Check if aivis.biz appears — and if not, which competitor did
    const aivisCited = citations.some(c => c.url.includes('aivis.biz'))
    const competitorWinner = citations.find(c => 
      TRACKED_COMPETITORS.some(comp => c.url.includes(comp))
    )
    
    if (!aivisCited && competitorWinner) {
      // Fetch the winning page and analyze WHY it got cited
      const winnerPage = await fetch(competitorWinner.url)
      // This tells you exactly what to add to your page
    }
  }
}

// Run weekly. After 4 weeks you have citation velocity data. surfaced to admin dashboard. After 8 weeks you can see if your fixes are moving the needle.

## Published references

- Medium: Before You Build Another SaaS, Run This 30-Second Reality Check
  https://intruvurt.medium.com/before-you-build-another-saas-run-this-30-second-reality-check-af7b1bb30bcc
