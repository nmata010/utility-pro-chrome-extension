// TurboTenant content script
// Handles extracting lease data and automating charge creation

// ==================== Selectors ====================
// Based on actual TurboTenant DOM structure (captured Jan 2026)

const SELECTORS = {
  // Lease list page (/owners/leases)
  leaseItem: 'div[data-qa="manage-lease-item"]',
  leaseName: '.R9sje',
  leaseUnit: '.zUn7-',

  // Charge form - Step 1 (charge type)
  chargeTypeOneTime: '#ONE_TIME',
  chargeTypeNext: '#next_create_charge',

  // Charge form - Step 2 (charge details)
  category: '#category',
  description: '#description',
  amount: '#amount',
  dueDate: '#end_date',
  bankAccount: '#destination_id',
  fileInput: 'input[type="file"]',
  addAttachmentBtn: 'button._3pGU-'
};

// ==================== Message Handler ====================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true;
});

async function handleMessage(message) {
  console.log('Utility Pro: Received message:', message.type, message);

  switch (message.type) {
    case 'GET_LEASES':
      return getLeases();

    case 'START_TENANT_SCRAPE':
      console.log('Utility Pro: START_TENANT_SCRAPE called with leaseId:', message.leaseId);
      // Store the request - the popup will navigate to the tenants page
      await chrome.storage.local.set({
        'utilityPro_pendingTenantScrape': { leaseId: message.leaseId }
      });
      // Clear any previous result
      await chrome.storage.local.remove('utilityPro_tenantScrapeResult');
      return { started: true };

    case 'FIND_PROPERTY':
      console.log('Utility Pro: FIND_PROPERTY called with leaseId:', message.leaseId);
      return findPropertyOnPage(message.leaseId);

    case 'START_ADDRESS_SCRAPE':
      console.log('Utility Pro: START_ADDRESS_SCRAPE called with leaseId:', message.leaseId);
      // Store the request, then click the tile to navigate
      await chrome.storage.local.set({
        'utilityPro_pendingAddressScrape': { leaseId: message.leaseId }
      });
      await chrome.storage.local.remove('utilityPro_addressScrapeResult');
      // Click the matching tile to navigate to property details
      return clickPropertyTile(message.leaseId);

    case 'FILL_CHARGE':
      return fillChargeForm(message);

    case 'CHECK_PAGE':
      return { isTurboTenant: true, url: window.location.href };

    default:
      return { error: 'Unknown message type' };
  }
}

// ==================== Lease Extraction (DOM Scraping) ====================
async function getLeases() {
  try {
    const leases = [];
    const leaseElements = document.querySelectorAll(SELECTORS.leaseItem);

    console.log('Utility Pro: Found', leaseElements.length, 'lease elements');

    leaseElements.forEach((el) => {
      // Get the lease ID from the element's id attribute
      // Format: "manage-lease-item-TGVhc2U6OTQ2MDAy"
      const rawId = el.id || '';
      const leaseId = rawId.replace('manage-lease-item-', '') || `lease-${leases.length}`;

      // Get tenant/property name
      const nameEl = el.querySelector(SELECTORS.leaseName);
      const unitEl = el.querySelector(SELECTORS.leaseUnit);

      const name = nameEl?.textContent?.trim() || 'Unknown';
      const unit = unitEl?.textContent?.trim() || '';

      // Combine name and unit for display
      const displayName = unit ? `${name} - ${unit}` : name;

      leases.push({
        id: leaseId,
        tenantName: name,
        unit: unit,
        displayName: displayName,
        address: name
      });

      console.log('Utility Pro: Found lease:', displayName, 'ID:', leaseId);
    });

    if (leases.length === 0) {
      const currentUrl = window.location.href;
      if (!currentUrl.includes('/owners/leases')) {
        return {
          leases: [],
          error: 'Navigate to Leases page first'
        };
      }
      return { leases: [], error: 'No leases found on this page' };
    }

    return { leases };
  } catch (error) {
    console.error('Utility Pro: Error getting leases:', error);
    return { error: 'Could not extract lease information', leases: [] };
  }
}

