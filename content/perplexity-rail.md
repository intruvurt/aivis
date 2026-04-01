# Perplexity's Sonar indexing pipeline (reconstructed from patents + docs)

class PerplexityURLAnalyzer:
    def analyze(self, url: str, query: str):
        # 1. Real-time web crawl via their own spider
        page = self.crawler.fetch(url)  # Executes JS via headless browser
        
        # 2. Retrieval scoring — NOT traditional BM25
        # Uses semantic similarity between query and page chunks
        chunks = self.chunk_content(page, size=512)
        relevance_scores = [
            self.embed_and_cosine(query, chunk) 
            for chunk in chunks
        ]
        
        # 3. Citation selection logic
        # Perplexity cites sources that score high on ALL of:
        #   - Query relevance (embedding similarity)
        #   - Source authority (domain trust score, backlink signal)
        #   - Content extractability (clean H2/H3, answer-style sentences)
        #   - Freshness (recency weight, especially for news queries)
        
        # 4. The secret: structured content wins citation slots
        # A page with:
        #   - Direct answer in first 200 chars of a section
        #   - Named entity in H2/H3 matching query terms
        #   - Factual claim density > fluff density
        # ...gets citation preference over longer, unstructured pages

    def track_competitor_citations(self, domain: str, query_set: list):
        # This is how you reverse-engineer it:
        for query in query_set:
            result = self.run_query(query)
            if domain in result.cited_sources:
                self.citation_log.append({
                    "query": query,
                    "rank": result.citation_rank(domain),
                    "excerpt": result.excerpt_used(domain)
                })
        # Run this weekly → you get citation velocity trends
```

To track your own citation rate in Perplexity: run a set of 20-30 non-branded queries you want to rank for, log which sources get cited, repeat weekly. Tools that automate this: Ahrefs Brand Radar, Otterly.ai, Wellows.

---

### How Claude 4.5/Sonnet handles URL analysis in its training vs inference

There are two distinct phases and most people conflate them:
```
TRAINING TIME (happened before you talk to me):
  - Anthropic's crawl pipeline fetched ~trillions of tokens of web content
  - URLs with high citation density, clean structure, and strong schema
    got better representation in the training corpus
  - This is where "being cited" in AI permanently matters:
    pages that appeared in training data as authoritative answers
    influence what I "know" about a topic even without live lookup

INFERENCE TIME (what happens now when you talk to me):
  - If web_fetch tool is available: live fetch, markdown extraction, in-context analysis
  - If no tool: I rely entirely on training data — I have no memory of aivis.biz
    unless it appeared in my training corpus before August 2025
  - This is why schema + external citations before training cutoffs matter enormously