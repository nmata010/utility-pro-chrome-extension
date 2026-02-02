// LLM Service for Utility Pro
// Handles all AI-powered document extraction

const LLM_CONFIG = {
  apiUrl: 'https://api.anthropic.com/v1/messages',
  model: 'claude-3-5-haiku-latest',
  maxRetries: 2,
  retryDelayMs: 1000
};

/**
 * Extracts bill data from a PDF using Claude AI.
 * @param {string} pdfBase64 - The base64-encoded PDF file
 * @param {string} apiKey - The Anthropic API key
 * @returns {Promise<{billingPeriod: string, totalAmount: number, totalKwh: number}>}
 */
async function extractBillDataWithLLM(pdfBase64, apiKey) {
  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    throw new Error('API key not configured. Add it in Settings or in config.js for development.');
  }
  let lastError;

  for (let attempt = 0; attempt <= LLM_CONFIG.maxRetries; attempt++) {
    try {
      return await makeExtractionRequest(apiKey, pdfBase64);
    } catch (error) {
      lastError = error;

      // Don't retry for authentication or document-related errors
      if (error.message.includes('Invalid API key') ||
          error.message.includes('doesn\'t appear to be') ||
          error.message.includes('some information is missing') ||
          error.message.includes('couldn\'t be read')) {
        throw error;
      }

      // Wait before retrying network errors
      if (attempt < LLM_CONFIG.maxRetries) {
        await sleep(LLM_CONFIG.retryDelayMs);
      }
    }
  }

  throw lastError;
}

async function makeExtractionRequest(apiKey, pdfBase64) {
  const response = await fetch(LLM_CONFIG.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: LLM_CONFIG.model,
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64
            }
          },
          {
            type: 'text',
            text: CONFIG.EXTRACTION_PROMPT
          }
        ]
      }]
    })
  });

  const result = await response.json();
  console.log('LLM API Response:', { status: response.status, ok: response.ok, body: result });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid API key. Please check your settings.');
    }
    throw new Error(result.error?.message || `API request failed: ${response.status}`);
  }
  const text = result.content[0].text;

  // Parse the JSON response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse response from AI. Please try again.');
  }

  const data = JSON.parse(jsonMatch[0]);

  // Check for error responses from the AI
  if (data.error === 'wrong_document_type' || data.error === 'not_a_utility_bill') {
    const detected = data.detected ? ` It looks like a ${data.detected}.` : '';
    throw new Error(`This doesn't appear to be an electricity bill.${detected} Please upload your utility bill from the electric company.`);
  }

  if (data.error === 'missing_data') {
    const missing = [];
    if (!data.found?.billingPeriod) missing.push('billing period');
    if (!data.found?.totalAmount) missing.push('total amount');
    if (!data.found?.totalKwh) missing.push('kWh usage');
    const missingText = missing.length > 0 ? ` Couldn't find: ${missing.join(', ')}.` : '';
    throw new Error(`This looks like a utility bill, but some information is missing.${missingText} You can enter the details manually instead.`);
  }

  // Validate required fields
  if (!data.billingPeriod || data.totalAmount === undefined || data.totalKwh === undefined) {
    throw new Error('Some bill details couldn\'t be read. You can enter them manually instead.');
  }

  return {
    billingPeriod: data.billingPeriod,
    totalAmount: parseFloat(data.totalAmount),
    totalKwh: parseFloat(data.totalKwh)
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