// ==================== Tenant Scraper ====================
async function scrapeTenantsFromCurrentPage(leaseId) {
  console.log('Utility Pro: Scraping tenants from current page for lease ID:', leaseId);

  // Wait for the tenant table to load
  try {
    await waitForElement('td[data-qa^="view-tenant"]', 10000);
  } catch (e) {
    console.log('Utility Pro: Tenant table not found');
    return [];
  }

  const tenants = [];
  const tenantCells = document.querySelectorAll('td[data-qa^="view-tenant"]');
  console.log('Utility Pro: Found tenant cells:', tenantCells.length);

  tenantCells.forEach(cell => {
    const leaseLink = cell.querySelector('a[href*="/owners/leases/view/"]');
    if (!leaseLink) return;

    const href = leaseLink.getAttribute('href') || '';
    const linkLeaseId = href.split('/owners/leases/view/')[1];

    if (linkLeaseId === leaseId) {
      const nameEl = cell.querySelector('.V4HkO span');
      const name = nameEl?.textContent?.trim();

      if (name && !tenants.includes(name)) {
        tenants.push(name);
        console.log('Utility Pro: Added tenant:', name);
      }
    }
  });

  console.log('Utility Pro: Found tenants:', tenants);
  return tenants;
}

// Check if we need to scrape tenants (navigated here for that purpose)
async function checkForPendingTenantScrape() {
  const url = window.location.href;

  if (!url.includes('/owners/renters/tenants')) {
    return;
  }

  const result = await chrome.storage.local.get('utilityPro_pendingTenantScrape');
  const pending = result.utilityPro_pendingTenantScrape;

  if (!pending) {
    return;
  }

  console.log('Utility Pro: Found pending tenant scrape request:', pending);

  // Clear the pending request
  await chrome.storage.local.remove('utilityPro_pendingTenantScrape');

  // Scrape the tenants
  const tenants = await scrapeTenantsFromCurrentPage(pending.leaseId);

  // Store the result
  await chrome.storage.local.set({
    'utilityPro_tenantScrapeResult': {
      leaseId: pending.leaseId,
      tenants: tenants
    }
  });

  console.log('Utility Pro: Stored tenant scrape result, navigating to properties page');

  // Navigate to the properties page (next step in flow)
  window.location.href = 'https://rental.turbotenant.com/owners/properties';
}

// ==================== Property Finder (Step 5) ====================
// Find property on the properties list page (no navigation)
async function findPropertyOnPage(leaseId) {
  console.log('Utility Pro: findPropertyOnPage called for lease:', leaseId);

  // Wait for property tiles to load
  try {
    await waitForElement('[data-qa="manage-property-clickable-container"]', 10000);
  } catch (e) {
    return { found: false, error: 'Property tiles not loaded' };
  }

  const allTiles = document.querySelectorAll('[data-qa="manage-property-clickable-container"]');
  console.log('Utility Pro: Found property tiles:', allTiles.length);

  for (const tile of allTiles) {
    const leaseLink = tile.querySelector(`a[href*="/owners/leases/view/${leaseId}"]`);
    if (leaseLink) {
      // Found matching tile - extract property name
      const propertyNameEl = tile.querySelector('h3');
      const propertyName = propertyNameEl?.textContent?.trim() || 'Unknown Property';
      console.log('Utility Pro: Found matching property:', propertyName);
      return { found: true, propertyName: propertyName };
    }
  }

  return { found: false, error: 'No property found matching this lease' };
}

// Click the property tile to navigate to details page
async function clickPropertyTile(leaseId) {
  console.log('Utility Pro: clickPropertyTile called for lease:', leaseId);

  const allTiles = document.querySelectorAll('[data-qa="manage-property-clickable-container"]');

  for (const tile of allTiles) {
    const leaseLink = tile.querySelector(`a[href*="/owners/leases/view/${leaseId}"]`);
    if (leaseLink) {
      console.log('Utility Pro: Clicking property tile...');
      tile.click();
      return { clicked: true };
    }
  }

  return { clicked: false, error: 'No matching tile found to click' };
}

// ==================== Address Scraper (Step 6) ====================
// Check if we're on property details page and need to scrape address
async function checkForPendingAddressScrape() {
  const url = window.location.href;

  // Only run on property details pages
  if (!url.includes('/owners/properties/manage/')) {
    return;
  }

  console.log('Utility Pro: checkForPendingAddressScrape on:', url);

  const result = await chrome.storage.local.get('utilityPro_pendingAddressScrape');
  const pending = result.utilityPro_pendingAddressScrape;

  if (!pending) {
    console.log('Utility Pro: No pending address scrape');
    return;
  }

  console.log('Utility Pro: Found pending address scrape, extracting address...');

  // Clear the pending request
  await chrome.storage.local.remove('utilityPro_pendingAddressScrape');

  // Wait for address element to load
  try {
    await waitForElement('p.UN2EC', 5000);
  } catch (e) {
    console.log('Utility Pro: Address element p.UN2EC not found');
  }

  // Scrape the address
  const addressEl = document.querySelector('p.UN2EC');
  const address = addressEl?.textContent?.trim() || '';

  console.log('Utility Pro: Address element found:', !!addressEl);
  console.log('Utility Pro: Scraped address:', address);

  // Store the result
  await chrome.storage.local.set({
    'utilityPro_addressScrapeResult': {
      leaseId: pending.leaseId,
      address: address
    }
  });

  console.log('Utility Pro: Address scrape complete');
}

