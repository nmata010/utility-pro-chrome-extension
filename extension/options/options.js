// Utility Pro Options Page

// Storage helpers
const SETTINGS_KEY = 'utilityPro_settings';

async function getSettings() {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return result[SETTINGS_KEY] || {};
}

async function saveSettings(settings) {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

// DOM Elements - initialized after DOM loads
let form, saveStatus, inputs;

// Load existing settings
async function loadSettings() {
  const settings = await getSettings();

  inputs.llmApiKey.value = settings.llmApiKey || '';
  inputs.landlordName.value = settings.landlordName || '';
  inputs.landlordAddress.value = settings.landlordAddress || '';
  inputs.landlordPhone.value = settings.landlordPhone || '';
  inputs.csvColumn1.value = settings.csvColumn1 || 'Mains_A';
  inputs.csvColumn2.value = settings.csvColumn2 || 'Mains_B';
}

// Save settings
async function handleSave(e) {
  e.preventDefault();

  const settings = {
    llmApiKey: inputs.llmApiKey.value,
    landlordName: inputs.landlordName.value,
    landlordAddress: inputs.landlordAddress.value,
    landlordPhone: inputs.landlordPhone.value,
    csvColumn1: inputs.csvColumn1.value,
    csvColumn2: inputs.csvColumn2.value
  };

  try {
    await saveSettings(settings);
    showStatus('Settings saved!', false);
  } catch (error) {
    showStatus('Failed to save settings', true);
    console.error(error);
  }
}

function showStatus(message, isError = false) {
  saveStatus.textContent = message;
  saveStatus.className = 'save-status' + (isError ? ' error' : '');

  setTimeout(() => {
    saveStatus.textContent = '';
  }, 3000);
}

// Initialize after DOM loads
document.addEventListener('DOMContentLoaded', () => {
  // Get DOM elements AFTER DOM is ready
  form = document.getElementById('settings-form');
  saveStatus = document.getElementById('save-status');

  inputs = {
    llmApiKey: document.getElementById('llm-api-key'),
    landlordName: document.getElementById('landlord-name'),
    landlordAddress: document.getElementById('landlord-address'),
    landlordPhone: document.getElementById('landlord-phone'),
    csvColumn1: document.getElementById('csv-column-1'),
    csvColumn2: document.getElementById('csv-column-2')
  };

  loadSettings();
  form.addEventListener('submit', handleSave);
});
