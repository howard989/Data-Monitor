export const monthRangeFromUtcMs = (ms) => {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1));
  const end = new Date(Date.UTC(y, m + 1, 0)); 
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
};


export const prevMonthRangeFromUtcMs = (ms) => {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0)); 
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
};


export const getAnchorMs = (recentBlocks) => {
  if (recentBlocks?.length) {
    return Number(recentBlocks[0].block_time_ms ?? Date.parse(recentBlocks[0].block_time));
  }
  return Date.now();
};