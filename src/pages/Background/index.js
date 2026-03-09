/**
 * Job Scanner Chrome Extension - Background Service Worker
 * Handles AI job analysis requests from content script via Gemini API
 */

import { GoogleGenAI } from '@google/genai';

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const MAX_CHARS = 50000;

const JOB_ANALYSIS_PROMPT = `You are analyzing a job posting to determine fit with a candidate's background.

Respond in second person ("you"), using simple, direct English.

FORMATTING RULES (CRITICAL - follow exactly):
- Use plain text only. NO Markdown syntax whatsoever.
- No hashtags (###) for headers. Use simple labels like "Strong Matches:" instead.
- Use bullet point characters (•) for lists, NOT asterisks (*).
- Add a blank line between sections for readability.
- CRITICAL: Keep it very brief. Maximum 2-3 bullets per section.
- Each bullet must be ONE short sentence only.
- Total output must be readable in 10-15 seconds.

JOB POSTING:
{job_text}

YOUR BACKGROUND:
{cv_text}

Provide analysis in exactly this format:

✅ Strong Matches:

• [One short sentence]
• [One short sentence]
• [Optional third bullet - only if essential]

⚠️ Gaps or Concerns:

• [One short sentence]
• [One short sentence]
• [Optional third bullet - only if essential]

💡 Quick Take:

[2-3 short sentences max. Overall assessment of fit.]

Be concise. No Markdown. Plain text only.`;

async function handleAnalyzeJob(jobText, cvText, apiKey) {
  const storage = chrome?.storage ?? (typeof browser !== 'undefined' ? browser.storage : null);
  if (!storage?.local) {
    return {
      error: 'Storage API not available. Please ensure the extension is properly loaded and try again.',
    };
  }

  if (!apiKey) {
    return { error: 'Please add your Gemini API key in the extension settings' };
  }

  if (!cvText || !cvText.trim()) {
    return { error: 'Please add your CV/background in the extension settings' };
  }

  if (!jobText || !jobText.trim()) {
    return { error: 'No text content found on this page.' };
  }

  const truncatedJob =
    jobText.length > MAX_CHARS
      ? jobText.slice(0, MAX_CHARS) + '\n\n[... content truncated ...]'
      : jobText;

  const prompt = JOB_ANALYSIS_PROMPT
    .replace('{job_text}', truncatedJob)
    .replace('{cv_text}', cvText);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    const analysis = response?.text ?? '';

    if (!analysis) {
      return {
        error: 'No analysis was generated. Please try again.',
      };
    }

    return { analysis };
  } catch (err) {
    const msg = err?.message || '';
    if (
      msg.includes('429') ||
      msg.includes('rate limit') ||
      msg.includes('RESOURCE_EXHAUSTED')
    ) {
      return {
        error: 'API rate limit reached. Please try again later.',
      };
    }
    if (
      msg.includes('401') ||
      msg.includes('403') ||
      msg.includes('API key') ||
      msg.includes('invalid')
    ) {
      return {
        error: 'Failed to analyze. Please check your API key and try again.',
      };
    }
    return {
      error: 'Failed to analyze. Please check your API key and try again.',
    };
  }
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'analyzeJob') {
    const { jobText, cvText } = request;
    chrome.storage.local.get('apiKey', (result) => {
      const apiKey = result?.apiKey || '';
      handleAnalyzeJob(jobText, cvText, apiKey)
        .then(sendResponse)
        .catch((err) => {
          sendResponse({
            error:
              err?.message ||
              'Failed to analyze. Please check your API key and try again.',
          });
        });
    });
    return true; // Keep channel open for async response
  }
  return false;
});
