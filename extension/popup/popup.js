// Utility Pro Popup Script - Revised Workflow

// State
let state = {
  selectedLease: null,    // { id, displayName, ... }
  billFile: null,
  submeterFile: null,
  extractedData: null,
  calculatedData: null,
  invoicePdf: null,
  tenantNames: null,      // fetched from TurboTenant
  propertyName: null,     // found on properties list
  propertyAddress: null   // fetched from property details
};

// DOM Elements - populated after DOM loads
let elements = {};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  populateElements();
  setupEventListeners();

  const settings = await getSettings();

  // Only require landlord name to proceed
  if (!settings.landlordName) {
    showPanel('settings-prompt');
    return;
  }

  // Check if there's an active billing flow in progress
  const { utilityPro_activeFlow } = await chrome.storage.local.get('utilityPro_activeFlow');

  if (utilityPro_activeFlow) {
    // There's an active flow - check if we're on the leases page
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url?.includes('rental.turbotenant.com/owners/leases') &&
          !tab?.url?.includes('/leases/view/')) {
        // On leases page with active flow - show lease selection
        showPanel('lease');
        checkCurrentPage();
        return;
      }
    } catch (e) {
      console.log('Could not check current tab:', e);
    }
  }

  // No active flow or not on leases page - show home/tiles
  showPanel('home');
});

function populateElements() {
  elements = {
    // Panels
    panelHome: document.getElementById('panel-home'),
    panelLease: document.getElementById('panel-lease'),
    panelUpload: document.getElementById('panel-upload'),
    panelReview: document.getElementById('panel-review'),
    panelCharge: document.getElementById('panel-charge'),
    panelSettingsPrompt: document.getElementById('panel-settings-prompt'),

    // Steps indicator
    stepsIndicator: document.getElementById('steps-indicator'),

    // Utility tiles
    tileElectric: document.getElementById('tile-electric'),
    tileWater: document.getElementById('tile-water'),

    // Lease states
    leaseStateNavigate: document.getElementById('lease-state-navigate'),
    leaseStateReady: document.getElementById('lease-state-ready'),

    // Dropzones
    dropzoneBill: document.getElementById('dropzone-bill'),
    dropzoneSubmeter: document.getElementById('dropzone-submeter'),
    fileBill: document.getElementById('file-bill'),
    fileSubmeter: document.getElementById('file-submeter'),

    // Buttons
    btnGoLeases: document.getElementById('btn-go-leases'),
    btnBackHome: document.getElementById('btn-back-home'),
    btnBackHomeNav: document.getElementById('btn-back-home-nav'),
    btnLeaseNext: document.getElementById('btn-lease-next'),
    btnBackLease: document.getElementById('btn-back-lease'),
    btnProcess: document.getElementById('btn-process'),
    btnManualEntry: document.getElementById('btn-manual-entry'),
    btnBackUpload: document.getElementById('btn-back-upload'),
    btnGenerate: document.getElementById('btn-generate'),
    btnBackReview: document.getElementById('btn-back-review'),

    // Progress elements
    generateProgress: document.getElementById('generate-progress'),
    progressTenants: document.getElementById('progress-tenants'),
    progressProperty: document.getElementById('progress-property'),
    progressAddress: document.getElementById('progress-address'),
    progressInvoice: document.getElementById('progress-invoice'),
    btnDownload: document.getElementById('btn-download'),
    btnCreateCharge: document.getElementById('btn-create-charge'),
    btnBackInvoice: document.getElementById('btn-back-invoice'),
    btnFillCharge: document.getElementById('btn-fill-charge'),
    btnStartOver: document.getElementById('btn-start-over'),
    btnSettings: document.getElementById('btn-settings'),
    btnOpenSettings: document.getElementById('btn-open-settings'),

    // Lease selection
    leaseSelect: document.getElementById('lease-select'),
    selectedLeaseName: document.getElementById('selected-lease-name'),

    // Data inputs
    dataPeriodStart: document.getElementById('data-period-start'),
    dataPeriodEnd: document.getElementById('data-period-end'),
    dataTotalAmount: document.getElementById('data-total-amount'),
    dataTotalKwh: document.getElementById('data-total-kwh'),
    dataAduKwh: document.getElementById('data-adu-kwh'),

    // Charge panel elements
    chargeTenantName: document.getElementById('charge-tenant-name'),
    chargePropertyAddress: document.getElementById('charge-property-address'),
    invoiceStatus: document.getElementById('invoice-status'),

    // Calculated displays
    calcModeToggle: document.getElementById('calc-mode-toggle'),
    calcUsageLabel: document.getElementById('calc-usage-label'),
    calcAmountLabel: document.getElementById('calc-amount-label'),
    calcMainKwh: document.getElementById('calc-main-kwh'),
    calcRate: document.getElementById('calc-rate'),
    calcMainAmount: document.getElementById('calc-main-amount'),

    // Charge summary
    chargeAmount: document.getElementById('charge-amount'),
    chargeDescription: document.getElementById('charge-description'),
    chargeAttachments: document.getElementById('charge-attachments'),

    // Other
    invoicePreview: document.getElementById('invoice-preview'),
    steps: document.querySelectorAll('.step')
  };
}

