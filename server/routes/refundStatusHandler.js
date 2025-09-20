const express = require('express')
const router = express.Router()
const { getRefundSummary, getRefundTx } = require('../postgsql/refund_query')
const access = require('../config/brandAccess')

const ALL_BRANDS = ['binanceWallet', 'pancakeswap', 'blink', 'merkle']

function userAllowedBrands(username) {
    const u = String(username || '').toLowerCase()
    if (u === 'admin') return ALL_BRANDS
    if (access[u] && Array.isArray(access[u]) && access[u].length) return access[u]
    return []
}

function sanitizeBrandForUser(username, brand) {
    const allowed = userAllowedBrands(username).map(b => String(b).toLowerCase())
    const want = String(brand || '').toLowerCase()
    if (allowed.includes(want)) return brand
    return userAllowedBrands(username)[0]
}

router.get('/brands', async (req, res) => {
    try {
        const user = req.user?.username || ''
        const allowed = userAllowedBrands(user)
        res.json({ success: true, allowed, user })
    } catch {
        res.status(500).json({ success: false })
    }
})

router.get('/summary', async (req, res) => {
    try {
        const user = req.user?.username || ''
        const allowed = userAllowedBrands(user)
        if (!allowed || allowed.length === 0) {
            return res.status(403).json({ success: false, error: 'No permission' })
        }
        const brand = sanitizeBrandForUser(user, req.query.brand || '')
        const start = req.query.start
        const end = req.query.end
        const source = req.query.source || 'all'
        if (!start || !end) return res.status(400).json({ success: false, error: 'missing range' })
        const r = await getRefundSummary({ brand, start, end, source })
        res.set('Cache-Control', 'private, max-age=10, stale-while-revalidate=30')
        res.json(r)
    } catch (e) {
        console.error('Summary error:', e)
        res.status(500).json({ success: false, error: 'summary failed', details: e.message })
    }
})

router.get('/tx', async (req, res) => {
    try {
        const user = req.user?.username || ''
        const allowed = userAllowedBrands(user)
        if (!allowed || allowed.length === 0) {
            return res.status(403).json({ success: false, error: 'No permission' })
        }
        const brand = sanitizeBrandForUser(user, req.query.brand || '')
        const start = req.query.start
        const end = req.query.end
        const page = parseInt(req.query.page || '1', 10)
        const limit = parseInt(req.query.limit || '12', 10)
        const q = req.query.q || ''
        const sort = (req.query.sort || 'time').toLowerCase() === 'rebate' ? 'rebate' : 'time'
        const dir = (req.query.dir || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc'
        const srcQ = String(req.query.source || 'all').toLowerCase()
        const source = (srcQ === 'internal' || srcQ === 'external' || srcQ === 'new_internal') ? srcQ : 'all'

        if (!start || !end) return res.status(400).json({ success: false, error: 'missing range' })
        const r = await getRefundTx({ brand, start, end, page, limit, keyword: q, sortBy: sort, sortDir: dir, source })
        res.set('Cache-Control', 'private, max-age=10, stale-while-revalidate=30')
        res.json(r)
    } catch (e) {
        console.error('TX error:', e)
        res.status(500).json({ success: false, error: 'tx failed', details: e.message })
    }
})

module.exports = router
