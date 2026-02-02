# Utility Pro Invoices - Product Requirements Document (PRD)

**Version:** 1.0
**Date:** February 1, 2026
**Status:** In Development

## 1. Introduction & Vision

### 1.1. Vision

To eliminate the manual, error-prone, and time-consuming process of pro-rated utility billing for landlords using TurboTenant. Utility Pro Invoices aims to be a "fire-and-forget" solution that transforms a utility bill and usage report into a paid charge with just a few clicks.

### 1.2. Problem Statement

Landlords with multi-unit properties or accessory dwelling units (ADUs) often need to split utility bills based on usage. This involves:
1.  Manually reading a utility bill PDF to find the billing period, total cost, and total usage.
2.  Reading a submeter report (often a CSV) to determine the tenant's portion of usage.
3.  Calculating the tenant's share of the bill.
4.  Creating a professional invoice for record-keeping.
5.  Manually logging into TurboTenant, navigating to the correct lease, and creating a new charge.
6.  Filling out the charge form with all the details and attaching the relevant documents.

This process is tedious, repetitive, and prone to calculation or data entry errors.

### 1.3. Proposed Solution

Utility Pro Invoices is a Chrome extension that automates this entire workflow. It intelligently extracts data from utility documents, calculates the pro-rated split, generates a professional invoice, and automatically fills out the charge creation form within the TurboTenant web application. By integrating directly with the user's workflow, it reduces the entire process from 15-20 minutes of manual work to under a minute of guided clicks.

## 2. Target Audience

The primary target audience is **landlords and property managers** who:
-   Use TurboTenant as their property management software.
-   Manage properties with submeters for utilities (e.g., sub-metered duplex with single electric account).
-   Are responsible for billing tenants for their portion of utility usage (specifically electricity, with future expansion planned).
-   Are comfortable installing and using Chrome extensions.

## 3. Key Features

### 3.1. AI-Powered Data Extraction
-   **PDF Bill Analysis:** Users can upload their electricity bill in PDF format. The extension uses an AI model (Anthropic Claude) to extract key information:
    -   Billing Period (start and end dates)
    -   Total Bill Amount ($)
    -   Total Electricity Usage (kWh)
-   **Submeter CSV Parsing:** Users can upload a submeter usage report in CSV format. The extension parses the file to calculate the total tenant usage (kWh).
-   **Error Handling:** The AI provides user-friendly error messages if the uploaded document is not a recognized utility bill or is missing key information.

### 3.2. Manual Data Entry & Review
-   **Manual Override:** Users can choose to bypass the AI extraction and enter all billing data manually.
-   **Data Review & Correction:** After AI extraction, all data is presented in an editable form, allowing the user to review and correct any fields before proceeding.
-   **Pre-filled Submeter Data:** If a user opts for manual entry but has uploaded a submeter CSV, the tenant's usage (kWh) is automatically calculated and pre-filled.

### 3.3. Pro-rated Calculation
-   **Flexible Billing Modes:** The extension supports two common billing scenarios:
    1.  **Bill Main House:** Calculate the charge for the main house's usage (Total Usage - Tenant Usage).
    2.  **Bill Tenant:** Calculate the charge for the tenant's usage directly.
-   **Real-time Calculation:** The final charge amount is updated in real-time as the user adjusts data or toggles the billing mode.
-   **Transparent Rate:** The effective rate ($/kWh) is clearly displayed.

### 3.4. Automated Invoice Generation
-   **Dynamic PDF Creation:** The extension generates a professional, well-formatted PDF invoice containing:
    -   Landlord's name and contact information (from settings).
    -   Tenant's name and property address (scraped from TurboTenant).
    -   A clear breakdown of charges: total usage, tenant usage, effective rate, and the final amount due.
    -   Payment terms and calculation methodology.
-   **Downloadable Invoice:** The generated invoice can be downloaded directly by the user.

### 3.5. TurboTenant Integration & Automation
-   **Lease & Tenant Discovery:** The extension scrapes the TurboTenant "Leases" and "Tenants" pages to get a list of active leases and the corresponding tenant names.
-   **Property Address Discovery:** The extension automatically navigates through the TurboTenant site to find and scrape the full property address associated with the selected lease.
-   **Automated Charge Form Filling:** After the user confirms the details, the extension navigates to the correct TurboTenant "Create Charge" page and automatically:
    -   Selects the "One-Time Charge" type.
    -   Sets the category to "Utility Charge".
    -   Fills in the calculated amount and a descriptive title (e.g., "Utility Bill - Jan 1, 2026 - Feb 1, 2026").
    -   Attaches the generated invoice PDF, the original utility bill PDF, and the submeter CSV report.
-   **Guided Completion:** The user is left with only one action: selecting the destination bank account and clicking "Create Charge". The extension highlights this final required field.

### 3.6. Configuration
-   **Settings Page:** A dedicated options page allows users to configure:
    -   Landlord Name, Address, and Phone for invoices.
    -   Custom column names for the submeter CSV file.
-   **API Key Management:** The extension requires the user to provide their own API key for the AI features.

## 4. User Flow

1.  **Start:** User clicks the extension icon. They are prompted to select a utility type. They click "Electric".
2.  **Navigate to Leases:** The extension automatically navigates the user's active tab to the TurboTenant leases page if they are not already there.
3.  **Select Lease:** The popup displays a dropdown of all leases found on the page. The user selects the lease they want to bill.
4.  **Upload Documents:** The user is presented with two dropzones to upload the PDF utility bill and the CSV submeter report.
5.  **Process Data:** The user can either click "Process with AI" for automatic extraction or "Enter Manually".
6.  **Review & Confirm:** The user reviews the extracted/manual data. They can edit any field and see the final charge recalculated instantly. They confirm the details and click "Generate Invoice".
7.  **Automated Data Gathering:** The extension shows a progress indicator as it automatically navigates the site in the background to fetch tenant names and the property address. It then generates the invoice PDF.
8.  **Final Review:** The user sees a final summary of the charge, including the amount, description, and a list of files to be attached.
9.  **Create Charge:** The user clicks "Open & Fill Charge Form".
10. **Form Automation:** The extension opens the TurboTenant charge page for the correct lease and fills in all the information. The popup closes.
11. **Complete:** The user reviews the pre-filled form on the TurboTenant page, selects their bank account for the deposit, and submits the charge.

## 5. Non-Functional Requirements

-   **Browser Support:** The extension must be compatible with the latest stable version of Google Chrome.
-   **Security:** The user's API key and landlord information must be stored securely using `chrome.storage.local` and not be exposed. API calls to Anthropic are made directly from the client-side service worker.
-   **Performance:** The extension should be lightweight and not noticeably slow down the user's browsing experience. UI interactions should be responsive.
-   **Reliability:** The DOM selectors for scraping TurboTenant must be maintained and updated if the site's structure changes. The extension should handle potential site changes gracefully.