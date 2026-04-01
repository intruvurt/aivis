/**
 * Text Summary Generator
 *
 * Converts a raw AnalysisResponse into a human-readable narrative.
 * Output depth is tier-gated:
 *   - minimal  (observer)  : 2–3 paragraph overview + 2 top findings (no fix) + closing CTA
 *   - standard (alignment) : detailed intro with tech context + all findings with fixes + priority order + closing
 *   - full     (signal/sf) : evidence-rich narrative referencing crawl data, platform scores,
 *                            schema types, and category grades + all findings with full implementation + priority order + closing
 */
import type {
  AnalysisResponse,
  TextSummary,
  TextSummaryDepth,
  TextSummaryFinding,
  Recommendation,
  CategoryGrade,
} from '../../../shared/types.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreBand(score: number): 'critical' | 'needs_improvement' | 'good' | 'excellent' {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'needs_improvement';
  return 'critical';
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url || 'the analyzed page';
  }
}

function pluralize(n: number, singular: string, plural?: string): string {
  return n === 1 ? singular : (plural || singular + 's');
}

function wordCountVerdict(count: number): string {
  if (count < 100) return 'very light on copy';
  if (count < 300) return 'fairly thin on content';
  if (count < 600) return 'has some content but could use more depth';
  return 'has a reasonable amount of content';
}

function gradeLabel(grade: string): string {
  if (grade === 'A' || grade === 'A+') return 'strong';
  if (grade === 'B' || grade === 'B+') return 'decent';
  if (grade === 'C' || grade === 'C+') return 'moderate';
  if (grade === 'D') return 'weak';
  return 'critical';
}

// ── Finding builders ─────────────────────────────────────────────────────────

function buildFindingsFromRecommendations(
  result: AnalysisResponse,
  depth: TextSummaryDepth,
): TextSummaryFinding[] {
  const recommendations = result.recommendations || [];
  if (!recommendations.length) return [];

  const sorted = [...recommendations].sort((a, b) => {
    const pw = (r: Recommendation) => r.priority === 'high' ? 3 : r.priority === 'medium' ? 2 : 1;
    return pw(b) - pw(a);
  });

  return sorted.map((rec) => {
    const title = rec.title || 'Untitled recommendation';

    if (depth === 'minimal') {
      // Observer: short explanation, no fix
      return {
        title,
        explanation: rec.description
          ? rec.description.split('.').slice(0, 2).join('.').trim() + '.'
          : 'This area needs attention to improve your AI visibility.',
        fix: '',
      };
    }

    if (depth === 'standard') {
      // Alignment: full explanation + concise fix steps
      const explanation = rec.description || 'This finding affects how AI platforms read and cite your page.';
      const fix = rec.implementation
        ? rec.implementation.split('.').slice(0, 4).join('.').trim() + (rec.implementation.split('.').length > 4 ? '.' : '')
        : (rec.description || '');
      return { title, explanation, fix };
    }

    // Full (Signal/ScoreFix): complete explanation + full implementation detail
    const explanation = rec.description || '';
    const fix = rec.implementation || rec.description || '';
    return { title, explanation, fix };
  });
}

function buildPriorityOrder(findings: TextSummaryFinding[]): string[] {
  return findings.map((f) => f.title);
}

// ── Intro builder ────────────────────────────────────────────────────────────

