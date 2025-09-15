const { pool, SCHEMA } = require('./db')

function ident(x) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(x)) throw new Error(`Invalid identifier: ${x}`)
    return `"${x}"`
}

const schema = String(SCHEMA || 'public').toLowerCase()
const T_INTERNAL = `${ident(schema)}.${ident('internal_arb_tx')}`
const T_EXTERNAL = `${ident(schema)}.${ident('external_refund_tx')}`

const ADDR = {
    payer: '0x4848489f0b2bedd788c696e2d79b6b69d7484848',
    routerOurs: '0x9999b0cdd35d7f3b281ba02efc0d228486940515',
    binanceWallet: '0x956e324dd26941c5626e560a74c71a9d856088f0',
    pancakeswap: '0x7acce9e6f513c2d38421a90d01ae3b1f34ea0a36',
    blink: '0x4ae69b12b0da1eec60558fe9c0e0a3f04a6a34a2',
    merkle: '0xeda4c0f725466ff036b03b2ad532904d6a96473e'
}

function brandCfg(brand) {
    const b = String(brand || '').toLowerCase()
    if (b === 'binancewallet') return { brand: 'binanceWallet', internalTypes: ['binanceWallet'], externalTo: [], restrictRouter: ADDR.routerOurs }
    if (b === 'pancakeswap') return { brand: 'pancakeswap', internalTypes: ['pancakeSwap'], externalTo: [ADDR.pancakeswap], restrictRouter: null }
    if (b === 'blink') return { brand: 'blink', internalTypes: ['blink', 'blinkBlockRazor'], externalTo: [ADDR.blink], restrictRouter: null }
    if (b === 'merkle') return { brand: 'merkle', internalTypes: [], externalTo: [ADDR.merkle], restrictRouter: null }
    return { brand: 'binanceWallet', internalTypes: ['binanceWallet'], externalTo: [], restrictRouter: ADDR.routerOurs }
}

function toTs(v) { return new Date(v).toISOString() }

async function getRefundSummary({ brand, start, end }) {
    const cfg = brandCfg(brand)

    let intCnt = 0
    let intProfit = '0'
    let intRefund = '0'
    let sinceInt = null

    if (cfg.internalTypes.length) {
        let i = 1
        const iv = []
        const condTime = `block_time >= $${i++}::timestamptz AND block_time <= $${i++}::timestamptz`; iv.push(toTs(start), toTs(end))
        const condType = `refund_type = ANY($${i++}::text[])`; iv.push(cfg.internalTypes)
        const condRouter = cfg.restrictRouter ? `router_address = $${i++}` : `true`; if (cfg.restrictRouter) iv.push(cfg.restrictRouter.toLowerCase())
        const baseWhere = `${condTime} AND ${condType} AND ${condRouter}`
        const baseFrom = `FROM ${T_INTERNAL} WHERE ${baseWhere}`

        const [rCnt, rProfit, rRefund, rSince] = await Promise.all([
            pool.query(`SELECT COUNT(*)::bigint AS c ${baseFrom}`, iv),
            pool.query(`SELECT COALESCE(SUM(profit_amount_wei::numeric),0) AS s ${baseFrom} AND profit_kind = 'native'`, iv),
            pool.query(`SELECT COALESCE(SUM(refund_amount_wei::numeric),0) AS s ${baseFrom} AND refund_kind = 'native'`, iv),
            pool.query(`SELECT MIN(block_time) AS m ${baseFrom}`, iv)
        ])

        intCnt = Number(rCnt.rows[0]?.c || 0)
        intProfit = String(rProfit.rows[0]?.s || '0')
        intRefund = String(rRefund.rows[0]?.s || '0')
        sinceInt = rSince.rows[0]?.m ? new Date(rSince.rows[0].m).toISOString() : null
    }

    let extRefund = '0'
    let sinceExt = null

    if (cfg.externalTo.length) {
        let j = 1
        const ev = []
        const condTime = `block_time >= $${j++}::timestamptz AND block_time <= $${j++}::timestamptz`; ev.push(toTs(start), toTs(end))
        const condTo = `to_address = ANY($${j++}::text[])`; ev.push(cfg.externalTo.map(x => x.toLowerCase()))
        const condFrom = `from_address = $${j++}`; ev.push(ADDR.payer.toLowerCase())
        const baseFrom = `FROM ${T_EXTERNAL} WHERE ${condTime} AND ${condTo} AND ${condFrom}`

        const [rExtSum, rExtSince] = await Promise.all([
            pool.query(`SELECT COALESCE(SUM(value_wei::numeric),0) AS s ${baseFrom}`, ev),
            pool.query(`SELECT MIN(block_time) AS m ${baseFrom}`, ev)
        ])

        extRefund = String(rExtSum.rows[0]?.s || '0')
        sinceExt = rExtSince.rows[0]?.m ? new Date(rExtSince.rows[0].m).toISOString() : null
    }

    const rebate = (BigInt(intRefund) + BigInt(extRefund)).toString()
    const profit = intProfit
    const since = [sinceInt, sinceExt].filter(Boolean).sort()[0] || null

    return {
        success: true,
        brand: cfg.brand,
        onchain_count: intCnt,
        total_profit_bnb: Number(BigInt(profit) / 1000000000000000000n),
        rebate_bnb: Number(BigInt(rebate) / 1000000000000000000n),
        execution_ratio: null,
        since
    }
}