// ==================== Charge Form Automation ====================

// Check if we're on the charge creation page and have pending data
async function checkForPendingCharge() {
  const url = window.location.href;

  // Only run on charge creation pages
  if (!url.includes('/owners/payments/charges/create/')) {
    return;
  }

  console.log('Utility Pro: On charge creation page, checking for pending charge data...');

  // Get pending charge data from storage
  const result = await chrome.storage.local.get('utilityPro_pendingCharge');
  const chargeData = result.utilityPro_pendingCharge;

  if (!chargeData) {
    console.log('Utility Pro: No pending charge data found');
    return;
  }

  console.log('Utility Pro: Found pending charge data, starting form fill...');

  // Clear the pending data so we don't fill again on refresh
  await chrome.storage.local.remove('utilityPro_pendingCharge');

  // Wait for page to load
  await waitForElement(SELECTORS.chargeTypeOneTime, 10000);

  // Fill the form
  await fillChargeFormSteps(chargeData);
}

async function fillChargeFormSteps(data) {
  try {
    // Step 1: Select "One-Time Charge"
    console.log('Utility Pro: Step 1 - Selecting One-Time Charge...');

    const oneTimeRadio = document.querySelector(SELECTORS.chargeTypeOneTime);
    if (oneTimeRadio) {
      oneTimeRadio.click();
      await sleep(300);
    }

    // Click Next
    const nextBtn = document.querySelector(SELECTORS.chargeTypeNext);
    if (nextBtn) {
      nextBtn.click();
      await sleep(1000); // Wait for step 2 to load
    }

    // Step 2: Fill charge details
    console.log('Utility Pro: Step 2 - Filling charge details...');

    // Wait for the form to appear
    await waitForElement(SELECTORS.category, 5000);

    // Category - Utility Charge
    const categorySelect = document.querySelector(SELECTORS.category);
    if (categorySelect) {
      categorySelect.value = 'UTILITY_CHARGE';
      categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(200);
    }

    // Description
    const descInput = document.querySelector(SELECTORS.description);
    if (descInput) {
      descInput.value = data.description || 'Utility Bill';
      descInput.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(200);
    }

    // Amount
    const amountInput = document.querySelector(SELECTORS.amount);
    if (amountInput) {
      amountInput.value = data.amount || '0';
      amountInput.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(200);
    }

    // Due Date - set to 2 weeks from now
    const dueDateInput = document.querySelector(SELECTORS.dueDate);
    if (dueDateInput) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);
      const formattedDate = `${String(dueDate.getMonth() + 1).padStart(2, '0')}/${String(dueDate.getDate()).padStart(2, '0')}/${dueDate.getFullYear()}`;
      dueDateInput.value = formattedDate;
      dueDateInput.dispatchEvent(new Event('input', { bubbles: true }));
      dueDateInput.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(200);
    }

    // Bank Account - select first available (not empty, not "add new")
    const bankSelect = document.querySelector(SELECTORS.bankAccount);
    if (bankSelect) {
      const options = Array.from(bankSelect.options);
      const validOption = options.find(opt => opt.value && opt.value !== 'new-bank-account');
      if (validOption) {
        bankSelect.value = validOption.value;
        bankSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
      await sleep(200);
    }

    // File attachments
    console.log('Utility Pro: Attaching files...');
    await attachFiles(data);

    // Add highlight to bank account dropdown
    highlightBankAccountSelection();

    console.log('Utility Pro: Form filled! Please review and click "Create Charge" when ready.');

    // Show a notification to the user
    showNotification('Form filled by Utility Pro. Select your deposit account and click "Create Charge" when ready.');

  } catch (error) {
    console.error('Utility Pro: Error filling form:', error);
    showNotification('Error filling form. Please complete manually.');
  }
}

