// Background service worker for Utility Pro
// Handles API calls and document processing

// Load libraries
importScripts('../lib/pdf-lib.min.js');
importScripts('../lib/config.js');
importScripts('../lib/llm-service.js');

// ==================== CSV Parser ====================
function parseSubmeterCSV(csvText, settings) {
  const lines = csvText.trim().split('\n');

  if (lines.length < 2) {
    throw new Error('CSV file appears to be empty');
  }

  const header = parseCSVLine(lines[0]);
  const { csvColumn1, csvColumn2 } = settings;

  if (!csvColumn1 || !csvColumn2) {
    throw new Error('CSV column names are not configured in settings.');
  }

  const col1Index = header.findIndex(col => col.toLowerCase().includes(csvColumn1.toLowerCase()));
  const col2Index = header.findIndex(col => col.toLowerCase().includes(csvColumn2.toLowerCase()));

  if (col1Index === -1 || col2Index === -1) {
    let missing = [];
    if (col1Index === -1) missing.push(csvColumn1);
    if (col2Index === -1) missing.push(csvColumn2);
    throw new Error(`Could not find columns including "${missing.join('" and "')}" in CSV`);
  }

  let totalKwh = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const col1Value = parseFloat(values[col1Index]) || 0;
    const col2Value = parseFloat(values[col2Index]) || 0;

    totalKwh += col1Value + col2Value;
  }

  return Math.round(totalKwh * 100) / 100;
}

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

// ==================== Storage ====================
const SETTINGS_KEY = 'utilityPro_settings';
const defaultSettings = {
  llmApiKey: '',
  landlordName: '',
  landlordAddress: '',
  landlordPhone: '',
  propertyAddress: '',
  csvColumn1: 'Mains_A',
  csvColumn2: 'Mains_B'
};

async function getSettings() {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...defaultSettings, ...result[SETTINGS_KEY] };
}

// ==================== PDF Extractor ====================
async function extractBillData(pdfBase64, apiKey) {
  return await extractBillDataWithLLM(pdfBase64, apiKey);
}

