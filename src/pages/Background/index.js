/**
 * AI Summary Chrome Extension - Background Service Worker
 * Handles Gemini API summarization requests from content script
 */

import { GoogleGenAI } from '@google/genai';

const GEMINI_MODEL = 'gemini-2.5-flash-lite';

chrome.runtime.onMessage.addListener(
  (request, _sender, sendResponse) => {
    if (request.action === 'summarize') {
      handleSummarize(request.text)
        .then(sendResponse)
        .catch((err) => {
          sendResponse({ error: err.message || 'Failed to summarize' });
        });
      return true; // Keep channel open for async response
    }
  }
);

async function handleSummarize(pageText) {
  const storage = chrome?.storage ?? (typeof browser !== 'undefined' ? browser.storage : null);
  if (!storage?.local) {
    return {
      error: 'Storage API not available. Please ensure the extension is properly loaded and try again.',
    };
  }
  const { apiKey } = await storage.local.get('apiKey');

  if (!apiKey) {
    return {
      error: 'API key not set. Please add your Gemini API key in the extension popup.',
    };
  }

  if (!pageText || pageText.trim().length === 0) {
    return {
      error: 'No text content found on this page.',
    };
  }

  // Truncate if too long (Gemini has token limits)
  const maxChars = 100000;
  const textToSummarize =
    pageText.length > maxChars
      ? pageText.slice(0, maxChars) + '\n\n[... content truncated ...]'
      : pageText;

  const prompt = `Summarize the following webpage content in exactly two short paragraphs. Write in plain prose—no numbering, no bullet points, no lists. The first paragraph should capture the main idea and context. The second paragraph should cover key details and takeaways. Keep it easy to read and understand.\n\n---\n\n${textToSummarize}`;

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
  });

  const summary = response?.text ?? '';

  if (!summary) {
    return {
      error: 'No summary was generated. Please try again.',
    };
  }

  return { summary };
}