// Storage helpers
const SETTINGS_KEY = 'utilityPro_settings';
const defaultSettings = {
  landlordName: '',
  landlordAddress: '',
  landlordPhone: ''
};

async function getSettings() {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...defaultSettings, ...result[SETTINGS_KEY] };
}

// Reset state to start fresh
function resetState() {
  state = {
    selectedLease: null,
    billFile: null,
    submeterFile: null,
    extractedData: null,
    calculatedData: null,
    invoicePdf: null,
    tenantNames: null,
    propertyName: null,
    propertyAddress: null
  };
}

// Panel navigation
function showPanel(panelName) {
  // Hide all panels
  elements.panelHome?.classList.add('hidden');
  elements.panelLease?.classList.add('hidden');
  elements.panelUpload?.classList.add('hidden');
  elements.panelReview?.classList.add('hidden');
  elements.panelCharge?.classList.add('hidden');
  elements.panelSettingsPrompt?.classList.add('hidden');

  // Show requested panel
  const panel = document.getElementById(`panel-${panelName}`);
  if (panel) {
    panel.classList.remove('hidden');
  }

  // Show/hide step indicator (hide on home panel)
  if (panelName === 'home' || panelName === 'settings-prompt') {
    elements.stepsIndicator?.classList.add('hidden');
  } else {
    elements.stepsIndicator?.classList.remove('hidden');
  }

  // Show/hide Start Over button (show when in a flow, hide on home)
  if (elements.btnStartOver) {
    elements.btnStartOver.style.display = (panelName === 'home' || panelName === 'settings-prompt') ? 'none' : 'inline';
  }

  // Update step indicator
  const stepMap = { 'lease': 1, 'upload': 2, 'review': 3, 'charge': 4 };
  const currentStep = stepMap[panelName] || 0;

  elements.steps.forEach(step => {
    const stepNum = parseInt(step.dataset.step);
    step.classList.remove('active', 'completed');
    if (stepNum < currentStep) {
      step.classList.add('completed');
    } else if (stepNum === currentStep) {
      step.classList.add('active');
    }
  });
}

// Check current page and update lease panel state
async function checkCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const state = determineLeaseState(tab);

    switch (state) {
      case 'loading':
        waitForPageAndRecheck(tab.id);
        break;
      case 'ready':
        showLeaseState('ready');
        loadLeases();
        break;
      case 'navigate':
      default:
        showLeaseState('navigate');
        break;
    }

  } catch (error) {
    console.error('Error checking page:', error);
    showLeaseState('navigate');
  }
}

function showLeaseState(stateName) {
  elements.leaseStateNavigate.classList.add('hidden');
  elements.leaseStateReady.classList.add('hidden');

  if (stateName === 'navigate') {
    elements.leaseStateNavigate.classList.remove('hidden');
  } else if (stateName === 'ready') {
    elements.leaseStateReady.classList.remove('hidden');
  }
}

