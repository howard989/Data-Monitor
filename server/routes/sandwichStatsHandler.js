const express = require('express');
const router = express.Router();
const authMiddleware = require('../../src/middleware/authMiddleware');
const {
  getSandwichStats,
  getRecentBlocks,
  findSandwichByTx,
  getBlockSandwiches,
  getHourlyStats,
  getBuilderList,
  getEarliestBlock,
  getBuilderSandwiches,
  searchSandwiches,
  getChartData,
} = require('../postgsql/query');
const { statsCache, chartCache } = require('../utils/queryCache');


router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const builder = req.query.builder ? String(req.query.builder) : null;
    const startDate = req.query.startDate ? String(req.query.startDate) : null;
    const endDate = req.query.endDate ? String(req.query.endDate) : null;
    const bundleFilter = req.query.bundleFilter || 'all';
    const frontrunRouter = req.query.frontrunRouter || 'all';
    
 
    let amountRange = null;
    if (req.query.amountMin !== undefined || req.query.amountMax !== undefined) {
      amountRange = {
        min: req.query.amountMin ? parseFloat(req.query.amountMin) : undefined,
        max: req.query.amountMax ? parseFloat(req.query.amountMax) : undefined
      };
    }
    
    const stats = await getSandwichStats(builder, startDate, endDate, bundleFilter, amountRange, frontrunRouter);
    
    
    if (!startDate && !endDate) {
      res.set('Cache-Control', 'private, max-age=6, stale-while-revalidate=30');
    }
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error in /stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sandwich statistics'
    });
  }
});


router.get('/builders', authMiddleware, async (req, res) => {
  try {
    const list = await getBuilderList();
    res.json({ success: true, data: list });
  } catch (e) {
    console.error('Error in /builders:', e);
    res.status(500).json({ success: false, error: 'Failed to fetch builder list' });
  }
});

router.get('/earliest-block', authMiddleware, async (req, res) => {
  try {
    const data = await getEarliestBlock();
    res.json({ success: true, data });
  } catch (e) {
    console.error('Error in /earliest-block:', e);
    res.status(500).json({ success: false, error: 'Failed to fetch earliest block' });
  }
});

router.get('/recent', authMiddleware, async (req, res) => {
  try {
    const n = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 200) : 50;
    
    const blocks = await getRecentBlocks(limit);
    res.json({
      success: true,
      data: blocks
    });
  } catch (error) {
    console.error('Error in /recent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent blocks'
    });
  }
});


router.get('/hourly', authMiddleware, async (req, res) => {
  try {
    const h = Number.parseInt(req.query.hours, 10);
    const hours = Number.isFinite(h) ? Math.min(Math.max(h, 1), 168) : 24;
    const data = await getHourlyStats(hours);
    res.json({ success: true, data });
  } catch (e) {
    console.error('Error in /hourly:', e);
    res.status(500).json({ success: false, error: 'Failed to fetch hourly stats' });
  }
});



router.get('/by-tx/:hash', authMiddleware, async (req, res) => {
  try {
    const hash = String(req.params.hash || '').toLowerCase();
    const data = await findSandwichByTx(hash);
    res.json({ success: true, data });
  } catch (e) {
    console.error('Error in /by-tx:', e);
    res.status(500).json({ success: false, error: 'Failed to query by tx hash' });
  }
});

router.get('/by-block/:block', authMiddleware, async (req, res) => {
  try {
    const block = String(req.params.block);
    const { data, meta, is_clean } = await getBlockSandwiches(block);
    res.json({ success: true, data, count: data.length, is_clean, meta });
  } catch (e) {
    console.error('Error in /by-block:', e);
    res.status(500).json({ success: false, error: 'Failed to query by block' });
  }
});

router.get('/builder-sandwiches', authMiddleware, async (req, res) => {
  try {
    const builder = req.query.builder;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const startDate = req.query.startDate ? String(req.query.startDate) : null;
    const endDate = req.query.endDate ? String(req.query.endDate) : null;
    
    if (!builder) {
      return res.status(400).json({ success: false, error: 'Builder name is required' });
    }
    
    const result = await getBuilderSandwiches(builder, page, limit, startDate, endDate);
    res.json({ success: true, ...result });
  } catch (e) {
    console.error('Error in /builder-sandwiches:', e);
    res.status(500).json({ success: false, error: 'Failed to fetch builder sandwiches' });
  }
});


router.get('/search', authMiddleware, async (req, res) => {
  try {
    const {
      victim_to,
      is_bundle,
      profit_token,
      builder,
      startDate,
      endDate,
      page = '1',
      limit = '50',
      sortBy = 'time',
      bnbUsd
    } = req.query;

    const result = await searchSandwiches({
      victim_to: victim_to || null,
      is_bundle: (is_bundle === 'true') ? true : (is_bundle === 'false' ? false : null),
      profit_token: profit_token || null,
      builder: builder || null,
      startDate: startDate || null,
      endDate: endDate || null,
      page: Math.max(1, parseInt(page)),
      limit: Math.min(100, Math.max(1, parseInt(limit))),
      sortBy: sortBy || 'time',
      bnbUsd: (bnbUsd !== undefined && bnbUsd !== '') ? Number(bnbUsd) : null
    });

    res.json(result);
  } catch (e) {
    console.error('Error in /search:', e);
    res.status(500).json({ success:false, error:'Failed to search sandwiches' });
  }
});

router.get('/chart-data', authMiddleware, async (req, res) => {
  try {
    const {
      interval = 'daily',
      startDate,
      endDate,
      builders,
      bundleFilter = 'all',
      frontrunRouter = 'all',
      snapshotBlock
    } = req.query;
    
    const builderList = builders ? builders.split(',').filter(Boolean) : null;
    

    let amountRange = null;
    if (req.query.amountMin !== undefined || req.query.amountMax !== undefined) {
      amountRange = {
        min: req.query.amountMin ? parseFloat(req.query.amountMin) : undefined,
        max: req.query.amountMax ? parseFloat(req.query.amountMax) : undefined
      };
    }
    
    const snap = snapshotBlock !== undefined ? Number(snapshotBlock) : null;
    const data = await getChartData(interval, startDate, endDate, builderList, bundleFilter, amountRange, frontrunRouter, snap);
    
    res.json({
      success: true,
      ...data
    });
  } catch (e) {
    console.error('Error in /chart-data:', e);
    res.status(500).json({ success: false, error: 'Failed to fetch chart data' });
  }
});

router.post('/clear-cache', authMiddleware, async (req, res) => {
  try {
    statsCache.clear();
    chartCache.clear();
    
    console.log('Cache cleared successfully at', new Date().toISOString());
    
    res.json({
      success: true,
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error('Error clearing cache:', e);
    res.status(500).json({ success: false, error: 'Failed to clear cache' });
  }
});


module.exports = router;