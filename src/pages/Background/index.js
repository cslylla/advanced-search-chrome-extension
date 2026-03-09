/**
 * Job Scanner Chrome Extension - Background Service Worker
 * Handles AI job analysis requests from content script (Phase 4)
 */

// Placeholder - analyzeJob handler will be added in Phase 4
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'analyzeJob') {
    // Phase 4: Implement job analysis with Gemini
    sendResponse({ error: 'AI analysis not yet implemented.' });
    return true;
  }
  return false;
});
