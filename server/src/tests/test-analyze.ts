// server/src/test-analyze.ts - Integration test for the analyze endpoint
import axios from 'axios';

const API_URL = process.env.VITE_API_URL || `http://localhost:${process.env.PORT || 10000}`;
const TEST_URL = process.env.TEST_URL || 'https://example.com';

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testAnalyze() {
  log(' Testing AI Visibility Intelligence Platform Analyze Endpoint', 'bright');
  log('='.repeat(60), 'cyan');
  log(`API URL: ${API_URL}`, 'blue');
  log(`Test URL: ${TEST_URL}`, 'blue');
  log('='.repeat(60), 'cyan');
  console.log('');

  try {
    const startTime = Date.now();
    
    log(' Sending analysis request...', 'yellow');
    
    const response = await axios.post(
      `${API_URL}/api/analyze`,
      { url: TEST_URL },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 120000, // 2 minute timeout (AI can be slow)
        validateStatus: (status) => status < 500, // Don't throw on 4xx
      }
    );

    const duration = Date.now() - startTime;

    if (response.status !== 200) {
      log(`  Warning: Non-200 status code: ${response.status}`, 'yellow');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      process.exit(1);
    }

    log(' Analysis successful!', 'green');
    console.log('');
    
    log('Response Details:', 'bright');
    log('─'.repeat(60), 'cyan');
    console.log(`Status Code: ${response.status}`);
    console.log(`Total Duration: ${duration}ms`);
    console.log('');

    const data = response.data;

    log('Core Metrics:', 'bright');
    log('─'.repeat(60), 'cyan');
    console.log(`Visibility Score: ${data.visibility_score}/100`);
    console.log(`Cached: ${data.cached ? ' Yes' : ' No'}`);
    console.log(`Processing Time: ${data.processing_time_ms}ms`);
    console.log(`Analyzed At: ${data.analyzed_at}`);
    console.log(`Analysis Version: ${data.analysis_version || 'N/A'}`);
    console.log('');

    if (data.ai_platform_scores) {
      log('AI Platform Scores:', 'bright');
      log('─'.repeat(60), 'cyan');
      console.log(`ChatGPT:    ${data.ai_platform_scores.chatgpt}/100`);
      console.log(`Perplexity: ${data.ai_platform_scores.perplexity}/100`);
      console.log(`Google AI:  ${data.ai_platform_scores.google_ai}/100`);
      console.log(`Claude:     ${data.ai_platform_scores.claude}/100`);
      console.log('');
    }

    if (data.recommendations && data.recommendations.length > 0) {
      log(`Recommendations: ${data.recommendations.length}`, 'bright');
      log('─'.repeat(60), 'cyan');
      
      // Show first 3 recommendations
      data.recommendations.slice(0, 3).forEach((rec: any, idx: number) => {
        console.log(`${idx + 1}. [${rec.priority.toUpperCase()}] ${rec.title}`);
        console.log(`   ${rec.description}`);
        console.log('');
      });

      if (data.recommendations.length > 3) {
        console.log(`   ... and ${data.recommendations.length - 3} more`);
        console.log('');
      }
    }

    if (data.schema_markup) {
      log('Schema Markup:', 'bright');
      log('─'.repeat(60), 'cyan');
      console.log(`JSON-LD Count: ${data.schema_markup.json_ld_count}`);
      console.log(`Organization Schema: ${data.schema_markup.has_organization_schema ? '' : ''}`);
      console.log(`FAQ Schema: ${data.schema_markup.has_faq_schema ? '' : ''}`);
      if (data.schema_markup.schema_types?.length > 0) {
        console.log(`Schema Types: ${data.schema_markup.schema_types.join(', ')}`);
      }
      console.log('');
    }

    if (data.content_analysis) {
      log('Content Analysis:', 'bright');
      log('─'.repeat(60), 'cyan');
      console.log(`Word Count: ${data.content_analysis.word_count}`);
      console.log(`H1 Tags: ${data.content_analysis.headings.h1}`);
      console.log(`H2 Tags: ${data.content_analysis.headings.h2}`);
      console.log(`H3 Tags: ${data.content_analysis.headings.h3}`);
      console.log(`Proper H1: ${data.content_analysis.has_proper_h1 ? '' : ''}`);
      console.log('');
    }

    if (data.rail_evidence_audit) {
      log('Rail Evidence Audit:', 'bright');
      log('─'.repeat(60), 'cyan');
      console.log(`Overall Rail Score: ${data.rail_evidence_audit.overall_score_0_100}/100`);
      console.log(`BRAG Ready: ${data.rail_evidence_audit.brag_ready ? 'YES' : 'NO'}`);
      const rails = data.rail_evidence_audit.rails || {};
      if (rails.claude) console.log(`Claude Rail: ${rails.claude.score_0_100}/100`);
      if (rails.google) console.log(`Google Rail: ${rails.google.score_0_100}/100`);
      if (rails.perplexity) console.log(`Perplexity Rail: ${rails.perplexity.score_0_100}/100`);
      if (rails.tracking) console.log(`Tracking Rail: ${rails.tracking.score_0_100}/100`);
      if (Array.isArray(data.rail_evidence_audit.brag_reasons) && data.rail_evidence_audit.brag_reasons.length > 0) {
        console.log('BRAG Notes:');
        data.rail_evidence_audit.brag_reasons.slice(0, 3).forEach((reason: string, index: number) => {
          console.log(`  ${index + 1}. ${reason}`);
        });
      }
      console.log('');
    }

    if (data.triple_check) {
      log('Triple-Check AI Validation:', 'bright');
      log('─'.repeat(60), 'cyan');
      console.log(`AI1 (Primary): ${data.triple_check.ai1?.model || 'N/A'}`);
      console.log(`AI2 (Critique): ${data.triple_check.ai2?.model || 'N/A'}`);
      console.log(`AI3 (Validator): ${data.triple_check.ai3?.model || 'N/A'}`);
      
      if (data.triple_check.ai3?.validation) {
        console.log('');
        console.log('Final Validation:');
        console.log(`  Score: ${data.triple_check.ai3.validation.final_visibility_score}/100`);
        console.log(`  Verdict: ${data.triple_check.ai3.validation.summary_verdict || 'N/A'}`);
      }
      console.log('');
    }

    log(' Test completed successfully!', 'green');
    return data;

  } catch (error: any) {
    log(' Test failed!', 'red');
    console.log('');

    if (axios.isAxiosError(error)) {
      if (error.response) {
        log('Server Error Response:', 'red');
        console.log(`Status: ${error.response.status}`);
        console.log('Error Data:', JSON.stringify(error.response.data, null, 2));
      } else if (error.request) {
        log('No Response Received', 'red');
        console.log('');
        log('Possible causes:', 'yellow');
        console.log('1. Server is not running on', API_URL);
        console.log('2. Network connectivity issues');
        console.log('3. Server crashed during request');
        console.log('');
        console.log('Error:', error.message);
      } else {
        log('Request Setup Error:', 'red');
        console.log('Error:', error.message);
      }
    } else {
      log('Unexpected Error:', 'red');
      console.log('Error:', error.message);
    }

    throw error;
  }
}

// Run test suite
async function runTests() {
  console.log('');
  
  try {
    await testAnalyze();
    console.log('');
    log('═'.repeat(60), 'green');
    log(' All tests passed!', 'green');
    log('═'.repeat(60), 'green');
    console.log('');
    process.exit(0);
  } catch (error: any) {
    console.log('');
    log('═'.repeat(60), 'red');
    log(' Test suite failed', 'red');
    log('═'.repeat(60), 'red');
    console.log('');
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('');
  log('  Test interrupted by user', 'yellow');
  process.exit(130);
});

process.on('unhandledRejection', (reason) => {
  console.error('');
  log(' Unhandled promise rejection:', 'red');
  console.error(reason);
  process.exit(1);
});

// Run
runTests();