// Wait for tab to finish loading, then recheck the page state
function waitForPageAndRecheck(tabId) {
  // Show loading state
  elements.leaseStateNavigate.classList.add('hidden');
  elements.leaseStateReady.classList.add('hidden');

  // Remove any existing loading message
  const existingMsg = document.getElementById('loading-msg');
  if (existingMsg) existingMsg.remove();

  // Temporarily show a loading message
  const loadingMsg = document.createElement('p');
  loadingMsg.className = 'hint';
  loadingMsg.id = 'loading-msg';
  loadingMsg.textContent = 'Waiting for page to load...';
  elements.panelLease.appendChild(loadingMsg);

  // Listen for tab update
  function onTabUpdated(updatedTabId, changeInfo) {
    if (updatedTabId === tabId && changeInfo.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(onTabUpdated);

      // Remove loading message
      const msg = document.getElementById('loading-msg');
      if (msg) msg.remove();

      // Small delay for content script to initialize
      setTimeout(() => {
        checkCurrentPage();
      }, 500);
    }
  }

  chrome.tabs.onUpdated.addListener(onTabUpdated);

  // Timeout fallback
  setTimeout(() => {
    chrome.tabs.onUpdated.removeListener(onTabUpdated);
    const msg = document.getElementById('loading-msg');
    if (msg) msg.remove();
    checkCurrentPage();
  }, 10000);
}

// Load leases from TurboTenant page (DOM scraping)
async function loadLeases() {
  try {
    elements.leaseSelect.innerHTML = '<option value="">Loading leases...</option>';

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_LEASES' });

    if (response.error) {
      elements.leaseSelect.innerHTML = `<option value="">${response.error}</option>`;
      return;
    }

    if (response.leases && response.leases.length > 0) {
      elements.leaseSelect.innerHTML = '<option value="">Select a lease...</option>' +
        response.leases.map(lease =>
          `<option value="${lease.id}" data-name="${lease.displayName || lease.tenantName}">${lease.displayName || lease.tenantName}</option>`
        ).join('');
    } else {
      elements.leaseSelect.innerHTML = '<option value="">No active leases found</option>';
    }
  } catch (error) {
    elements.leaseSelect.innerHTML = '<option value="">Could not load leases - refresh the page</option>';
    console.error('Load leases error:', error);
  }
}

// Dropzone setup
function setupDropzones() {
  setupDropzone(elements.dropzoneBill, elements.fileBill, 'bill');
  setupDropzone(elements.dropzoneSubmeter, elements.fileSubmeter, 'submeter');
}

function setupDropzone(dropzone, fileInput, type) {
  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0], type);
    }
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0], type);
    }
  });
}

function handleFileSelect(file, type) {
  const dropzone = type === 'bill' ? elements.dropzoneBill : elements.dropzoneSubmeter;
  const textSpan = dropzone.querySelector('.dropzone-text span');

  if (type === 'bill') {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showError('Please select a PDF file for the utility bill.');
      return;
    }
    state.billFile = file;
  } else {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      showError('Please select a CSV file for the submeter report.');
      return;
    }
    state.submeterFile = file;
  }

  dropzone.classList.add('has-file');
  textSpan.textContent = file.name;

  updateButtonStates();
}

function updateButtonStates() {
  const canProcessWithAI = state.billFile && state.submeterFile;
  elements.btnProcess.disabled = !canProcessWithAI;
}

