// Local development config template
// Copy this file to config.js and add your API key.
// config.js is gitignored and won't be committed.

const CONFIG = {
  ANTHROPIC_API_KEY: 'YOUR_API_KEY_HERE',

  EXTRACTION_PROMPT: `You are extracting data from an electricity utility bill. Extract ONLY the following information and respond with ONLY a JSON object, no other text:

1. Billing period (format exactly as: "Mon DD, YYYY - Mon DD, YYYY", e.g., "Dec 19, 2025 - Jan 22, 2026")
2. Total bill amount in dollars (number only, e.g., 253.48)
3. Total electricity usage in kWh (number only, e.g., 1668)

Respond with ONLY this JSON, nothing else:
{"billingPeriod": "start - end", "totalAmount": 123.45, "totalKwh": 1234}

IMPORTANT: If this document is NOT an electricity/utility bill (e.g., it's a bank statement, receipt, lease, or other unrelated document), respond with:
{"error": "wrong_document_type", "detected": "brief description of what the document appears to be"}

If it IS a utility bill but you cannot find one or more required fields, respond with:
{"error": "missing_data", "found": {"billingPeriod": "value or null", "totalAmount": "value or null", "totalKwh": "value or null"}}`
};
