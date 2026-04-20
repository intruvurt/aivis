// test-analyze.ts - Simple test for the analyze endpoint
import axios from 'axios';

const API_URL = process.env.VITE_API_URL || 'http://localhost:3001';
const TEST_URL = 'https://intruvurt.space';

async function testAnalyze() {
  console.log('🧪 Testing analyze endpoint...');
  console.log(`API URL: ${API_URL}`);
  console.log(`Test URL: ${TEST_URL}`);
  console.log('');

  try {
    const response = await axios.post(
      `${API_URL}/api/analyze`,
      { url: TEST_URL },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 60000, // 60 second timeout
      }
    );

    console.log('✅ Analysis successful!');
    console.log('');
    console.log('Response status:', response.status);
    console.log('');
    console.log('Results:');
    console.log('- Visibility Score:', response.data.visibility_score);
    console.log('- Cached:', response.data.cached);
    console.log('- Processing Time:', response.data.processing_time_ms, 'ms');
    console.log('- Analyzed At:', response.data.analyzed_at);
    console.log('');
    console.log('AI Platform Scores:');
    if (response.data.ai_platform_scores) {
      console.log('- ChatGPT:', response.data.ai_platform_scores.chatgpt);
      console.log('- Perplexity:', response.data.ai_platform_scores.perplexity);
      console.log('- Google AI:', response.data.ai_platform_scores.google_ai);
      console.log('- Claude:', response.data.ai_platform_scores.claude);
    }
    console.log('');
    console.log('Recommendations:', response.data.recommendations?.length || 0);

    return response.data;
  } catch (error: unknown) {
    console.error('❌ Test failed!');
    console.error('');

    const err = error as any;
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Error:', err.response.data);
    } else if (err.request) {
      console.error('No response received. Is the server running?');
      console.error('Error:', err.message);
    } else {
      console.error('Error:', err.message);
    }

    process.exit(1);
  }
}

// Run test
testAnalyze()
  .then(() => {
    console.log('');
    console.log('✅ All tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  });