async function attachFiles(data) {
  const fileInput = document.querySelector(SELECTORS.fileInput);
  if (!fileInput) {
    console.log('Utility Pro: File input not found');
    return;
  }

  const files = [];

  // Create file objects from base64 data
  if (data.invoicePdf) {
    try {
      const invoiceBlob = base64ToBlob(data.invoicePdf, 'application/pdf');
      const invoiceFile = new File([invoiceBlob], 'utility-invoice.pdf', { type: 'application/pdf' });
      files.push(invoiceFile);
    } catch (e) {
      console.error('Utility Pro: Error creating invoice file:', e);
    }
  }

  if (data.billFile) {
    try {
      const billBlob = base64ToBlob(data.billFile, 'application/pdf');
      const billFile = new File([billBlob], 'utility-bill.pdf', { type: 'application/pdf' });
      files.push(billFile);
    } catch (e) {
      console.error('Utility Pro: Error creating bill file:', e);
    }
  }

  if (data.submeterFile) {
    try {
      const submeterBlob = new Blob([data.submeterFile], { type: 'text/csv' });
      const submeterFile = new File([submeterBlob], 'submeter-report.csv', { type: 'text/csv' });
      files.push(submeterFile);
    } catch (e) {
      console.error('Utility Pro: Error creating submeter file:', e);
    }
  }

  if (files.length === 0) {
    console.log('Utility Pro: No files to attach');
    return;
  }

  // Use DataTransfer to set files on the input
  try {
    const dataTransfer = new DataTransfer();
    files.forEach(file => dataTransfer.items.add(file));
    fileInput.files = dataTransfer.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    console.log('Utility Pro: Attached', files.length, 'files');
  } catch (e) {
    console.error('Utility Pro: Error attaching files:', e);
    showNotification('Could not attach files automatically. Please add them manually.');
  }
}

// ==================== Utility Functions ====================

function base64ToBlob(base64, mimeType) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

function highlightBankAccountSelection() {
  const bankSelect = document.querySelector(SELECTORS.bankAccount);
  if (!bankSelect) {
    console.log('Utility Pro: Bank account dropdown not found');
    return;
  }

  // Find the parent container (usually a form group or label wrapper)
  const parentContainer = bankSelect.closest('div') || bankSelect.parentElement;

  // Add a highlight border to the dropdown
  bankSelect.style.border = '2px solid #e53e3e';
  bankSelect.style.borderRadius = '6px';
  bankSelect.style.boxShadow = '0 0 0 3px rgba(229, 62, 62, 0.2)';

  // Create the reminder element
  const reminder = document.createElement('div');
  reminder.id = 'utility-pro-bank-reminder';
  reminder.style.cssText = `
    background: #fff5f5;
    border: 1px solid #fc8181;
    border-radius: 6px;
    padding: 10px 14px;
    margin-top: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    color: #c53030;
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  reminder.innerHTML = `
    <span style="font-size: 16px;">⚠️</span>
    <span><strong>Action Required:</strong> Select which bank account should receive this payment.</span>
  `;

  // Insert after the dropdown
  if (parentContainer) {
    parentContainer.appendChild(reminder);
  } else {
    bankSelect.insertAdjacentElement('afterend', reminder);
  }

  // Remove highlight when user selects an account
  bankSelect.addEventListener('change', function onSelect() {
    if (bankSelect.value && bankSelect.value !== '' && bankSelect.value !== 'new-bank-account') {
      // Valid selection made - remove highlight
      bankSelect.style.border = '';
      bankSelect.style.borderRadius = '';
      bankSelect.style.boxShadow = '';
      reminder.remove();
      bankSelect.removeEventListener('change', onSelect);
    }
  });
}

function showNotification(message) {
  // Create a simple notification banner
  const existing = document.getElementById('utility-pro-notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.id = 'utility-pro-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #2b5282;
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    z-index: 999999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    max-width: 400px;
  `;
  notification.textContent = message;

  document.body.appendChild(notification);

  // Auto-remove after 10 seconds
  setTimeout(() => notification.remove(), 10000);
}

// ==================== Initialize ====================

// Run on page load
console.log('Utility Pro: Content script loaded on', window.location.href);

// Check for pending operations when page loads
function runPendingChecks() {
  checkForPendingCharge();
  checkForPendingTenantScrape();
  checkForPendingAddressScrape();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runPendingChecks);
} else {
  runPendingChecks();
}

// TurboTenant is a SPA - detect URL changes and re-run checks
let lastUrl = window.location.href;
const urlObserver = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    console.log('Utility Pro: SPA navigation detected:', lastUrl, '->', window.location.href);
    lastUrl = window.location.href;
    // Small delay to let the new page content render
    setTimeout(runPendingChecks, 500);
  }
});

urlObserver.observe(document.body, { childList: true, subtree: true });