// ==================== Invoice Generator ====================
async function generateInvoicePdf(data, settings) {
  // Use pdf-lib loaded via importScripts
  const { PDFDocument, rgb, StandardFonts } = PDFLib;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();

  // Colors
  const primaryBlue = rgb(0.17, 0.32, 0.51);
  const darkText = rgb(0.1, 0.1, 0.18);
  const grayText = rgb(0.44, 0.5, 0.6);
  const lightBg = rgb(0.97, 0.98, 0.99);

  // Calculate values
  const mainKwh = data.totalKwh - data.aduKwh;
  const rate = data.totalAmount / data.totalKwh;
  const mainAmount = mainKwh * rate;
  const aduAmount = data.aduKwh * rate;

  let y = height - 50;

  // Header - Title
  page.drawText('Electrical Utility Invoice', {
    x: 50, y: y,
    size: 24, font: helveticaBold, color: darkText
  });

  // Badge
  const badgeX = width - 150;
  page.drawRectangle({
    x: badgeX, y: y - 5, width: 100, height: 25, color: primaryBlue
  });
  page.drawText('ELECTRICAL BILL', {
    x: badgeX + 8, y: y + 2, size: 8, font: helveticaBold, color: rgb(1, 1, 1)
  });

  y -= 25;

  // Billing period
  page.drawText(`For period: ${data.billingPeriod}`, {
    x: 50, y: y, size: 11, font: helvetica, color: grayText
  });

  // Landlord info (right side)
  const landlordX = width - 200;
  page.drawText(settings.landlordName || 'Landlord Name', {
    x: landlordX, y: y, size: 11, font: helveticaBold, color: darkText
  });

  y -= 15;
  page.drawText(settings.landlordAddress || '', {
    x: landlordX, y: y, size: 10, font: helvetica, color: grayText
  });

  y -= 12;
  page.drawText(settings.landlordPhone || '', {
    x: landlordX, y: y, size: 10, font: helvetica, color: grayText
  });

  // Horizontal line
  y -= 25;
  page.drawLine({
    start: { x: 50, y: y }, end: { x: width - 50, y: y },
    thickness: 1, color: rgb(0.9, 0.92, 0.95)
  });

  // Bill To section
  y -= 25;
  page.drawText('BILL TO:', {
    x: 50, y: y, size: 10, font: helveticaBold, color: grayText
  });

  // Tenant box
  y -= 20;
  const boxY = y - 40;
  page.drawRectangle({
    x: 50, y: boxY, width: width - 100, height: 50, color: lightBg
  });

  page.drawText(settings.tenantName || 'TENANT NAME', {
    x: 60, y: y - 10, size: 11, font: helveticaBold, color: darkText
  });

  page.drawText(settings.propertyAddress || 'Property Address', {
    x: 60, y: y - 25, size: 10, font: helvetica, color: grayText
  });

  // Usage Table
  y = boxY - 40;
  const tableX = 50;
  const colWidths = [250, 100, 100, 100];

  page.drawRectangle({
    x: tableX, y: y - 20, width: width - 100, height: 25, color: lightBg
  });

  const headers = ['DESCRIPTION', 'USAGE (KWH)', 'RATE', 'AMOUNT'];
  let colX = tableX + 10;
  headers.forEach((header, i) => {
    page.drawText(header, {
      x: colX, y: y - 12, size: 9, font: helveticaBold, color: grayText
    });
    colX += colWidths[i];
  });

  // Table rows
  y -= 45;

  // Row 1: Total Property Electric Usage
  drawTableRow(page, tableX, y, colWidths, [
    'Total Property Electric Usage',
    `${data.totalKwh.toFixed(0)} kWh`,
    '',
    `$${data.totalAmount.toFixed(2)}`
  ], helvetica, darkText);

  y -= 35;

  // Row 2: Less ADU Usage
  drawTableRow(page, tableX, y, colWidths, [
    'Less: ADU Usage (Submeter)',
    `(${data.aduKwh.toFixed(2)} kWh)`,
    `Effective Rate:`,
    `($${aduAmount.toFixed(2)})`
  ], helvetica, darkText);

  // Add rate below "Effective Rate:"
  page.drawText(`$${rate.toFixed(4)} / kWh`, {
    x: tableX + 10 + colWidths[0] + colWidths[1], y: y - 12,
    size: 10, font: helvetica, color: darkText
  });

  y -= 35;

  // Row 3: Main House Portion (highlighted)
  page.drawRectangle({
    x: tableX, y: y - 15, width: width - 100, height: 30, color: lightBg
  });

  drawTableRow(page, tableX, y, colWidths, [
    'Main House Portion (Your Usage)',
    `${mainKwh.toFixed(2)} kWh`,
    '',
    `$${mainAmount.toFixed(2)}`
  ], helveticaBold, darkText);

  // Horizontal line after table
  y -= 40;
  page.drawLine({
    start: { x: tableX, y: y }, end: { x: width - 50, y: y },
    thickness: 1, color: rgb(0.9, 0.92, 0.95)
  });

  // Subtotal and Total
  y -= 30;
  page.drawText('Subtotal:', {
    x: width - 200, y: y, size: 11, font: helvetica, color: grayText
  });
  page.drawText(`$${mainAmount.toFixed(2)}`, {
    x: width - 100, y: y, size: 11, font: helvetica, color: darkText
  });

  y -= 30;
  page.drawText('Total Due:', {
    x: width - 200, y: y, size: 16, font: helveticaBold, color: primaryBlue
  });
  page.drawText(`$${mainAmount.toFixed(2)}`, {
    x: width - 100, y: y, size: 16, font: helveticaBold, color: primaryBlue
  });

  // Footer - Payment Terms
  y -= 60;
  page.drawLine({
    start: { x: 50, y: y + 15 }, end: { x: width - 50, y: y + 15 },
    thickness: 1, color: rgb(0.9, 0.92, 0.95)
  });

  page.drawText('Payment Terms:', {
    x: 50, y: y, size: 10, font: helveticaBold, color: darkText
  });

  page.drawText(
    'This amount is deemed "Additional Rent" as per your Lease Addendum and is due with your next',
    { x: 130, y: y, size: 10, font: helvetica, color: grayText }
  );

  y -= 14;
  page.drawText(
    `regularly scheduled rent payment. Please make payment to ${settings.landlordName || 'Landlord'} via the usual method.`,
    { x: 50, y: y, size: 10, font: helvetica, color: grayText }
  );

  y -= 25;
  page.drawText('Calculation Method:', {
    x: 50, y: y, size: 10, font: helveticaBold, color: darkText
  });

  page.drawText(
    '(Total Bill Amount ÷ Total kWh Usage) × Main House kWh Usage as agreed upon in your lease.',
    { x: 155, y: y, size: 10, font: helvetica, color: grayText }
  );

  // Save and return base64
  const pdfBytes = await pdfDoc.save();
  return btoa(String.fromCharCode(...pdfBytes));
}

function drawTableRow(page, x, y, colWidths, values, font, color) {
  let colX = x + 10;
  values.forEach((value, i) => {
    page.drawText(value, {
      x: colX, y: y, size: 10, font: font, color: color
    });
    colX += colWidths[i];
  });
}

// ==================== Message Handler ====================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true;
});

async function handleMessage(message) {
  switch (message.type) {
    case 'PROCESS_DOCUMENTS':
      return await processDocuments(message.billFile, message.submeterFile);

    case 'PARSE_CSV_ONLY':
      return await parseCsvOnly(message.submeterFile);

    case 'GENERATE_INVOICE':
      return await generateInvoice(message.data, message.settings);

    default:
      return { error: 'Unknown message type' };
  }
}

async function parseCsvOnly(csvText) {
  try {
    const settings = await getSettings();
    const aduKwh = parseSubmeterCSV(csvText, settings);
    return { aduKwh };
  } catch (error) {
    console.error('Error parsing CSV:', error);
    return { error: error.message, aduKwh: 0 };
  }
}

async function processDocuments(billFileBase64, submeterFileText) {
  try {
    const settings = await getSettings();
    const aduKwh = parseSubmeterCSV(submeterFileText, settings);
    const billData = await extractBillData(billFileBase64, settings.llmApiKey);

    return {
      data: {
        billingPeriod: billData.billingPeriod,
        totalAmount: billData.totalAmount,
        totalKwh: billData.totalKwh,
        aduKwh: aduKwh
      }
    };
  } catch (error) {
    console.error('Error processing documents:', error);
    return { error: error.message || 'Failed to process documents' };
  }
}

async function generateInvoice(data, settings) {
  try {
    const pdfBase64 = await generateInvoicePdf(data, settings);
    return { pdfBase64 };
  } catch (error) {
    console.error('Error generating invoice:', error);
    return { error: error.message || 'Failed to generate invoice' };
  }
}

console.log('Utility Pro service worker loaded');
