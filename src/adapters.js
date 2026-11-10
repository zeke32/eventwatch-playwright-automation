/** Locators for fictional registration engines. No third-party selectors or firewall handling. */
export const adapters = Object.freeze({
  pacepass: {
    label: 'PacePass (fictional)',
    name: '[data-test="event-title"]', date: '[data-test="event-date"]', capacity: '[data-test="event-capacity"]',
    pricing: '[data-test="price-timeline"]', status: '[data-test="registration-status"]'
  },
  traildesk: {
    label: 'TrailDesk (fictional)',
    name: '.event-header h1', date: '.event-header .date', capacity: '.availability .summary',
    pricing: '.price-panel .next-date', status: '.event-badge'
  },
  startline: {
    label: 'StartLine (fictional)',
    name: '[data-field="race-name"]', date: '[data-field="race-date"]', capacity: '[data-field="spots"]',
    pricing: '[data-field="next-rate"]', status: '[data-field="status"]'
  }
});