// Event listeners
function setupEventListeners() {
  // Utility type tiles
  elements.tileElectric?.addEventListener('click', async () => {
    // Store that we've started an electric billing flow
    await chrome.storage.local.set({ 'utilityPro_activeFlow': 'electric' });

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Check if already on the leases page
    const isOnLeasesPage = tab?.url?.includes('rental.turbotenant.com/owners/leases') &&
                           !tab?.url?.includes('/leases/view/');

    if (isOnLeasesPage) {
      // Already on leases page - just show lease panel
      showPanel('lease');
      checkCurrentPage();
    } else {
      // Navigate to leases page
      await chrome.tabs.update(tab.id, {
        url: 'https://rental.turbotenant.com/owners/leases'
      });
      showPanel('lease');
      waitForPageAndRecheck(tab.id);
    }
  });

  // Water tile does nothing (coming soon)
  elements.tileWater?.addEventListener('click', (e) => {
    e.preventDefault();
    // Do nothing - tile is disabled
  });

  // Lease selection - navigate to leases page
  elements.btnGoLeases?.addEventListener('click', async () => {
    // Show loading state
    elements.btnGoLeases.disabled = true;
    elements.btnGoLeases.textContent = 'Opening...';

    // Navigate current tab to leases page
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.update(tab.id, {
      url: 'https://rental.turbotenant.com/owners/leases'
    });

    // Set up listener to wait for page load, then refresh popup state
    waitForPageAndRecheck(tab.id);
  });

  elements.leaseSelect?.addEventListener('change', () => {
    const selectedOption = elements.leaseSelect.selectedOptions[0];
    if (selectedOption && selectedOption.value) {
      state.selectedLease = {
        id: selectedOption.value,
        displayName: selectedOption.dataset.name || selectedOption.textContent
      };
      elements.btnLeaseNext.disabled = false;
    } else {
      state.selectedLease = null;
      elements.btnLeaseNext.disabled = true;
    }
  });

  elements.btnBackHome?.addEventListener('click', async () => {
    await chrome.storage.local.remove('utilityPro_activeFlow');
    showPanel('home');
  });

  elements.btnBackHomeNav?.addEventListener('click', async () => {
    await chrome.storage.local.remove('utilityPro_activeFlow');
    showPanel('home');
  });

  elements.btnLeaseNext?.addEventListener('click', () => {
    if (state.selectedLease) {
      elements.selectedLeaseName.textContent = state.selectedLease.displayName;
      setupDropzones();
      showPanel('upload');
    }
  });

  // Upload navigation
  elements.btnBackLease?.addEventListener('click', () => {
    showPanel('lease');
    checkCurrentPage();
  });

  // Process documents
  elements.btnProcess?.addEventListener('click', processDocuments);
  elements.btnManualEntry?.addEventListener('click', manualEntry);

  // Review navigation
  elements.btnBackUpload?.addEventListener('click', () => showPanel('upload'));
  elements.btnGenerate?.addEventListener('click', runFullGeneration);

  // Charge navigation
  elements.btnBackReview?.addEventListener('click', () => showPanel('review'));
  elements.btnDownload?.addEventListener('click', downloadInvoice);
  elements.btnCreateCharge?.addEventListener('click', () => {
    updateChargeSummary();
    showPanel('charge');
  });

  // Charge navigation
  elements.btnBackInvoice?.addEventListener('click', () => showPanel('invoice'));
  elements.btnFillCharge?.addEventListener('click', fillChargeForm);

  // Settings
  elements.btnSettings?.addEventListener('click', openSettings);
  elements.btnOpenSettings?.addEventListener('click', openSettings);

  // Start Over
  elements.btnStartOver?.addEventListener('click', async () => {
    await chrome.storage.local.remove('utilityPro_activeFlow');
    resetState();
    showPanel('home');
  });

  // Recalculate on data change
  elements.dataPeriodStart?.addEventListener('change', recalculate);
  elements.dataPeriodEnd?.addEventListener('change', recalculate);
  elements.dataTotalAmount?.addEventListener('input', recalculate);
  elements.dataTotalKwh?.addEventListener('input', recalculate);
  elements.dataAduKwh?.addEventListener('input', recalculate);
  elements.calcModeToggle?.addEventListener('change', recalculate);
}

// Manual entry
async function manualEntry() {
  let aduKwh = ''; // Default to empty string

  if (state.submeterFile) {
    try {
      const csvText = await readFileAsText(state.submeterFile);
      const response = await chrome.runtime.sendMessage({
        type: 'PARSE_CSV_ONLY',
        submeterFile: csvText
      });

      // Check if the response has the aduKwh property and it's a number
      if (response && typeof response.aduKwh === 'number') {
        aduKwh = response.aduKwh;
      } else if (response && response.error) {
        console.log('Could not parse CSV:', response.error);
      }
    } catch (error) {
      console.log('Error sending message to parse CSV:', error);
    }
  }

  populateReviewPanel({
    billingPeriod: '',
    totalAmount: '',
    totalKwh: '',
    aduKwh: aduKwh
  });

  showPanel('review');
}