async function getRefundTx({ brand, start, end, page = 1, limit = 12, keyword = '' }) {
    const cfg = brandCfg(brand)

    const intVals = []
    let intI = 1
    const timeInt = `a.block_time >= $${intI++}::timestamptz AND a.block_time <= $${intI++}::timestamptz`
    intVals.push(toTs(start), toTs(end))
    const intTypeCond = cfg.internalTypes.length ? `a.refund_type = ANY($${intI++}::text[])` : `false`
    if (cfg.internalTypes.length) intVals.push(cfg.internalTypes)
    const intRouterCond = cfg.restrictRouter ? `a.router_address = $${intI++}` : `true`
    if (cfg.restrictRouter) intVals.push(cfg.restrictRouter.toLowerCase())

    const extVals = []
    let extI = 1
    const timeExt = `b.block_time >= $${extI++}::timestamptz AND b.block_time <= $${extI++}::timestamptz`
    extVals.push(toTs(start), toTs(end))

    const kw = String(keyword || '').trim()
    let intKw = `true`
    let extKw = `true`
    if (kw) {
        if (/^0x[a-fA-F0-9]{64}$/.test(kw)) {
            intKw = `a.tx_hash = $${intI++}`; intVals.push(kw.toLowerCase())
            extKw = `b.tx_hash = $${extI++}`; extVals.push(kw.toLowerCase())
        } else if (/^\d+$/.test(kw)) {
            intKw = `a.block_number = $${intI++}`; intVals.push(String(kw))
            extKw = `b.block_number = $${extI++}`; extVals.push(String(kw))
        } else {
            intKw = `a.tx_hash ILIKE $${intI++}`; intVals.push(`%${kw}%`)
            extKw = `b.tx_hash ILIKE $${extI++}`; extVals.push(`%${kw}%`)
        }
    }

    const intSql = cfg.internalTypes.length ? `
  SELECT 
    a.tx_hash AS "txHash",
    'internal'::text AS "source",
    a.block_number AS "blockNum",
    a.tx_index AS "txIndex",
    EXTRACT(EPOCH FROM a.block_time)::bigint*1000 AS "timestamp",
    a.refund_amount_wei::numeric AS "amount_wei",
    (a.refund_amount_wei::numeric / 1e18) AS "amount_bnb"
  FROM ${T_INTERNAL} a
  WHERE ${timeInt} AND ${intTypeCond} AND ${intRouterCond}
    AND a.refund_amount_wei IS NOT NULL
    AND a.refund_amount_wei::numeric > 0
    AND ${intKw}
` : null

    const extSql = cfg.externalTo.length ? `
  SELECT
    b.tx_hash AS "txHash",
    'external'::text AS "source",
    b.block_number AS "blockNum",
    b.tx_index AS "txIndex",
    EXTRACT(EPOCH FROM b.block_time)::bigint*1000 AS "timestamp",
    b.value_wei::numeric AS "amount_wei",
    (b.value_wei::numeric / 1e18) AS "amount_bnb"
  FROM ${T_EXTERNAL} b
  WHERE ${timeExt}
    AND b.to_address = ANY($${extI++}::text[])
    AND b.from_address = $${extI++}
    AND ${extKw}
` : null


    if (cfg.externalTo.length) {
        extVals.push(cfg.externalTo.map(x => x.toLowerCase()))
        extVals.push(ADDR.payer.toLowerCase())
    }

    const queries = []
    const queryVals = []
    let offset = 0
    if (intSql) {
        const mappedIntSql = intSql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + offset}`)
        queries.push(mappedIntSql)
        queryVals.push(...intVals)
        offset += intVals.length
    }
    if (extSql) {
        const mappedExtSql = extSql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + offset}`)
        queries.push(mappedExtSql)
        queryVals.push(...extVals)
    }

    const unionSql = queries.join(' UNION ALL ')
    if (!unionSql) return { success: true, total: 0, rows: [], page: Number(page || 1), limit: Number(limit || 12) }

    const countSql = `SELECT COUNT(*)::bigint AS c FROM (${unionSql}) u`
    const off = (Number(page || 1) - 1) * Number(limit || 12)
    const valsCount = [...queryVals]
    const valsPage = [...queryVals]
    let pageI = queryVals.length + 1
    const pageSql = `
    SELECT * FROM (${unionSql}) u
    ORDER BY "blockNum" DESC, "txIndex" ASC
    LIMIT $${pageI++} OFFSET $${pageI++}
  `
    valsPage.push(Number(limit || 12), Number(off || 0))

    const [rc, rr] = await Promise.all([pool.query(countSql, valsCount), pool.query(pageSql, valsPage)])
    const rows = (rr.rows || []).map(r => ({
        txHash: String(r.txHash),
        source: String(r.source),
        blockNum: Number(r.blockNum),
        backrunHash: r.backrunHash,
        targetHash: r.targetHash,
        profit: Number(r.amount_bnb || 0),
        txIndex: Number(r.txIndex),
        timestamp: Number(r.timestamp)
    }))
    return { success: true, total: Number(rc.rows[0]?.c || 0), rows, page: Number(page || 1), limit: Number(limit || 12) }
}

module.exports = { getRefundSummary, getRefundTx }
