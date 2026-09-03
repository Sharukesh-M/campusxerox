/**
 * OCR service — extracts UTR from payment screenshots using GLM-4V vision API.
 * Isolated helper so the OCR provider can be swapped without touching payment flow.
 *
 * This runs server-side only. Never expose GLM_API_KEY to the browser.
 */

interface OcrResult {
  text: string | null;  // Extracted UTR, or null if extraction failed
  raw: string;          // Raw API response for debugging
}

const GLM_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

/**
 * Extract UTR/transaction reference number from a payment screenshot.
 *
 * @param imageUrl - Signed URL to the payment screenshot in Supabase Storage
 * @returns Extracted UTR text or null
 */
export async function extractUtrFromScreenshot(imageUrl: string): Promise<OcrResult> {
  const apiKey = process.env.GLM_API_KEY;

  if (!apiKey) {
    console.warn('GLM_API_KEY not configured — skipping OCR');
    return { text: null, raw: 'API key not configured' };
  }

  try {
    const response = await fetch(GLM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'glm-4v-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                },
              },
              {
                type: 'text',
                text: 'Extract ONLY the UTR number, UPI transaction reference number, or RRN number visible in this payment screenshot. Return ONLY the number as plain digits/alphanumeric text with absolutely no extra text, explanation, or commentary. If you cannot find any transaction reference number, return exactly: NOT_FOUND',
              },
            ],
          },
        ],
        max_tokens: 100,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GLM OCR API error:', response.status, errorText);
      return { text: null, raw: `API error: ${response.status}` };
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content?.trim() || '';

    if (!rawContent || rawContent === 'NOT_FOUND') {
      return { text: null, raw: rawContent || 'Empty response' };
    }

    // Clean the extracted text — keep only alphanumeric characters
    const cleaned = rawContent.replace(/[^a-zA-Z0-9]/g, '');

    return {
      text: cleaned || null,
      raw: rawContent,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('GLM OCR extraction failed:', message);
    return { text: null, raw: `Error: ${message}` };
  }
}
