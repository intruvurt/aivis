/**
 * Scoring Engine - Calculate category and overall scores based on evidence
 */

export const calculateScores = (allEvidence: any[], discoveryData: any, technicalData: any, contentData: any) => {
  const scores = {
    crawlability: 0,
    indexability: 0,
    schemaPresence: 0,
    contentClarity: 0,
    entityTrust: 0,
    technicalHygiene: 0,
    aiReadability: 0,
    overall: 0
  };

  const weights = {
    crawlability: 15,
    indexability: 15,
    schemaPresence: 10,
    contentClarity: 20,
    entityTrust: 10,
    technicalHygiene: 15,
    aiReadability: 15
  };

  try {
    // Crawlability Score (0-100)
    let crawlabilityPoints = 0;
    if (discoveryData.robotsTxt) crawlabilityPoints += 30;
    if (discoveryData.sitemap) crawlabilityPoints += 40;
    if (discoveryData.urlCount > 0) crawlabilityPoints += 30;
    scores.crawlability = Math.min(100, crawlabilityPoints);

    // Indexability Score (0-100)
    let indexabilityPoints = 0;
    if (technicalData.canonical.present) indexabilityPoints += 25;
    if (!technicalData.redirects.hasRedirects) indexabilityPoints += 25;
    if (technicalData.https.enforced) indexabilityPoints += 25;
    if (technicalData.viewport.present) indexabilityPoints += 25;
    scores.indexability = Math.min(100, indexabilityPoints);

    // Schema Presence Score (0-100)
    let schemaPoints = 0;
    if (technicalData.schema.present) schemaPoints += 40;
    if (technicalData.openGraph.present) schemaPoints += 30;
    if (technicalData.twitterCards.present) schemaPoints += 30;
    scores.schemaPresence = Math.min(100, schemaPoints);

    // Content Clarity Score (0-100)
    let contentPoints = 0;
    if (contentData.wordCount >= 300) contentPoints += 25;
    if (contentData.headingStructure.h1Count > 0) contentPoints += 20;
    if (contentData.headingStructure.totalHeadings >= 3) contentPoints += 15;
    if (contentData.hasAbout) contentPoints += 15;
    if (contentData.hasPricing) contentPoints += 10;
    if (contentData.hasContact) contentPoints += 15;
    scores.contentClarity = Math.min(100, contentPoints);

    // Entity Trust Score (0-100)
    let entityPoints = 0;
    if (contentData.entitySignals.length > 0) entityPoints += 40;
    if (contentData.hasAbout) entityPoints += 30;
    if (contentData.hasContact) entityPoints += 30;
    scores.entityTrust = Math.min(100, entityPoints);

    // Technical Hygiene Score (0-100)
    let technicalPoints = 0;
    if (technicalData.canonical.present) technicalPoints += 15;
    if (technicalData.https.enforced) technicalPoints += 20;
    if (technicalData.compression.enabled) technicalPoints += 15;
    if (technicalData.caching.configured) technicalPoints += 15;
    if (technicalData.viewport.present) technicalPoints += 15;
    if (technicalData.schema.present) technicalPoints += 20;
    scores.technicalHygiene = Math.min(100, technicalPoints);

    // AI Readability Score (0-100) - Based on content structure
    let aiPoints = 0;
    if (contentData.headingStructure.h1Count === 1) aiPoints += 20;
    if (contentData.headingStructure.totalHeadings >= 3) aiPoints += 20;
    if (contentData.wordCount >= 500) aiPoints += 20;
    if (contentData.hasAbout) aiPoints += 20;
    if (technicalData.schema.present) aiPoints += 20;
    scores.aiReadability = Math.min(100, aiPoints);

    // Calculate Overall Score (weighted average)
    scores.overall = Math.round(
      (scores.crawlability * weights.crawlability +
       scores.indexability * weights.indexability +
       scores.schemaPresence * weights.schemaPresence +
       scores.contentClarity * weights.contentClarity +
       scores.entityTrust * weights.entityTrust +
       scores.technicalHygiene * weights.technicalHygiene +
       scores.aiReadability * weights.aiReadability) / 100
    );

  } catch (error) {
    console.error("Scoring error:", error);
  }

  return scores;
};

export const determineVisibilityStatus = (overallScore: number) => {
  if (overallScore >= 75) return "visible";
  if (overallScore >= 50) return "partially-visible";
  return "invisible";
};

export const generateRisks = (scores: Record<string, number>, technicalData: any, contentData: any) => {
  const risks: Array<{
    category: string;
    severity: 'high' | 'medium' | 'low';
    description: string;
    recommendation: string;
  }> = [];

  if (scores.crawlability < 50) {
    risks.push({
      category: "Crawlability",
      severity: "high",
      description: "Poor crawlability may prevent search engines from discovering content",
      recommendation: "Add robots.txt and sitemap.xml files"
    });
  }

  if (!technicalData.https.enforced) {
    risks.push({
      category: "Security",
      severity: "high",
      description: "Site not using HTTPS encryption",
      recommendation: "Implement HTTPS with valid SSL certificate"
    });
  }

  if (contentData.thinContent) {
    risks.push({
      category: "Content Quality",
      severity: "medium",
      description: "Thin content detected (< 300 words)",
      recommendation: "Expand content with valuable, relevant information"
    });
  }

  if (!technicalData.schema.present) {
    risks.push({
      category: "Structured Data",
      severity: "medium",
      description: "No structured data found",
      recommendation: "Implement JSON-LD schema markup for better AI understanding"
    });
  }

  if (contentData.headingStructure.h1Count === 0) {
    risks.push({
      category: "Content Structure",
      severity: "medium",
      description: "No H1 heading found",
      recommendation: "Add a clear H1 heading that describes the page topic"
    });
  }

  if (!contentData.hasContact) {
    risks.push({
      category: "Trust Signals",
      severity: "low",
      description: "No contact information detected",
      recommendation: "Add contact information to build trust"
    });
  }

  return risks;
};

export const generateRecommendations = (scores: Record<string, number>, risks: any[]) => {
  const recommendations: Array<{
    category: string;
    priority: 'high' | 'medium';
    action: string;
    impact: string;
  }> = [];

  // Priority recommendations based on lowest scores
  const sortedScores = Object.entries(scores)
    .filter(([key]) => key !== "overall")
    .sort(([, a], [, b]) => a - b);

  sortedScores.slice(0, 3).forEach(([category, score]) => {
    if (score < 70) {
      recommendations.push({
        category,
        priority: score < 40 ? "high" : "medium",
        action: `Improve ${category} score (currently ${score}/100)`,
        impact: "Enhancing this area will significantly improve AI search visibility"
      });
    }
  });

  // Add risk-based recommendations
  risks.forEach(risk => {
    if (risk.severity === "high") {
      recommendations.push({
        category: risk.category,
        priority: "high",
        action: risk.recommendation,
        impact: risk.description
      });
    }
  });

  return recommendations;
};