// Process documents with AI
async function processDocuments() {
  elements.btnProcess.disabled = true;
  elements.btnProcess.textContent = 'Processing...';
  elements.btnProcess.classList.add('loading');

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'PROCESS_DOCUMENTS',
      billFile: await fileToBase64(state.billFile),
      submeterFile: await readFileAsText(state.submeterFile)
    });

    if (response.error) {
      showError(response.error);
      return;
    }

    state.extractedData = response.data;
    populateReviewPanel(response.data);
    showPanel('review');

  } catch (error) {
    showError('Something went wrong while processing. Please try again.');
    console.error(error);
  } finally {
    elements.btnProcess.disabled = false;
    elements.btnProcess.textContent = 'Process with AI';
    elements.btnProcess.classList.remove('loading');
    updateButtonStates();
  }
}

function populateReviewPanel(data) {
  if (data.billingPeriod) {
    const dates = parseBillingPeriod(data.billingPeriod);
    if (dates) {
      elements.dataPeriodStart.value = dates.start;
      elements.dataPeriodEnd.value = dates.end;
    }
  } else {
    elements.dataPeriodStart.value = '';
    elements.dataPeriodEnd.value = '';
  }

  elements.dataTotalAmount.value = data.totalAmount || '';
  elements.dataTotalKwh.value = data.totalKwh || '';
  elements.dataAduKwh.value = data.aduKwh || '';
  recalculate();
}

function parseBillingPeriod(periodStr) {
  if (!periodStr) return null;

  const parts = periodStr.split(/\s*[-–—to]\s*/i);
  if (parts.length !== 2) return null;

  const startDate = parseFlexibleDate(parts[0].trim());
  const endDate = parseFlexibleDate(parts[1].trim());

  if (startDate && endDate) {
    return { start: startDate, end: endDate };
  }
  return null;
}

function parseFlexibleDate(dateStr) {
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  return null;
}

function recalculate() {
  const totalAmount = parseFloat(elements.dataTotalAmount.value) || 0;
  const totalKwh = parseFloat(elements.dataTotalKwh.value) || 0;
  const aduKwh = parseFloat(elements.dataAduKwh.value) || 0;
  const billSubmeterOnly = elements.calcModeToggle?.checked || false;

  const rate = totalKwh > 0 ? totalAmount / totalKwh : 0;

  let billedKwh, billedAmount;
  if (billSubmeterOnly) {
    // Bill for submeter/ADU usage only
    billedKwh = aduKwh;
    billedAmount = aduKwh * rate;
    elements.calcUsageLabel.textContent = 'ADU Usage:';
    elements.calcAmountLabel.textContent = 'ADU Owes:';
  } else {
    // Bill for main house (total - submeter)
    billedKwh = totalKwh - aduKwh;
    billedAmount = billedKwh * rate;
    elements.calcUsageLabel.textContent = 'Main House Usage:';
    elements.calcAmountLabel.textContent = 'Main House Owes:';
  }

  const billingPeriod = formatBillingPeriod(
    elements.dataPeriodStart.value,
    elements.dataPeriodEnd.value
  );

  state.calculatedData = {
    billedKwh,
    rate,
    mainAmount: billedAmount,
    totalAmount,
    totalKwh,
    aduKwh,
    billingPeriod,
    billSubmeterOnly
  };

  elements.calcMainKwh.textContent = `${billedKwh.toFixed(2)} kWh`;
  elements.calcRate.textContent = `$${rate.toFixed(4)}/kWh`;
  elements.calcMainAmount.textContent = `$${billedAmount.toFixed(2)}`;
}

function formatBillingPeriod(startStr, endStr) {
  if (!startStr || !endStr) return '';

  const options = { month: 'short', day: 'numeric', year: 'numeric' };
  const start = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '';

  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
}

