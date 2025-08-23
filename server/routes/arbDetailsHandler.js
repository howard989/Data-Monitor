// server/routes/arbDetailsHandler.js

const express = require('express');
const router  = express.Router();
const { allClient1 } = require('../../src/data/redisClient');


router.get('/get-arb-details', async (_req, res) => {
  try {
    const raw = await allClient1.hGetAll('arb_details');
    const arr = Object.entries(raw).map(([key, val]) => {
      let parsed;
      try { parsed = JSON.parse(val); } catch { parsed = { value: val }; }
      return { key, ...parsed };
    });
    res.json(arr);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/get-arb-statistic', async (_req, res) => {
  try {
    const raw = await allClient1.hGetAll('arb_statistic');
    const obj = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k, isNaN(v) ? v : Number(v)])
    );
    res.json(obj);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/get-arb-statistic-v2', async (_req, res) => {
  try {
    const raw = await allClient1.hGetAll('arb_statistic');
    const n = (x) => Number(x || 0);
    const WEI = 1e18;
    const BURN = 0.275; 

    const cnt48 = n(raw['bnb48_arb_num']);
    const cntBr = n(raw['blockrazor_arb_num']);
    const cntOth = n(raw['others_arb_num']);
    const totalCnt = cnt48 + cntBr + cntOth || 1;

    const toBNBPreBurn = (wei) => (n(wei) / WEI) / BURN;

    const payload = {
      bnb48: {
        ratio: +((cnt48 / totalCnt) * 100).toFixed(2),
        profit_bnb: +toBNBPreBurn(raw['bnb48_total_profit']).toFixed(4),
        count: cnt48,
        refund_bnb: +n(raw['bnb48_binanceWallet_refund']).toFixed(4), 
      },
      blockrazor: {
        ratio: +((cntBr / totalCnt) * 100).toFixed(2),
        profit_bnb: +toBNBPreBurn(raw['blockrazor_total_profit']).toFixed(4),
        count: cntBr,
        refund_bnb: +n(raw['blockrazor_binanceWallet_refund']).toFixed(4), 
      },
      others: {
        ratio: +((cntOth / totalCnt) * 100).toFixed(2),
        profit_bnb: null, 
        count: cntOth,
        refund_bnb: +n(raw['others_binanceWallet_refund']).toFixed(4), 
      },
      __v2: true, 
    };

    res.json(payload);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
