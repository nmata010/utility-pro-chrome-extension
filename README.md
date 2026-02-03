# Utility Pro Invoices

A Chrome extension to simplify pro-rated utility billing on TurboTeanant.

## What it does

Automatically create invoices and charges on TurboTenant for pro-rated utility billing:

1. **Extract data** from your utility bill PDF with AI (bring your own keys)
2. **Calculate the split** based on submeter usage
3. **Generate a professional invoice** PDF (based on [web version](http://utilitypro.aheadofthecurve.io/))
4. **Auto-fill the TurboTenant charge form** with all the details

## Features

- Drag-and-drop upload for utility bills (PDF) and submeter reports (CSV)
- AI-powered data extraction (billing period, total amount, usage)
- Calculation of pro-rated charges
- Toggle between billing the submeter usage or the delta
- Invoice PDF creation
- One click charge form filling
- Pulls tenant names and property addresses directly from TurboTenant

## Installation

### From source (developer mode)

1. Clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `extension` folder

### Configuration

1. Copy `extension/lib/config.example.js` to `extension/lib/config.js`
2. Click the extension icon and go to Settings
3. Add your _Anthropic_ API key:
4. Enter your landlord information (name, address, phone)

## Usage

1. Open extension
2. Select utility type
3. Select the lease you're billing
4. Upload docs & process with AI (or manually)
5. Generate invoice & review the charge details
6. Select deposit account and submit!

## Project Structure

```
extension/
├── manifest.json        # Chrome extension config
├── assets/icons/        # Extension icons
├── background/          # Service worker (API calls, PDF generation)
├── content/             # TurboTenant page automation
├── lib/                 # Shared libraries (LLM, PDF, config)
├── options/             # Settings page
└── popup/               # Main UI
```

## Requirements

- Chrome browser
- Anthropic API key (for AI extraction)
- TurboTenant account

## License

MIT