function buildIntro(result: AnalysisResponse, depth: TextSummaryDepth): string {
  const domain = extractDomain(result.url);
  const score = result.visibility_score;
  const band = scoreBand(score);
  const wordCount = result.content_analysis?.word_count || 0;
  const hasHttps = result.technical_signals?.https_enabled !== false;
  const hasH1 = result.content_analysis?.has_proper_h1 === true;
  const responseTime = result.technical_signals?.response_time_ms;
  const schemaTypes = result.schema_markup?.schema_types || [];
  const jsonLdCount = result.schema_markup?.json_ld_count || 0;
  const hasCanonical = result.technical_signals?.has_canonical === true;

  const weakGrades = (result.category_grades || []).filter((g) => g.score < 50);
  const strongGrades = (result.category_grades || []).filter((g) => g.score >= 70);
  const strongAreas: string[] = [];
  if (hasHttps) strongAreas.push('HTTPS');
  if (hasH1) strongAreas.push('H1 heading');
  if (responseTime && responseTime < 1500) strongAreas.push('load speed');

  // ── Minimal (Observer): 2–3 approachable paragraphs ──
  if (depth === 'minimal') {
    let opener: string;
    if (band === 'critical') {
      opener = `Your page at ${domain} scored ${score} out of 100. Right now, AI tools like ChatGPT, Perplexity, and Google AI cannot reliably read or cite your content. The good news is that most of these issues are straightforward to fix.`;
    } else if (band === 'needs_improvement') {
      opener = `Your page at ${domain} scored ${score} out of 100. AI platforms can partially read it, but there are gaps that prevent your content from being confidently cited in AI-generated answers.`;
    } else if (band === 'good') {
      opener = `Your page at ${domain} scored ${score} out of 100 — that is a solid foundation. AI platforms can read and reference your content, though a few improvements would strengthen your citation potential.`;
    } else {
      opener = `Your page at ${domain} scored ${score} out of 100, which is excellent. AI systems can easily read, trust, and cite your content. There are a few small refinements that could push your visibility even higher.`;
    }

    const topIssues = weakGrades.length > 0
      ? ` The areas that need the most help are ${weakGrades.slice(0, 2).map(g => g.label.toLowerCase()).join(' and ')}.`
      : '';

    return opener + topIssues + '\n\nBelow are the top findings from your audit. Upgrade to a paid plan to see all findings with detailed fix instructions.';
  }

  // ── Standard (Alignment): detailed intro with technical context ──
  if (depth === 'standard') {
    let opener: string;
    if (band === 'critical') {
      opener = `The audit of ${domain} returned a score of ${score} out of 100. AI systems like ChatGPT, Perplexity, Claude, and Google AI do not yet have enough clear structure and context to confidently understand, trust, and cite the page.`;
    } else if (band === 'needs_improvement') {
      opener = `The audit of ${domain} came back at ${score} out of 100. AI platforms can partially read the page, but there are meaningful gaps in structure and content that limit how well it can be cited in AI-generated answers.`;
    } else if (band === 'good') {
      opener = `The audit of ${domain} scored ${score} out of 100, which shows solid fundamentals. Most AI systems can read and reference the page, though there is still room to improve citation strength and competitive visibility.`;
    } else {
      opener = `The audit of ${domain} scored ${score} out of 100, which is excellent. The page is well-structured, content-rich, and highly readable by AI systems. There are a few refinements that could push visibility even further.`;
    }

    const techNote = strongAreas.length > 0
      ? ` The technical base looks ${strongAreas.length >= 2 ? 'solid' : 'partially solid'} — ${strongAreas.join(', ')} ${strongAreas.length === 1 ? 'is' : 'are'} in place.`
      : '';

    const gapNote = weakGrades.length > 0
      ? ` The main gaps are in ${weakGrades.slice(0, 3).map((g) => g.label.toLowerCase()).join(', ')}, which ${weakGrades.length === 1 ? 'is' : 'are'} very fixable.`
      : '';

    return opener + techNote + gapNote;
  }

  // ── Full (Signal/ScoreFix): evidence-rich narrative ──
  let opener: string;
  if (band === 'critical') {
    opener = `The deep audit of ${domain} returned a score of ${score}/100, placing it in the critical range for AI visibility. AI platforms including ChatGPT, Perplexity, Claude, and Google AI Overviews currently lack enough structured signal from this page to cite it reliably.`;
  } else if (band === 'needs_improvement') {
    opener = `The audit of ${domain} produced a score of ${score}/100, indicating partial visibility. AI models can extract some information, but structural and content gaps prevent consistent citation across platforms.`;
  } else if (band === 'good') {
    opener = `The audit of ${domain} scored ${score}/100, reflecting strong fundamentals. The page is readable by major AI models and has a solid foundation for citation, with targeted improvements available to push into the top tier.`;
  } else {
    opener = `The audit of ${domain} scored ${score}/100 — an excellent result. The page demonstrates strong structure, rich content, and high machine-readability across all major AI platforms.`;
  }

  // Evidence details
  const evidenceParts: string[] = [];
  if (wordCount > 0) evidenceParts.push(`${wordCount.toLocaleString()} words of content (${wordCountVerdict(wordCount)})`);
  if (jsonLdCount > 0) evidenceParts.push(`${jsonLdCount} JSON-LD ${pluralize(jsonLdCount, 'block')}${schemaTypes.length > 0 ? ` (${schemaTypes.slice(0, 3).join(', ')})` : ''}`);
  if (hasCanonical) evidenceParts.push('canonical URL set');
  if (responseTime) evidenceParts.push(`${responseTime}ms response time`);

  const evidenceNote = evidenceParts.length > 0
    ? `\n\nThe crawl found ${evidenceParts.join(', ')}.`
    : '';

  // Category grade overview
  const gradeNotes: string[] = [];
  if (strongGrades.length > 0) {
    gradeNotes.push(`${strongGrades.length === 1 ? 'One category scored' : `${strongGrades.length} categories scored`} above 70: ${strongGrades.slice(0, 4).map(g => `${g.label} (${gradeLabel(g.grade)})`).join(', ')}`);
  }
  if (weakGrades.length > 0) {
    gradeNotes.push(`${weakGrades.length === 1 ? 'one category' : `${weakGrades.length} categories`} fell below 50: ${weakGrades.slice(0, 4).map(g => `${g.label} (${gradeLabel(g.grade)})`).join(', ')}`);
  }
  const gradeNote = gradeNotes.length > 0 ? '\n\n' + gradeNotes.join('. Also, ') + '.' : '';

  // Platform scores
  const platformScores = result.ai_platform_scores;
  let platformNote = '';
  if (platformScores) {
    const platforms: string[] = [];
    if (typeof platformScores.chatgpt === 'number') platforms.push(`ChatGPT ${platformScores.chatgpt}/100`);
    if (typeof platformScores.perplexity === 'number') platforms.push(`Perplexity ${platformScores.perplexity}/100`);
    if (typeof platformScores.google_ai === 'number') platforms.push(`Google AI ${platformScores.google_ai}/100`);
    if (typeof platformScores.claude === 'number') platforms.push(`Claude ${platformScores.claude}/100`);
    if (platforms.length > 0) {
      platformNote = `\n\nPlatform-level visibility: ${platforms.join(' · ')}.`;
    }
  }

  // Threat intel
  let threatNote = '';
  const threatLevel = result.threat_intel?.risk_level;
  if (threatLevel === 'high' || threatLevel === 'critical') {
    threatNote = `\n\nSecurity note: The page flagged a ${threatLevel} risk level, which may suppress visibility in AI answers that prioritize safe sources.`;
  }

  return opener + evidenceNote + gradeNote + platformNote + threatNote;
}

