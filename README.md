# Job Scanner Chrome Extension

A Chrome extension that helps you scan job postings for keywords and get AI-powered job fit analysis. Identify key requirements, highlight matches on the page, and receive personalized insights on how well a role aligns with your background.

![Job Scanner Icon](src/assets/img/icon-128.png)

## Features

- **Keyword Scan**: Scan any job page for keywords from your custom templates. Match by category (Location, Role, Tech Stack, etc.) with color-coded highlighting.
- **AI Match Analysis**: Get Gemini-powered analysis with Strong Matches, Gaps/Concerns, and a Quick Take summary in second-person language.
- **Template Management**: Create custom templates with categories and keywords (max 10 per template). Add emojis and highlight colors per category.
- **CV Storage**: Store your CV or background text securely in the extension for AI analysis.

## Setup

1. **Install the extension**
   - Clone this repo and run `npm install` then `npm run build`
   - Open Chrome → `chrome://extensions` → Enable "Developer mode" → "Load unpacked" → select the `build` folder

2. **Configure**
   - Click the extension icon
   - Add your [Gemini API key](https://aistudio.google.com/apikey)
   - Paste your CV or key background info
   - Save both

3. **Enable**
   - Toggle the extension ON
   - Visit any job posting page
   - Click the floating magnifying glass button (bottom-left)

## Usage

### Keyword Scan

1. On a job page, click the floating button
2. Click **"🔍 Scan Keywords"**
3. Review found vs. not found keywords by category
4. Click **"Close and Highlight"** to highlight matches on the page
5. Click highlighted words to jump between occurrences

### AI Match Analysis

1. On a job page, click the floating button
2. Click **"🤖 AI Match Analysis"**
3. Wait a few seconds for the analysis
4. Review Strong Matches, Gaps/Concerns, and Quick Take

### Templates

- Create templates with categories and keywords in the popup
- Select a template from the dropdown
- Edit or delete templates (at least one must remain)
- Default "General Tech Job" template is included

## Requirements

- Chrome (or Edge) with Manifest V3 support
- Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

## Storage

All data is stored locally in your browser (`chrome.storage.local`):

- API key
- CV text
- Templates
- Extension enabled state

## Build

```bash
npm install
npm run build
```

The built extension is in the `build` folder. A zip file is also created in `zip/`.

## License

MIT
