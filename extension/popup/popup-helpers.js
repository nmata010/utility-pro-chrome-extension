// Popup helper functions - extracted for testability

/**
 * Determines the appropriate lease panel state based on tab info.
 * @param {Object} tab - Chrome tab object with url and status properties
 * @returns {'navigate' | 'loading' | 'ready'} The state to show
 */
function determineLeaseState(tab) {
  if (!tab || !tab.url) {
    return 'navigate';
  }

  const isLeasesPage = isLeasesPageUrl(tab.url);

  if (!isLeasesPage) {
    return 'navigate';
  }

  // On leases page - check if still loading
  if (tab.status !== 'complete') {
    return 'loading';
  }

  return 'ready';
}

/**
 * Checks if a URL is the TurboTenant leases list page.
 * @param {string} url - The URL to check
 * @returns {boolean} True if this is the leases list page
 */
function isLeasesPageUrl(url) {
  if (!url) return false;

  // Must be on the leases page, but NOT viewing a specific lease
  return url.includes('rental.turbotenant.com/owners/leases') &&
         !url.includes('/leases/view/');
}

// Export for testing (in Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { determineLeaseState, isLeasesPageUrl };
}