// Run full generation: fetch tenants → find property → fetch address → generate invoice
async function runFullGeneration() {
  elements.btnGenerate.disabled = true;
  elements.btnGenerate.textContent = 'Processing...';
  elements.generateProgress.classList.remove('hidden');

  // Reset progress indicators
  elements.progressTenants.textContent = '⏳ Fetching tenants...';
  elements.progressProperty.textContent = '⏳ Finding property...';
  elements.progressAddress.textContent = '⏳ Fetching address...';
  elements.progressInvoice.textContent = '⏳ Generating invoice...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Step 1: Fetch tenant names
    console.log('Step 1: Fetching tenants...');
    await chrome.tabs.sendMessage(tab.id, {
      type: 'START_TENANT_SCRAPE',
      leaseId: state.selectedLease.id
    });

    await chrome.tabs.update(tab.id, {
      url: 'https://rental.turbotenant.com/owners/renters/tenants'
    });

    const tenants = await waitForTenantScrapeResult(state.selectedLease.id);
    if (tenants && tenants.length > 0) {
      state.tenantNames = tenants.join(', ');
      elements.progressTenants.textContent = `✓ ${state.tenantNames}`;
    } else {
      state.tenantNames = state.selectedLease?.displayName || 'Tenant';
      elements.progressTenants.textContent = `✓ ${state.tenantNames} (fallback)`;
    }
    console.log('Tenants:', state.tenantNames);

    // Step 2: Find property (we should now be on properties page)
    console.log('Step 2: Finding property...');
    // Small delay to ensure we're on properties page
    await new Promise(resolve => setTimeout(resolve, 1000));

    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const findResult = await chrome.tabs.sendMessage(currentTab.id, {
      type: 'FIND_PROPERTY',
      leaseId: state.selectedLease.id
    });

    if (findResult.found) {
      state.propertyName = findResult.propertyName;
      elements.progressProperty.textContent = `✓ ${state.propertyName}`;
    } else {
      elements.progressProperty.textContent = '⚠ Property not found';
    }
    console.log('Property:', state.propertyName);

    // Step 3: Fetch address (click tile to navigate to details)
    console.log('Step 3: Fetching address...');
    await chrome.tabs.sendMessage(currentTab.id, {
      type: 'START_ADDRESS_SCRAPE',
      leaseId: state.selectedLease.id
    });

    const address = await waitForAddressScrapeResult(state.selectedLease.id);
    if (address) {
      state.propertyAddress = address;
      elements.progressAddress.textContent = `✓ ${state.propertyAddress}`;
    } else {
      elements.progressAddress.textContent = '⚠ Address not found';
    }
    console.log('Address:', state.propertyAddress);

    // Step 4: Generate invoice
    console.log('Step 4: Generating invoice...');
    const settings = await getSettings();

    const invoiceSettings = {
      ...settings,
      tenantName: state.tenantNames || state.selectedLease?.displayName || 'Tenant',
      propertyAddress: state.propertyAddress || ''
    };

    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_INVOICE',
      data: state.calculatedData,
      settings: invoiceSettings
    });

    if (response.error) {
      elements.progressInvoice.textContent = '✗ ' + response.error;
      showError(response.error);
      return;
    }

    state.invoicePdf = response.pdfBase64;
    elements.progressInvoice.textContent = '✓ Invoice generated';
    console.log('Invoice generated successfully');

    // Update charge panel with fetched data
    updateChargeSummary();
    elements.chargeTenantName.textContent = state.tenantNames || 'N/A';
    elements.chargePropertyAddress.textContent = state.propertyAddress || 'N/A';

    // Navigate to charge panel
    showPanel('charge');

  } catch (error) {
    showError('Failed to generate invoice. Please try again.');
    console.error(error);
  } finally {
    elements.btnGenerate.disabled = false;
    elements.btnGenerate.textContent = 'Generate Invoice';
    elements.generateProgress.classList.add('hidden');
  }
}

