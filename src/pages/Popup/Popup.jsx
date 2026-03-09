import React, { useState, useEffect } from 'react';
import './Popup.css';

const STORAGE_KEY = 'apiKey';
const ENABLED_KEY = 'enabled';
const CV_TEXT_KEY = 'cvText';
const TEMPLATES_KEY = 'templates';
const ACTIVE_TEMPLATE_KEY = 'activeTemplateId';

const MAX_KEYWORDS_PER_TEMPLATE = 10;

const CATEGORY_COLORS = ['#E6B34D', '#D4A843', '#B8922D'];

const DEFAULT_TEMPLATE = {
  id: 'default-1',
  name: 'General Tech Job',
  categories: [
    {
      name: 'Location',
      emoji: '📍',
      keywords: ['Remote', 'Relocation'],
      highlightColor: '#E6B34D',
    },
    {
      name: 'Role',
      emoji: '💼',
      keywords: ['API', 'Backend', 'Full Stack'],
      highlightColor: '#D4A843',
    },
  ],
};

function generateTemplateId() {
  return `template-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getTotalKeywordCount(template) {
  return (template?.categories ?? []).reduce(
    (sum, cat) => sum + (cat.keywords?.length ?? 0),
    0
  );
}

const Popup = () => {
  const [apiKey, setApiKey] = useState('');
  const [hasKeySaved, setHasKeySaved] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState('');

  const [cvText, setCvText] = useState('');
  const [hasCvSaved, setHasCvSaved] = useState(false);

  const [templates, setTemplates] = useState([]);
  const [activeTemplateId, setActiveTemplateId] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editorForm, setEditorForm] = useState({ name: '', categories: [] });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);

  useEffect(() => {
    chrome.storage.local.get(
      [STORAGE_KEY, ENABLED_KEY, CV_TEXT_KEY, TEMPLATES_KEY, ACTIVE_TEMPLATE_KEY],
      (result) => {
        setHasKeySaved(!!result[STORAGE_KEY]);
        setEnabled(result[ENABLED_KEY] !== false);
        setHasCvSaved(!!result[CV_TEXT_KEY]);
        setCvText(result[CV_TEXT_KEY] ?? '');

        let templatesList = result[TEMPLATES_KEY] ?? [];
        let activeId = result[ACTIVE_TEMPLATE_KEY];

        if (templatesList.length === 0) {
          templatesList = [DEFAULT_TEMPLATE];
          activeId = DEFAULT_TEMPLATE.id;
          chrome.storage.local.set({
            [TEMPLATES_KEY]: templatesList,
            [ACTIVE_TEMPLATE_KEY]: activeId,
          });
        }

        if (!activeId || !templatesList.find((t) => t.id === activeId)) {
          activeId = templatesList[0]?.id ?? null;
          chrome.storage.local.set({ [ACTIVE_TEMPLATE_KEY]: activeId });
        }

        setTemplates(templatesList);
        setActiveTemplateId(activeId);
      }
    );
  }, []);

  const activeTemplate = templates.find((t) => t.id === activeTemplateId);

  const handleSaveApiKey = () => {
    const key = apiKey.trim();
    if (!key) {
      setStatus('Please enter your API key');
      return;
    }
    chrome.storage.local.set({ [STORAGE_KEY]: key }, () => {
      setSaved(true);
      setHasKeySaved(true);
      setApiKey('');
      setStatus('API key saved');
      setTimeout(() => {
        setSaved(false);
        setStatus('');
      }, 2000);
    });
  };

  const handleDeleteApiKey = () => {
    chrome.storage.local.remove(STORAGE_KEY, () => {
      setHasKeySaved(false);
      setApiKey('');
      setStatus('API key deleted');
      setSaved(true);
      setTimeout(() => {
        setStatus('');
        setSaved(false);
      }, 2000);
    });
  };

  const handleSaveCv = () => {
    const text = cvText.trim();
    chrome.storage.local.set({ [CV_TEXT_KEY]: text }, () => {
      setSaved(true);
      setHasCvSaved(!!text);
      setStatus(text ? 'CV saved' : 'CV cleared');
      setTimeout(() => {
        setSaved(false);
        setStatus('');
      }, 2000);
    });
  };

  const handleDeleteCv = () => {
    chrome.storage.local.remove(CV_TEXT_KEY, () => {
      setHasCvSaved(false);
      setCvText('');
      setStatus('CV deleted');
      setSaved(true);
      setTimeout(() => {
        setStatus('');
        setSaved(false);
      }, 2000);
    });
  };

  const handleDisable = () => {
    chrome.storage.local.set({ [ENABLED_KEY]: false }, () => {
      setEnabled(false);
      setStatus('Extension disabled');
      setSaved(true);
      setTimeout(() => {
        setStatus('');
        setSaved(false);
      }, 2000);
    });
  };

  const handleEnable = () => {
    chrome.storage.local.set({ [ENABLED_KEY]: true }, () => {
      setEnabled(true);
      setStatus('Extension enabled');
      setSaved(true);
      setTimeout(() => {
        setStatus('');
        setSaved(false);
      }, 2000);
    });
  };

  const handleTemplateSelect = (e) => {
    const id = e.target.value;
    if (id) {
      setActiveTemplateId(id);
      chrome.storage.local.set({ [ACTIVE_TEMPLATE_KEY]: id });
    }
  };

  const openNewTemplate = () => {
    setEditingTemplate(null);
    setEditorForm({
      name: '',
      categories: [
        { name: 'Location', emoji: '📍', keywords: [], highlightColor: CATEGORY_COLORS[0] },
        { name: 'Role', emoji: '💼', keywords: [], highlightColor: CATEGORY_COLORS[1] },
      ],
    });
    setShowEditor(true);
  };

  const openEditTemplate = () => {
    const t = activeTemplate;
    if (!t) return;
    setEditingTemplate(t);
    setEditorForm({
      name: t.name,
      categories: (t.categories ?? []).map((c) => ({
        ...c,
        keywords: [...(c.keywords ?? [])],
      })),
    });
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setEditingTemplate(null);
    setEditorForm({ name: '', categories: [] });
  };

  const saveTemplate = () => {
    const name = editorForm.name.trim();
    if (!name) {
      setStatus('Please enter a template name');
      return;
    }

    const totalKeywords = getTotalKeywordCount({ categories: editorForm.categories });
    if (totalKeywords > MAX_KEYWORDS_PER_TEMPLATE) {
      setStatus(`Maximum ${MAX_KEYWORDS_PER_TEMPLATE} keywords per template`);
      return;
    }

    const newTemplate = {
      id: editingTemplate?.id ?? generateTemplateId(),
      name,
      categories: editorForm.categories.filter(
        (c) => (c.keywords ?? []).length > 0 || (c.name ?? '').trim()
      ).map((c) => ({
        name: (c.name ?? '').trim() || 'Category',
        emoji: c.emoji ?? '📌',
        keywords: (c.keywords ?? []).filter((k) => (k ?? '').trim()),
        highlightColor: c.highlightColor ?? CATEGORY_COLORS[0],
      })),
    };

    let newTemplates;
    let newActiveId = activeTemplateId;

    if (editingTemplate) {
      newTemplates = templates.map((t) =>
        t.id === editingTemplate.id ? newTemplate : t
      );
    } else {
      newTemplates = [...templates, newTemplate];
      newActiveId = newTemplate.id;
    }

    chrome.storage.local.set(
      {
        [TEMPLATES_KEY]: newTemplates,
        [ACTIVE_TEMPLATE_KEY]: newActiveId,
      },
      () => {
        setTemplates(newTemplates);
        setActiveTemplateId(newActiveId);
        setStatus(editingTemplate ? 'Template updated' : 'Template created');
        setSaved(true);
        setTimeout(() => {
          setStatus('');
          setSaved(false);
        }, 2000);
        closeEditor();
      }
    );
  };

  const addCategory = () => {
    const colorIndex = editorForm.categories.length % CATEGORY_COLORS.length;
    setEditorForm({
      ...editorForm,
      categories: [
        ...editorForm.categories,
        {
          name: '',
          emoji: '📌',
          keywords: [],
          highlightColor: CATEGORY_COLORS[colorIndex],
        },
      ],
    });
  };

  const updateCategory = (index, field, value) => {
    const updated = [...editorForm.categories];
    updated[index] = { ...updated[index], [field]: value };
    setEditorForm({ ...editorForm, categories: updated });
  };

  const removeCategory = (index) => {
    setEditorForm({
      ...editorForm,
      categories: editorForm.categories.filter((_, i) => i !== index),
    });
  };

  const addKeyword = (catIndex) => {
    const total = getTotalKeywordCount({ categories: editorForm.categories });
    if (total >= MAX_KEYWORDS_PER_TEMPLATE) {
      setStatus(`Maximum ${MAX_KEYWORDS_PER_TEMPLATE} keywords per template`);
      return;
    }
    const cat = editorForm.categories[catIndex];
    const keywords = [...(cat.keywords ?? []), ''];
    updateCategory(catIndex, 'keywords', keywords);
  };

  const updateKeyword = (catIndex, kwIndex, value) => {
    const cat = editorForm.categories[catIndex];
    const keywords = [...(cat.keywords ?? [])];
    keywords[kwIndex] = value;
    updateCategory(catIndex, 'keywords', keywords);
  };

  const removeKeyword = (catIndex, kwIndex) => {
    const cat = editorForm.categories[catIndex];
    const keywords = (cat.keywords ?? []).filter((_, i) => i !== kwIndex);
    updateCategory(catIndex, 'keywords', keywords);
  };

  const requestDeleteTemplate = () => {
    if (templates.length <= 1) {
      setStatus('Cannot delete the last template. You must have at least one template.');
      return;
    }
    setTemplateToDelete(activeTemplate);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteTemplate = () => {
    if (!templateToDelete || templates.length <= 1) {
      setShowDeleteConfirm(false);
      setTemplateToDelete(null);
      return;
    }

    const remaining = templates.filter((t) => t.id !== templateToDelete.id);
    const wasActive = templateToDelete.id === activeTemplateId;
    const newActiveId = wasActive ? remaining[0].id : activeTemplateId;

    chrome.storage.local.set(
      {
        [TEMPLATES_KEY]: remaining,
        [ACTIVE_TEMPLATE_KEY]: newActiveId,
      },
      () => {
        setTemplates(remaining);
        setActiveTemplateId(newActiveId);
        setShowDeleteConfirm(false);
        setTemplateToDelete(null);
        const newActive = remaining.find((t) => t.id === newActiveId);
        setStatus(
          wasActive
            ? `Template deleted. Switched to ${newActive?.name ?? 'template'}`
            : 'Template deleted'
        );
        setSaved(true);
        setTimeout(() => {
          setStatus('');
          setSaved(false);
        }, 2000);
      }
    );
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setTemplateToDelete(null);
  };

  return (
    <div className="popup">
      <div className="popup-header">
        <h1 className="popup-title">Job Scanner</h1>
        <p className="popup-subtitle">Scan job postings for keywords and AI fit analysis</p>
      </div>

      <div className="popup-body">
        <div className="popup-section">
          <span className="popup-section-label">Job Scanner</span>
          {enabled ? (
            <button className="popup-disable-btn" onClick={handleDisable}>
              Disable
            </button>
          ) : (
            <button className="popup-enable-btn" onClick={handleEnable}>
              Enable
            </button>
          )}
        </div>

        <label htmlFor="api-key" className="popup-label">
          Gemini API Key
        </label>
        <input
          id="api-key"
          type="password"
          className="popup-input"
          placeholder={hasKeySaved ? 'Enter new key to replace' : 'Enter your API key'}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoComplete="new-password"
        />
        {hasKeySaved && !apiKey && (
          <p className="popup-configured">API key is configured</p>
        )}
        <p className="popup-hint">
          Get your API key from{' '}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google AI Studio
          </a>
        </p>

        <div className="popup-buttons">
          <button
            className={`popup-save-btn ${saved ? 'popup-save-btn--saved' : ''}`}
            onClick={handleSaveApiKey}
          >
            {saved ? 'Saved!' : 'Save API Key'}
          </button>
          {hasKeySaved && (
            <button className="popup-delete-btn" onClick={handleDeleteApiKey}>
              Delete API Key
            </button>
          )}
        </div>

        <label htmlFor="cv-text" className="popup-label popup-label--section">
          Your CV/Background
        </label>
        <textarea
          id="cv-text"
          className="popup-textarea"
          placeholder="Paste your CV or key background info here (experience, skills, education)..."
          value={cvText}
          onChange={(e) => setCvText(e.target.value)}
          rows={4}
        />
        {hasCvSaved && (
          <p className={`popup-char-count ${cvText.length > 10000 ? 'popup-char-count--warning' : ''}`}>
            {cvText.length.toLocaleString()} characters
            {cvText.length > 10000 && ' (very long — may affect AI analysis)'}
          </p>
        )}
        <div className="popup-buttons">
          <button
            className={`popup-save-btn ${saved ? 'popup-save-btn--saved' : ''}`}
            onClick={handleSaveCv}
          >
            {saved ? 'Saved!' : 'Save CV'}
          </button>
          {hasCvSaved && (
            <button className="popup-delete-btn" onClick={handleDeleteCv}>
              Delete CV
            </button>
          )}
        </div>

        <label className="popup-label popup-label--section">
          Templates
        </label>
        <select
          className="popup-select"
          value={activeTemplateId ?? ''}
          onChange={handleTemplateSelect}
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <div className="popup-template-buttons">
          <button className="popup-template-btn" onClick={openNewTemplate}>
            New Template
          </button>
          <button className="popup-template-btn" onClick={openEditTemplate}>
            Edit Template
          </button>
          <button
            className="popup-template-btn popup-template-btn--delete"
            onClick={requestDeleteTemplate}
            disabled={templates.length <= 1}
          >
            Delete Template
          </button>
        </div>

        {activeTemplate && (
          <div className="popup-active-template">
            <p className="popup-active-label">
              Active Template: &quot;{activeTemplate.name}&quot;
            </p>
            <p className="popup-keywords-label">Keywords (max {MAX_KEYWORDS_PER_TEMPLATE}):</p>
            <div className="popup-keywords-preview">
              {activeTemplate.categories?.map((cat, i) => (
                <div key={i} className="popup-keyword-group">
                  <span className="popup-keyword-emoji">{cat.emoji}</span>
                  <span className="popup-keyword-cat">{cat.name}</span>
                  <span className="popup-keyword-list">
                    {(cat.keywords ?? []).join(', ') || '(none)'}
                  </span>
                </div>
              ))}
            </div>
            <button className="popup-edit-keywords-btn" onClick={openEditTemplate}>
              Edit Keywords
            </button>
          </div>
        )}

        {status && (
          <p className={`popup-status ${saved ? 'popup-status--success' : ''}`}>
            {status}
          </p>
        )}
      </div>

      {showEditor && (
        <div className="popup-modal-backdrop" onClick={closeEditor}>
          <div
            className="popup-modal popup-editor-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="popup-modal-header">
              <h3 className="popup-modal-title">
                {editingTemplate ? 'Edit Template' : 'New Template'}
              </h3>
              <button className="popup-modal-close" onClick={closeEditor}>
                &times;
              </button>
            </div>
            <div className="popup-modal-body">
              <label className="popup-label">Template Name</label>
              <input
                type="text"
                className="popup-input"
                value={editorForm.name}
                onChange={(e) => setEditorForm({ ...editorForm, name: e.target.value })}
                placeholder="e.g. Software Engineer"
              />

              <label className="popup-label popup-label--section">
                Categories (optional)
              </label>
              {editorForm.categories.map((cat, catIndex) => (
                <div key={catIndex} className="popup-editor-category">
                  <div className="popup-editor-category-header">
                    <input
                      type="text"
                      className="popup-input popup-input--inline"
                      placeholder="Category name"
                      value={cat.name}
                      onChange={(e) => updateCategory(catIndex, 'name', e.target.value)}
                    />
                    <input
                      type="text"
                      className="popup-input popup-input--emoji"
                      placeholder="emoji"
                      value={cat.emoji}
                      onChange={(e) => updateCategory(catIndex, 'emoji', e.target.value)}
                    />
                    <button
                      className="popup-remove-btn"
                      onClick={() => removeCategory(catIndex)}
                      title="Remove category"
                    >
                      &times;
                    </button>
                  </div>
                  <div className="popup-editor-keywords">
                    {(cat.keywords ?? []).map((kw, kwIndex) => (
                      <div key={kwIndex} className="popup-editor-keyword-row">
                        <input
                          type="text"
                          className="popup-input popup-input--keyword"
                          value={kw}
                          onChange={(e) => updateKeyword(catIndex, kwIndex, e.target.value)}
                          placeholder="Keyword"
                        />
                        <button
                          className="popup-remove-btn"
                          onClick={() => removeKeyword(catIndex, kwIndex)}
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                    {getTotalKeywordCount({ categories: editorForm.categories }) <
                      MAX_KEYWORDS_PER_TEMPLATE && (
                      <button
                        className="popup-add-keyword-btn"
                        onClick={() => addKeyword(catIndex)}
                      >
                        Add Keyword
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {getTotalKeywordCount({ categories: editorForm.categories }) <
                MAX_KEYWORDS_PER_TEMPLATE && (
                <button className="popup-add-category-btn" onClick={addCategory}>
                  + Add Category
                </button>
              )}
            </div>
            <div className="popup-modal-footer">
              <button className="popup-save-btn" onClick={saveTemplate}>
                Save Template
              </button>
              <button className="popup-cancel-btn" onClick={closeEditor}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && templateToDelete && (
        <div className="popup-modal-backdrop" onClick={cancelDelete}>
          <div
            className="popup-modal popup-delete-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="popup-modal-header">
              <h3 className="popup-modal-title">Delete Template?</h3>
              <button className="popup-modal-close" onClick={cancelDelete}>
                &times;
              </button>
            </div>
            <div className="popup-modal-body">
              <p className="popup-delete-text">
                Are you sure you want to delete &quot;{templateToDelete.name}&quot;?
              </p>
              <p className="popup-delete-warning">This cannot be undone.</p>
            </div>
            <div className="popup-modal-footer">
              <button className="popup-cancel-btn" onClick={cancelDelete}>
                Cancel
              </button>
              <button
                className="popup-delete-confirm-btn"
                onClick={confirmDeleteTemplate}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Popup;
