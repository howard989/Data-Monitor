class QueryCache {
  constructor(ttlSeconds = 60) {
    this.cache = new Map();
    this.ttl = ttlSeconds * 1000; 
  }

  generateKey(params) {
    return JSON.stringify(params);
  }

  get(params) {
    const key = this.generateKey(params);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  set(params, data) {
    const key = this.generateKey(params);
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    if (this.cache.size > 100) {
      this.cleanup();
    }
  }

  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }

  clear() {
    this.cache.clear();
  }


  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}


const statsCache = new QueryCache(30); 
const chartCache = new QueryCache(30); 

module.exports = {
  QueryCache,
  statsCache,
  chartCache
};