// Download invoice
function downloadInvoice() {
  if (!state.invoicePdf) return;

  const link = document.createElement('a');
  link.href = `data:application/pdf;base64,${state.invoicePdf}`;
  const period = state.calculatedData.billingPeriod || 'invoice';
  link.download = `utility-invoice-${period.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
  link.click();
}

// Update charge summary before showing charge panel
function updateChargeSummary() {
  elements.chargeAmount.textContent = `$${state.calculatedData?.mainAmount?.toFixed(2) || '--'}`;
  elements.chargeDescription.textContent = `Utility Bill - ${state.calculatedData?.billingPeriod || 'Current Period'}`;

  const attachmentCount = [state.invoicePdf, state.billFile, state.submeterFile].filter(Boolean).length;
  elements.chargeAttachments.textContent = `${attachmentCount} file${attachmentCount !== 1 ? 's' : ''}`;
}

// Fill charge form - navigate to charge page and fill it
async function fillChargeForm() {
  if (!state.selectedLease?.id) {
    showError('No lease selected.');
    return;
  }

  // Clear the active flow - billing is complete
  await chrome.storage.local.remove('utilityPro_activeFlow');

  elements.btnFillCharge.disabled = true;
  elements.btnFillCharge.textContent = 'Opening...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Navigate to the charge creation page
    const chargeUrl = `https://rental.turbotenant.com/owners/payments/charges/create/${state.selectedLease.id}`;
    await chrome.tabs.update(tab.id, { url: chargeUrl });

    // Store the charge data for the content script to use
    const chargeData = {
      amount: state.calculatedData.mainAmount.toFixed(2),
      description: `Utility Bill - ${state.calculatedData.billingPeriod}`.substring(0, 50),
      billingPeriod: state.calculatedData.billingPeriod,
      invoicePdf: state.invoicePdf,
      billFile: state.billFile ? await fileToBase64(state.billFile) : null,
      submeterFile: state.submeterFile ? await readFileAsText(state.submeterFile) : null
    };

    // Save charge data to storage for content script to retrieve
    await chrome.storage.local.set({ 'utilityPro_pendingCharge': chargeData });

    // Close popup - content script will handle the form filling
    window.close();

  } catch (error) {
    showError('Could not open charge form. Please try again.');
    console.error(error);
    elements.btnFillCharge.disabled = false;
    elements.btnFillCharge.textContent = 'Open & Fill Charge Form';
  }
}

// Utility functions
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function waitForTenantScrapeResult(leaseId, timeout = 15000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await chrome.storage.local.get('utilityPro_tenantScrapeResult');
    const scrapeResult = result.utilityPro_tenantScrapeResult;

    if (scrapeResult && scrapeResult.leaseId === leaseId) {
      // Clear the result
      await chrome.storage.local.remove('utilityPro_tenantScrapeResult');
      console.log('Got tenant scrape result:', scrapeResult.tenants);
      return scrapeResult.tenants;
    }

    // Wait a bit before checking again
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log('Timeout waiting for tenant scrape result');
  return [];
}

async function waitForAddressScrapeResult(leaseId, timeout = 20000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await chrome.storage.local.get('utilityPro_addressScrapeResult');
    const scrapeResult = result.utilityPro_addressScrapeResult;

    if (scrapeResult && scrapeResult.leaseId === leaseId) {
      // Clear the result
      await chrome.storage.local.remove('utilityPro_addressScrapeResult');
      console.log('Got address scrape result:', scrapeResult.address);
      return scrapeResult.address;
    }

    // Wait a bit before checking again
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log('Timeout waiting for address scrape result');
  return '';
}

function openSettings() {
  chrome.runtime.openOptionsPage();
}

function showError(message) {
  const existing = document.querySelector('.error-message');
  if (existing) existing.remove();

  const error = document.createElement('div');
  error.className = 'error-message';
  error.textContent = message;

  const content = document.querySelector('.content');
  content.insertBefore(error, content.firstChild);

  setTimeout(() => error.remove(), 5000);
}

function showSuccess(message) {
  const existing = document.querySelector('.success-message');
  if (existing) existing.remove();

  const success = document.createElement('div');
  success.className = 'success-message';
  success.textContent = message;

  const content = document.querySelector('.content');
  content.insertBefore(success, content.firstChild);

  setTimeout(() => success.remove(), 5000);
}
