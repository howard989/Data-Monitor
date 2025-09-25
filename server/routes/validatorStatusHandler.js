const express = require('express');
const router = express.Router();
const { getValidatorStatusData } = require('../postgsql/validator_status_query');
const validatorAccess = require('../config/validatorAccess');

function hasValidatorAccess(username) {
    const user = String(username || '');
    const userLower = user.toLowerCase();
    return validatorAccess[user] === 'allowed' || validatorAccess[userLower] === 'allowed';
}

router.get('/validator-status', async (req, res) => {
    try {
        const user = req.user?.username || '';

        if (!hasValidatorAccess(user)) {
            return res.status(403).json({
                success: false,
                error: 'Access denied to validator status'
            });
        }

        const { timeRange = '1h' } = req.query;
        const data = await getValidatorStatusData({ timeRange });

        if (!data.success) {
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch validator status data'
            });
        }

        res.set('Cache-Control', 'private, max-age=10, stale-while-revalidate=30');
        res.json(data);
    } catch (error) {
        console.error('Error in validator status handler:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

router.get('/validator-access', async (req, res) => {
    try {
        const user = req.user?.username || '';
        const hasAccess = hasValidatorAccess(user);
        res.json({
            success: true,
            hasAccess,
            user
        });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

module.exports = router;