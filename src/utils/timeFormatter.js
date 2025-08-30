import { formatInTimeZone } from 'date-fns-tz';

export const formatBlockTime = (timestamp, timezone = 'UTC', format = 'full') => {
  if (timestamp === null || timestamp === undefined || timestamp === '') return '-';
  
  let ms;
  
  if (timestamp instanceof Date) {
    ms = timestamp.getTime();
  } 

  else if (typeof timestamp === 'number') {
    if (!isFinite(timestamp) || timestamp <= 0) {
      console.warn('Invalid timestamp number:', timestamp);
      return '-';
    }
    ms = timestamp > 1e10 ? timestamp : timestamp * 1000;
  } 

  else if (typeof timestamp === 'string') {
    const trimmed = timestamp.trim();
    
    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      if (!isFinite(num) || num <= 0) {
        console.warn('Invalid numeric string:', timestamp);
        return '-';
      }
      ms = num > 1e10 ? num : num * 1000;
    } 

    else {
      const parsed = Date.parse(trimmed);
      if (!isFinite(parsed)) {
        console.warn('Invalid date string:', timestamp);
        return '-';
      }
      ms = parsed;
    }
  } 
  else {
    console.warn('Unknown timestamp type:', typeof timestamp, timestamp);
    return '-';
  }
  
  const formats = {
    full: 'yyyy-MM-dd HH:mm:ss',
    short: 'HH:mm:ss',
    date: 'yyyy-MM-dd',
    time: 'HH:mm:ss',
    withTZ: 'yyyy-MM-dd HH:mm:ss zzz'
  };
  
  try {
    return formatInTimeZone(ms, timezone, formats[format] || formats.full);
  } catch (e) {
    console.error('Error formatting time:', e, 'timestamp:', timestamp, 'ms:', ms);
    try {
      return new Date(ms).toLocaleString();
    } catch (e2) {
      return '-';
    }
  }
};


export const formatRelativeTime = (timestamp) => {
  if (!timestamp) return '-';
  
  const ms = Number(timestamp) > 1e10 ? Number(timestamp) : Number(timestamp) * 1000;
  const now = Date.now();
  const diff = now - ms;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
};


export const getTimezoneOffset = (timezone) => {
  try {
    const now = new Date();
    const tzString = formatInTimeZone(now, timezone, 'zzz');
    return tzString;
  } catch (e) {
    return '';
  }
};