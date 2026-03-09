/**
 * AI Summary Chrome Extension - Content Script
 * Extracts page text, sends to Gemini for summarization, displays in modal
 */

(function () {
  'use strict';

  const SELECTORS_TO_EXCLUDE = [
    'script',
    'style',
    'noscript',
    'iframe',
    'svg',
    '[role="presentation"]',
    '[aria-hidden="true"]',
  ].join(', ');

  /**
   * Extracts all visible text from the current page
   */
  function extractPageText() {
    const clone = document.body.cloneNode(true);
    const toRemove = clone.querySelectorAll(SELECTORS_TO_EXCLUDE);
    toRemove.forEach((el) => el.remove());

    const rawText = clone.innerText || clone.textContent || '';
    const normalized = rawText
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();

    return normalized;
  }

  /**
   * Creates the floating AI button
   */
  function createFloatingButton() {
    const btn = document.createElement('button');
    btn.className = 'ai-summary-float-btn';
    btn.setAttribute('aria-label', 'Summarize page with AI');

    const img = document.createElement('img');
    img.src = chrome.runtime.getURL('icon-128.png');
    img.alt = 'AI';
    btn.appendChild(img);

    return btn;
  }

  /**
   * Creates the modal - supports loading, summary, and error states
   */
  function createModal(options = {}) {
    const { loading, summary, error } = options;

    const backdrop = document.createElement('div');
    backdrop.className = 'ai-summary-modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'ai-summary-modal';

    const header = document.createElement('div');
    header.className = 'ai-summary-modal-header';

    const title = document.createElement('h2');
    title.className = 'ai-summary-modal-title';
    title.textContent = error ? 'Error' : loading ? 'Summarizing...' : 'AI Summary';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'ai-summary-modal-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '&times;';

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'ai-summary-modal-body';

    if (loading) {
      const loader = document.createElement('div');
      loader.className = 'ai-summary-loader';
      loader.innerHTML = `
        <div class="ai-summary-spinner"></div>
        <p class="ai-summary-loading-text">Generating summary with Gemini...</p>
      `;
      body.appendChild(loader);
    } else if (error) {
      const errEl = document.createElement('div');
      errEl.className = 'ai-summary-error';
      errEl.textContent = error;
      body.appendChild(errEl);
    } else {
      const textEl = document.createElement('div');
      textEl.className = 'ai-summary-extracted-text';
      textEl.innerHTML = summary
        ? summary.replace(/\n/g, '<br>')
        : '<span class="ai-summary-empty-state">No summary available.</span>';
      body.appendChild(textEl);
    }

    modal.appendChild(header);
    modal.appendChild(body);
    backdrop.appendChild(modal);

    function closeModal() {
      backdrop.remove();
      document.body.style.overflow = '';
    }

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });
    closeBtn.addEventListener('click', closeModal);

    return { backdrop, closeModal };
  }

  /**
   * Opens modal and requests summary from background script
   */
  async function openModal() {
    const text = extractPageText();

    const { backdrop, closeModal } = createModal({ loading: true });
    document.body.style.overflow = 'hidden';
    document.body.appendChild(backdrop);

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'summarize',
        text,
      });

      backdrop.remove();
      document.body.style.overflow = '';

      if (response?.error) {
        const { backdrop: errBackdrop } = createModal({ error: response.error });
        document.body.style.overflow = 'hidden';
        document.body.appendChild(errBackdrop);
      } else if (response?.summary) {
        const { backdrop: summaryBackdrop } = createModal({
          summary: response.summary,
        });
        document.body.style.overflow = 'hidden';
        document.body.appendChild(summaryBackdrop);
      } else {
        const { backdrop: errBackdrop } = createModal({
          error: 'An unexpected error occurred.',
        });
        document.body.style.overflow = 'hidden';
        document.body.appendChild(errBackdrop);
      }
    } catch (err) {
      backdrop.remove();
      document.body.style.overflow = '';

      const { backdrop: errBackdrop } = createModal({
        error: err?.message || 'Failed to connect to extension. Please try again.',
      });
      document.body.style.overflow = 'hidden';
      document.body.appendChild(errBackdrop);
    }
  }

  const ENABLED_KEY = 'enabled';
  let currentButton = null;

  function showButton() {
    if (currentButton) return;
    currentButton = createFloatingButton();
    currentButton.addEventListener('click', openModal);
    document.body.appendChild(currentButton);
  }

  function hideButton() {
    if (currentButton && currentButton.parentNode) {
      currentButton.remove();
      currentButton = null;
    }
  }

  function updateButtonVisibility(enabled) {
    if (enabled) {
      showButton();
    } else {
      hideButton();
    }
  }

  function init() {
    chrome.storage.local.get(ENABLED_KEY, (result) => {
      const enabled = result[ENABLED_KEY] !== false;
      updateButtonVisibility(enabled);
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[ENABLED_KEY]) {
        const enabled = changes[ENABLED_KEY].newValue !== false;
        updateButtonVisibility(enabled);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
