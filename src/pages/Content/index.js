/**
 * Job Scanner Chrome Extension - Content Script
 * Floating button, action modal, keyword scan, highlighting, AI analysis
 */

(function () {
  'use strict';

  const ENABLED_KEY = 'enabled';
  const TEMPLATES_KEY = 'templates';
  const ACTIVE_TEMPLATE_KEY = 'activeTemplateId';

  const SELECTORS_TO_EXCLUDE = [
    'script',
    'style',
    'noscript',
    'iframe',
    'svg',
    'code',
    'pre',
    '[role="presentation"]',
    '[aria-hidden="true"]',
  ].join(', ');

  const HIGHLIGHT_EXCLUDE_TAGS = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE'];

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

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

  function findKeywordMatches(text, keyword) {
    const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'gi');
    const matches = text.match(regex);
    return {
      found: matches ? matches.length > 0 : false,
      count: matches ? matches.length : 0,
    };
  }

  function isInsideExcludedElement(node) {
    let parent = node.parentElement;
    while (parent && parent !== document.body) {
      if (HIGHLIGHT_EXCLUDE_TAGS.includes(parent.tagName)) {
        return true;
      }
      parent = parent.parentElement;
    }
    return false;
  }

  function getMatchesInText(text, keywordsWithCategory) {
    const matches = [];
    let pos = 0;

    while (pos < text.length) {
      let bestMatch = null;
      let bestLength = 0;

      for (const item of keywordsWithCategory) {
        const regex = new RegExp(`\\b${escapeRegex(item.keyword)}\\b`, 'gi');
        regex.lastIndex = pos;
        const m = regex.exec(text);
        if (m && m.index === pos && m[0].length > bestLength) {
          bestLength = m[0].length;
          bestMatch = {
            start: m.index,
            end: m.index + m[0].length,
            text: m[0],
            categoryIndex: item.categoryIndex,
          };
        }
      }

      if (bestMatch) {
        matches.push(bestMatch);
        pos = bestMatch.end;
      } else {
        pos++;
      }
    }
    return matches;
  }

  function clearHighlights() {
    try {
      document.querySelectorAll('.job-scanner-highlight').forEach((el) => {
        const parent = el.parentNode;
        if (!parent) return;
        const text = document.createTextNode(el.textContent);
        parent.replaceChild(text, el);
        parent.normalize();
      });
      const styleEl = document.getElementById('job-scanner-highlight-styles');
      if (styleEl) styleEl.remove();
    } catch (err) {
      console.warn('Job Scanner: Error clearing highlights', err);
    }
  }

  function injectHighlightStyles(template) {
    let styleEl = document.getElementById('job-scanner-highlight-styles');
    if (styleEl) styleEl.remove();

    styleEl = document.createElement('style');
    styleEl.id = 'job-scanner-highlight-styles';

    const categories = template.categories || [];
    let css = '';
    categories.forEach((cat, i) => {
      const color = cat.highlightColor || '#E6B34D';
      const rgb = hexToRgb(color);
      const safeName = `cat-${i}`;
      css += `
.job-scanner-highlight-${safeName} {
  background-color: rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3);
  border-bottom: 2px solid ${color};
  cursor: pointer;
}
`;
    });

    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 230, g: 179, b: 77 };
  }

  function applyHighlights(template) {
    try {
      clearHighlights();
      injectHighlightStyles(template);

      const flatKeywords = [];
      (template.categories || []).forEach((cat, catIndex) => {
        (cat.keywords || []).forEach((kw) => {
          if (kw && kw.trim()) {
            flatKeywords.push({
              keyword: kw.trim(),
              categoryIndex: catIndex,
            });
          }
        });
      });

      if (flatKeywords.length === 0) return;

      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      const textNodes = [];
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent.trim() && !isInsideExcludedElement(node)) {
          textNodes.push(node);
        }
      }

      textNodes.forEach((textNode) => {
        const text = textNode.textContent;
        const matches = getMatchesInText(text, flatKeywords);
        if (matches.length === 0) return;

        const fragment = document.createDocumentFragment();
        let lastEnd = 0;

        matches.forEach((m) => {
          if (m.start > lastEnd) {
            fragment.appendChild(
              document.createTextNode(text.slice(lastEnd, m.start))
            );
          }
          const span = document.createElement('span');
          span.className = `job-scanner-highlight job-scanner-highlight-cat-${m.categoryIndex}`;
          span.textContent = text.slice(m.start, m.end);
          span.dataset.categoryIndex = String(m.categoryIndex);
          fragment.appendChild(span);
          lastEnd = m.end;
        });

        if (lastEnd < text.length) {
          fragment.appendChild(document.createTextNode(text.slice(lastEnd)));
        }

        const parent = textNode.parentNode;
        if (parent) {
          parent.replaceChild(fragment, textNode);
        }
      });

      setupClickToJump();
    } catch (err) {
      console.warn('Job Scanner: Error applying highlights', err);
    }
  }

  let highlightElements = [];
  let currentHighlightIndex = -1;

  function setupClickToJump() {
    highlightElements = Array.from(
      document.querySelectorAll('.job-scanner-highlight')
    );
    currentHighlightIndex = -1;

    highlightElements.forEach((el, i) => {
      el.removeEventListener('click', handleHighlightClick);
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleHighlightClick(i);
      });
    });
  }

  function handleHighlightClick(clickedIndex) {
    if (highlightElements.length === 0) return;

    const nextIndex =
      clickedIndex === currentHighlightIndex
        ? (clickedIndex + 1) % highlightElements.length
        : (clickedIndex + 1) % highlightElements.length;

    currentHighlightIndex = nextIndex;
    const target = highlightElements[nextIndex];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('job-scanner-highlight-pulse');
      setTimeout(() => target.classList.remove('job-scanner-highlight-pulse'), 600);
    }
  }

  function createFloatingButton() {
    const btn = document.createElement('button');
    btn.className = 'job-scanner-float-btn';
    btn.setAttribute('aria-label', 'Open Job Scanner');

    const img = document.createElement('img');
    img.src = chrome.runtime.getURL('icon-128.png');
    img.alt = 'Job Scanner';
    btn.appendChild(img);

    return btn;
  }

  function createActionModal(onScanKeywords, onAiAnalysis) {
    const backdrop = document.createElement('div');
    backdrop.className = 'job-scanner-modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'job-scanner-modal';

    const header = document.createElement('div');
    header.className = 'job-scanner-modal-header';
    const title = document.createElement('h2');
    title.className = 'job-scanner-modal-title';
    title.textContent = 'Job Scanner';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'job-scanner-modal-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '&times;';
    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'job-scanner-modal-body';
    body.innerHTML = `
      <p class="job-scanner-action-prompt">What would you like to do?</p>
      <button class="job-scanner-action-btn" data-action="scan">
        <span class="job-scanner-action-icon">🔍</span>
        <span>Scan Keywords</span>
      </button>
      <button class="job-scanner-action-btn" data-action="ai">
        <span class="job-scanner-action-icon">🤖</span>
        <span>AI Match Analysis</span>
      </button>
    `;

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

    body.querySelector('[data-action="scan"]').addEventListener('click', () => {
      closeModal();
      onScanKeywords();
    });

    body.querySelector('[data-action="ai"]').addEventListener('click', () => {
      closeModal();
      onAiAnalysis();
    });

    return { backdrop, closeModal };
  }

  function createScanResultsModal(template, results, onCloseAndHighlight) {
    const backdrop = document.createElement('div');
    backdrop.className = 'job-scanner-modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'job-scanner-modal job-scanner-results-modal';

    const header = document.createElement('div');
    header.className = 'job-scanner-modal-header';
    const title = document.createElement('h2');
    title.className = 'job-scanner-modal-title';
    title.textContent = 'Keyword Scan Results';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'job-scanner-modal-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '&times;';
    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'job-scanner-modal-body';

    body.appendChild(
      createResultElement('p', 'job-scanner-results-template', [
        `Template: "${template.name}"`,
      ])
    );

    const found = results.found || [];
    const notFound = results.notFound || [];

    if (found.length === 0 && notFound.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'job-scanner-results-empty';
      emptyMsg.textContent = 'No keywords in this template. Add keywords in the extension popup.';
      body.appendChild(emptyMsg);
    }

    if (found.length > 0) {
      const foundHeader = document.createElement('p');
      foundHeader.className = 'job-scanner-results-section-header';
      foundHeader.textContent = '✅ Found Keywords:';
      body.appendChild(foundHeader);

      const byCategory = {};
      found.forEach((r) => {
        if (!byCategory[r.categoryName]) {
          byCategory[r.categoryName] = { emoji: r.emoji, items: [] };
        }
        byCategory[r.categoryName].items.push(r);
      });

      Object.entries(byCategory).forEach(([catName, data]) => {
        const catDiv = document.createElement('div');
        catDiv.className = 'job-scanner-results-category';
        catDiv.innerHTML = `<span class="job-scanner-results-cat-name">${data.emoji} ${catName}</span>`;
        const ul = document.createElement('ul');
        data.items.forEach((item) => {
          const li = document.createElement('li');
          li.className = 'job-scanner-results-found';
          li.textContent = `${item.keyword} (${item.count})`;
          ul.appendChild(li);
        });
        catDiv.appendChild(ul);
        body.appendChild(catDiv);
      });
    }

    if (notFound.length > 0) {
      const notFoundHeader = document.createElement('p');
      notFoundHeader.className = 'job-scanner-results-section-header';
      notFoundHeader.textContent = '❌ Not Found:';
      body.appendChild(notFoundHeader);

      const byCategory = {};
      notFound.forEach((r) => {
        if (!byCategory[r.categoryName]) {
          byCategory[r.categoryName] = { emoji: r.emoji, items: [] };
        }
        byCategory[r.categoryName].items.push(r);
      });

      Object.entries(byCategory).forEach(([catName, data]) => {
        const catDiv = document.createElement('div');
        catDiv.className = 'job-scanner-results-category';
        catDiv.innerHTML = `<span class="job-scanner-results-cat-name">${data.emoji} ${catName}</span>`;
        const ul = document.createElement('ul');
        data.items.forEach((item) => {
          const li = document.createElement('li');
          li.className = 'job-scanner-results-not-found';
          li.textContent = item.keyword;
          ul.appendChild(li);
        });
        catDiv.appendChild(ul);
        body.appendChild(catDiv);
      });
    }

    const footer = document.createElement('div');
    footer.className = 'job-scanner-modal-footer';
    const closeAndHighlightBtn = document.createElement('button');
    closeAndHighlightBtn.className = 'job-scanner-action-btn job-scanner-action-btn--full';
    closeAndHighlightBtn.textContent = 'Close and Highlight';
    closeAndHighlightBtn.addEventListener('click', () => {
      backdrop.remove();
      document.body.style.overflow = '';
      onCloseAndHighlight();
    });

    footer.appendChild(closeAndHighlightBtn);
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    backdrop.appendChild(modal);

    function closeModal() {
      backdrop.remove();
      document.body.style.overflow = '';
      onCloseAndHighlight();
    }

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });
    closeBtn.addEventListener('click', closeModal);

    return { backdrop, closeModal };
  }

  function createResultElement(tag, className, content) {
    const el = document.createElement(tag);
    el.className = className;
    el.textContent = content.join ? content.join('') : content;
    return el;
  }

  function runKeywordScan() {
    chrome.storage.local.get(
      [TEMPLATES_KEY, ACTIVE_TEMPLATE_KEY],
      (result) => {
        const templates = result[TEMPLATES_KEY] || [];
        const activeId = result[ACTIVE_TEMPLATE_KEY];
        const template = templates.find((t) => t.id === activeId);

        if (!template || !template.categories?.length) {
          showErrorModal('No template configured. Please add a template in the extension popup.');
          return;
        }

        const pageText = extractPageText();
        const found = [];
        const notFound = [];

        template.categories.forEach((cat) => {
          (cat.keywords || []).forEach((kw) => {
            const trimmed = (kw || '').trim();
            if (!trimmed) return;

            const { found: isFound, count } = findKeywordMatches(pageText, trimmed);
            const item = {
              keyword: trimmed,
              categoryName: cat.name || 'Category',
              emoji: cat.emoji || '📌',
            };

            if (isFound) {
              found.push({ ...item, count });
            } else {
              notFound.push(item);
            }
          });
        });

        const backdrop = createScanResultsModal(
          template,
          { found, notFound },
          () => applyHighlights(template)
        ).backdrop;

        document.body.style.overflow = 'hidden';
        document.body.appendChild(backdrop);
      }
    );
  }

  function showLoadingModal() {
    const backdrop = document.createElement('div');
    backdrop.className = 'job-scanner-modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'job-scanner-modal';

    const header = document.createElement('div');
    header.className = 'job-scanner-modal-header';
    const title = document.createElement('h2');
    title.className = 'job-scanner-modal-title';
    title.textContent = 'AI Match Analysis';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'job-scanner-modal-close';
    closeBtn.setAttribute('aria-label', 'Cancel');
    closeBtn.innerHTML = '&times;';
    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'job-scanner-modal-body';
    body.innerHTML = `
      <div class="job-scanner-loader">
        <div class="job-scanner-spinner"></div>
        <p class="job-scanner-loading-text">Analyzing job fit...</p>
      </div>
    `;

    modal.appendChild(header);
    modal.appendChild(body);
    backdrop.appendChild(modal);

    document.body.style.overflow = 'hidden';
    document.body.appendChild(backdrop);

    let cancelled = false;

    function closeLoading() {
      if (backdrop.parentNode) {
        backdrop.remove();
      }
      document.body.style.overflow = '';
    }

    closeBtn.addEventListener('click', () => {
      cancelled = true;
      closeLoading();
    });

    return {
      close: closeLoading,
      get cancelled() {
        return cancelled;
      },
    };
  }

  function runAiAnalysis() {
    chrome.storage.local.get(['cvText', 'apiKey'], (storage) => {
      const cvText = storage.cvText || '';
      const apiKey = storage.apiKey || '';

      if (!apiKey) {
        showErrorModal(
          'Please add your Gemini API key in the extension settings'
        );
        return;
      }
      if (!cvText || !cvText.trim()) {
        showErrorModal(
          'Please add your CV/background in the extension settings'
        );
        return;
      }

      const jobText = extractPageText();
      if (!jobText || !jobText.trim()) {
        showErrorModal('No text content found on this page.');
        return;
      }

      const loader = showLoadingModal();

      chrome.runtime.sendMessage(
        { action: 'analyzeJob', jobText, cvText },
        (response) => {
          loader.close();

          if (loader.cancelled) return;

          if (chrome.runtime.lastError) {
            showErrorModal(
              chrome.runtime.lastError.message || 'Failed to connect to extension.'
            );
            return;
          }
          if (response?.error) {
            showErrorModal(response.error);
            return;
          }
          if (response?.analysis) {
            showAiResultsModal(response.analysis);
          }
        }
      );
    });
  }

  function showErrorModal(message) {
    const backdrop = document.createElement('div');
    backdrop.className = 'job-scanner-modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'job-scanner-modal';

    const header = document.createElement('div');
    header.className = 'job-scanner-modal-header';
    const title = document.createElement('h2');
    title.className = 'job-scanner-modal-title';
    title.textContent = 'Error';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'job-scanner-modal-close';
    closeBtn.innerHTML = '&times;';
    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'job-scanner-modal-body';
    const errEl = document.createElement('div');
    errEl.className = 'job-scanner-error-content';
    errEl.innerHTML = `<span class="job-scanner-error-icon" aria-hidden="true">⚠️</span><p class="job-scanner-error-text">${escapeHtml(message)}</p>`;
    body.appendChild(errEl);

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

    document.body.style.overflow = 'hidden';
    document.body.appendChild(backdrop);
  }

  function showAiResultsModal(analysis) {
    const backdrop = document.createElement('div');
    backdrop.className = 'job-scanner-modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'job-scanner-modal job-scanner-ai-modal';

    const header = document.createElement('div');
    header.className = 'job-scanner-modal-header';
    const title = document.createElement('h2');
    title.className = 'job-scanner-modal-title';
    title.textContent = 'AI Match Analysis';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'job-scanner-modal-close';
    closeBtn.innerHTML = '&times;';
    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'job-scanner-modal-body job-scanner-ai-body';
    body.innerHTML = analysis.replace(/\n/g, '<br>');

    const footer = document.createElement('div');
    footer.className = 'job-scanner-modal-footer';
    const closeBtnFooter = document.createElement('button');
    closeBtnFooter.className = 'job-scanner-action-btn job-scanner-action-btn--full';
    closeBtnFooter.textContent = 'Close';
    footer.appendChild(closeBtnFooter);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    backdrop.appendChild(modal);

    function closeModal() {
      backdrop.remove();
      document.body.style.overflow = '';
    }

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });
    closeBtn.addEventListener('click', closeModal);
    closeBtnFooter.addEventListener('click', closeModal);

    document.body.style.overflow = 'hidden';
    document.body.appendChild(backdrop);
  }

  function openActionModal() {
    clearHighlights();

    const { backdrop } = createActionModal(runKeywordScan, runAiAnalysis);
    document.body.style.overflow = 'hidden';
    document.body.appendChild(backdrop);
  }

  let currentButton = null;

  function showButton() {
    if (currentButton) return;
    currentButton = createFloatingButton();
    currentButton.addEventListener('click', openActionModal);
    document.body.appendChild(currentButton);
  }

  function hideButton() {
    if (currentButton && currentButton.parentNode) {
      currentButton.remove();
      currentButton = null;
    }
    clearHighlights();
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
