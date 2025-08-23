// src/utils/formatDate.js
export function formatDate(isoString, timezone = 'America/Los_Angeles') {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      timeZone: timezone,
      hour12: false
    });
  }
  