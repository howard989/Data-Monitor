const express = require('express');
const router = express.Router();
const authMiddleware = require('../../src/middleware/authMiddleware');
const {
  getSandwichStats,
  getRecentBlocks
} = require('../postgsql/query');

router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await getSandwichStats();
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

router.get('/recent', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
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

module.exports = router;