// ── Closing builder ──────────────────────────────────────────────────────────

function buildClosing(result: AnalysisResponse, depth: TextSummaryDepth): string {
  const band = scoreBand(result.visibility_score);

  if (depth === 'minimal') {
    return 'This summary covers your top issues. Upgrade your plan to see every finding with step-by-step fix instructions, priority ordering, and exportable reports.';
  }

  if (depth === 'standard') {
    if (band === 'critical' || band === 'needs_improvement') {
      return 'This is not a rebuild problem. It is a clarity problem. The foundation is there — it just needs a stronger explanation layer so both humans and machines can read it properly. Follow the fix order above for maximum impact.';
    }
    if (band === 'good') {
      return 'The foundation is solid. These refinements should push the page into a stronger position across AI-generated answers and citations. Work through the priority list to get the most value per change.';
    }
    return 'The page is in great shape. These are polish-level improvements that can help maintain top-tier visibility as AI platforms evolve.';
  }

  // Full
  if (band === 'critical' || band === 'needs_improvement') {
    return 'The issues above are fixable and well-defined. This is not an architecture problem — it is a clarity and structure gap. Each fix listed includes the specific implementation steps needed. Follow the priority order for the fastest score improvement, and re-run the audit after each batch of changes to measure progress.';
  }
  if (band === 'good') {
    return 'Your foundation is strong and the path to excellent visibility is clear. The findings above are sorted by impact — tackle them in order and re-audit after each round of changes. The platform-level scores show which AI systems benefit most from each improvement.';
  }
  return 'Excellent overall performance. The remaining improvements are refinement-level — each one listed above includes full implementation context. These changes will help maintain your ranking as AI platforms update their extraction and citation models.';
}

// ── Main generator ───────────────────────────────────────────────────────────

/**
 * Generate a tier-gated human-readable text summary from an AnalysisResponse.
 *
 * @param result  The full analysis response from the AI pipeline
 * @param depth   Tier-gated depth: minimal | standard | full
 */
export function generateTextSummary(
  result: AnalysisResponse,
  depth: TextSummaryDepth,
): TextSummary {
  const allFindings = buildFindingsFromRecommendations(result, depth);

  // Tier gating on finding count
  let findings: TextSummaryFinding[];
  if (depth === 'minimal') {
    findings = allFindings.slice(0, 2);
  } else {
    findings = allFindings;
  }

  const priorityOrder = depth === 'minimal'
    ? findings.map((f) => f.title)
    : buildPriorityOrder(allFindings);

  return {
    depth,
    intro: buildIntro(result, depth),
    findings,
    priority_order: priorityOrder,
    closing: buildClosing(result, depth),
  };
}
