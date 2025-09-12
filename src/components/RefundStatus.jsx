import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input, Tooltip, Select, Pagination } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tzPlugin from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import DateRangePicker from './common/DateRangePicker';
import { useTimezone } from '../context/TimezoneContext';
import '../css/Watermark.css';

dayjs.extend(utc);
dayjs.extend(tzPlugin);
dayjs.extend(customParseFormat);

const { Option } = Select;

const toExplorerTx = (hash) => `https://bscscan.com/tx/${hash}`;
const toExplorerBlock = (num) => `https://bscscan.com/block/${num}`;

const formatNumber = (n) => new Intl.NumberFormat('en-US').format(Number(n || 0));
const shortHash = (h) => (!h || h.length <= 12 ? h : `${h.slice(0, 6)}...${h.slice(-6)}`);
const getTimeAgo = (date) => {
  if (!date) return '';
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr`;
  return `${Math.floor(diff / 86400)} days`;
};

async function fetchRefundSummary48({ start, end }) {
  const qs = new URLSearchParams({ brand: '48club', start, end }).toString();
  const res = await fetch(`/api/refund/summary?${qs}`);
  if (!res.ok) throw new Error('bad');
  const data = await res.json();
  return {
    execution_ratio: data?.execution_ratio ?? null,
    total_profit_bnb: data?.total_profit_bnb ?? null,
    onchain_count: data?.onchain_count ?? null,
    rebate_bnb: data?.rebate_bnb ?? null
  };
}

async function fetchRefundTx48({ start, end, page = 1, limit = 12, keyword = '' }) {
  const qs = new URLSearchParams({
    brand: '48club',
    start,
    end,
    page: String(page),
    limit: String(limit),
    q: keyword || ''
  }).toString();
  const res = await fetch(`/api/refund/tx?${qs}`);
  if (!res.ok) throw new Error('bad');
  const data = await res.json();
  return {
    rows: Array.isArray(data?.rows) ? data.rows : [],
    total: Number(data?.total ?? 0),
    page,
    limit
  };
}

export default function RefundStatus() {
  const { timezone, timezoneLabel } = useTimezone();

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const [dateRange, setDateRange] = useState(() => {
    const now = dayjs().tz(timezone);
    return {
      start: now.startOf('month').format('YYYY-MM-DD HH:mm'),
      end: now.endOf('day').format('YYYY-MM-DD HH:mm')
    };
  });

  const startUtc = useMemo(
    () =>
      dayjs
        .tz(dateRange.start, 'YYYY-MM-DD HH:mm', timezone)
        .startOf('minute')
        .utc()
        .format('YYYY-MM-DDTHH:mm:ss[Z]'),
    [dateRange.start, timezone]
  );

  const endUtc = useMemo(
    () =>
      dayjs
        .tz(dateRange.end, 'YYYY-MM-DD HH:mm', timezone)
        .endOf('minute')
        .utc()
        .format('YYYY-MM-DDTHH:mm:ss[Z]'),
    [dateRange.end, timezone]
  );

  const [summary, setSummary] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [table, setTable] = useState({ rows: [], total: 0, page: 1, limit: 12 });
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const compactRangeLabel = useCallback(
    (start, end) => {
      if (!start || !end) return '';
      const fmt = 'YYYY-MM-DD HH:mm';
      const s = dayjs.tz(start, fmt, timezone);
      const e = dayjs.tz(end, fmt, timezone);
      if (s.isSame(e, 'day')) return s.format('MMM D, YYYY');
      if (s.format('YYYY-MM') === e.format('YYYY-MM')) return `${s.format('MMM D')}–${e.format('MMM D, YYYY')}`;
      return `${s.format('MMM D, YYYY')} – ${e.format('MMM D, YYYY')}`;
    },
    [timezone]
  );

  const quickSetRange = useCallback(
    (days) => {
      const end = dayjs().tz(timezone).endOf('day').format('YYYY-MM-DD HH:mm');
      const start = dayjs().tz(timezone).subtract(days, 'day').startOf('day').format('YYYY-MM-DD HH:mm');
      setDateRange({ start, end });
    },
    [timezone]
  );

  const loadSummary = useCallback(async () => {
    try {
      const s = await fetchRefundSummary48({ start: startUtc, end: endUtc });
      setSummary(s);
    } catch {
      setSummary(null);
    }
  }, [startUtc, endUtc]);

  const loadTable = useCallback(
    async (p = table.page, l = table.limit, kw = keyword) => {
      try {
        const res = await fetchRefundTx48({ start: startUtc, end: endUtc, page: p, limit: l, keyword: kw });
        setTable(res);
      } catch {
        setTable((prev) => ({ ...prev, rows: [], total: 0, page: 1 }));
      }
    },
    [startUtc, endUtc]
  );

  useEffect(() => {
    (async () => {
      await Promise.all([loadSummary(), loadTable(1, table.limit, keyword)]);
      setTable((prev) => ({ ...prev, page: 1 }));
      setLastUpdatedAt(new Date());
    })();
  }, [loadSummary, loadTable, table.limit]);

  useEffect(() => {
    const h = setTimeout(() => {
      loadTable(1, table.limit, keyword);
    }, 400);
    return () => clearTimeout(h);
  }, [keyword, table.limit, loadTable]);

  return (
    <div className={`min-h-screen watermark-container ${isMobile ? 'p-4' : 'p-8 mx-auto max-w-[1280px]'}`}>
      <div className="flex justify-between items-center mb-4">
        <nav className="text-sm text-gray-600">
          <Link to="/data-center" className="hover:underline text-yellow-400">Data Center</Link>
          <span className="mx-2">/</span>
          <span>Refund Status</span>
        </nav>
        <div className="text-sm text-gray-600">
          Date Range: {compactRangeLabel(dateRange.start, dateRange.end)} ({timezoneLabel})
        </div>
      </div>

      <hr className="my-4 border-t border-gray-300" />

      <div className="flex items-start justify-between mb-3">
        <h1 className={`${isMobile ? 'text-xl' : 'text-2xl md:text-3xl'} font-bold text-gray-800`}>Refund Status</h1>
        <Button
          onClick={async () => {
            await Promise.all([loadSummary(), loadTable(table.page, table.limit, keyword)]);
            setLastUpdatedAt(new Date());
          }}
        >
          REFRESH
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
          <div className="text-3xl font-bold text-yellow-400 mb-2">
            {summary && Number.isFinite(Number(summary.execution_ratio)) ? Number(summary.execution_ratio).toFixed(2) : '—'}
            <span className="ml-1 text-base font-semibold text-gray-700">%</span>
          </div>
          <div className="text-sm text-gray-600 font-medium">backrun execution ratio</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
          <div className="text-3xl font-bold text-green-600 mb-2">
            {summary && Number.isFinite(Number(summary.total_profit_bnb)) ? formatNumber(summary.total_profit_bnb) : '—'}
            <span className="ml-1 text-base font-semibold text-gray-700">BNB</span>
          </div>
          <div className="text-sm text-gray-600 font-medium">backrun total profit (before burn)</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
          <div className="text-3xl font-bold text-gray-900 mb-2">
            {summary && Number.isFinite(Number(summary.onchain_count)) ? formatNumber(summary.onchain_count) : '—'}
          </div>
          <div className="text-sm text-gray-600 font-medium">backrun on-chain count</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
          <div className="text-3xl font-bold text-red-500 mb-2">
            {summary && Number.isFinite(Number(summary.rebate_bnb)) ? formatNumber(summary.rebate_bnb) : '—'}
            <span className="ml-1 text-base font-semibold text-gray-700">BNB</span>
          </div>
          <div className="text-sm text-gray-600 font-medium">backrun rebate</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="relative pl-3 text-base font-semibold text-gray-900 leading-6">
            <span aria-hidden="true" className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 bg-yellow-400" />
            Transactions
          </h2>
        </div>

        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <DateRangePicker
              value={dateRange}
              onChange={(val) => {
                if (!val || !val.start || !val.end) return;
                setDateRange(val);
              }}
              format="YYYY-MM-DD HH:mm"
              showTime={{ format: 'HH:mm' }}
              allowClear={false}
              className="w-full md:w-[420px]"
              timezone={timezone}
            />
            <div className="grid grid-cols-3 gap-2">
              <Button onClick={() => quickSetRange(7)} size="small">7D</Button>
              <Button onClick={() => quickSetRange(30)} size="small">30D</Button>
              <Button onClick={() => quickSetRange(90)} size="small">90D</Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Input
              allowClear
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search tx / hash / block..."
              style={{ width: 320 }}
              prefix={<SearchOutlined />}
            />
          </div>
        </div>

        <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-gray-600">tx hash</th>
                  <th className="text-left py-2 px-3 text-gray-600">source</th>
                  <th className="text-left py-2 px-3 text-gray-600">blockNum</th>
                  <th className="text-left py-2 px-3 text-gray-600">backrunHash</th>
                  <th className="text-left py-2 px-3 text-gray-600">targetHash</th>
                  <th className="text-left py-2 px-3 text-gray-600">profit</th>
                  <th className="text-left py-2 px-3 text-gray-600">txIndex</th>
                  <th className="text-left py-2 px-3 text-gray-600">timestamp</th>
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r) => {
                  const ms = String(r.timestamp).length <= 10 ? Number(r.timestamp) * 1000 : Number(r.timestamp);
                  const d = dayjs.tz(ms, timezone);
                  return (
                    <tr key={r.txHash + String(r.txIndex)} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 text-gray-900">
                        <a href={toExplorerTx(r.txHash)} target="_blank" rel="noreferrer" className="hover:underline">
                          {shortHash(r.txHash)}
                        </a>
                      </td>
                      <td className="py-2 px-3 text-gray-700">{r.source}</td>
                      <td className="py-2 px-3">
                        <a href={toExplorerBlock(r.blockNum)} target="_blank" rel="noreferrer" className="hover:underline">
                          {formatNumber(r.blockNum)}
                        </a>
                      </td>
                      <td className="py-2 px-3">
                        {r.backrunHash ? (
                          <Tooltip title={r.backrunHash}>
                            <span>{shortHash(r.backrunHash)}</span>
                          </Tooltip>
                        ) : (
                          '-' 
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {r.targetHash ? (
                          <Tooltip title={r.targetHash}>
                            <span>{shortHash(r.targetHash)}</span>
                          </Tooltip>
                        ) : (
                          '-' 
                        )}
                      </td>
                      <td className="py-2 px-3 font-medium text-green-600">{Number(r.profit ?? 0).toFixed(5)} BNB</td>
                      <td className="py-2 px-3 text-gray-700">{r.txIndex}</td>
                      <td className="py-2 px-3 text-gray-700">
                        {d.format('YYYY-MM-DD HH:mm:ss')} {timezoneLabel}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-3 flex items-center justify-between bg-white">
            <div className="text-sm text-gray-500">{formatNumber(table.total)} rows</div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Page Size</span>
                <Select
                  size="small"
                  style={{ width: 100 }}
                  value={String(table.limit)}
                  onChange={(v) => loadTable(1, Number(v), keyword)}
                >
                  <Option value="12">12</Option>
                  <Option value="24">24</Option>
                  <Option value="48">48</Option>
                </Select>
              </div>
              <Pagination
                size="small"
                current={table.page}
                pageSize={table.limit}
                total={table.total}
                showSizeChanger={false}
                onChange={(p) => loadTable(p, table.limit, keyword)}
              />
            </div>
          </div>
        </div>

        {lastUpdatedAt ? <div className="mt-3 text-right text-xs text-gray-400">{getTimeAgo(lastUpdatedAt)}</div> : null}
      </div>
    </div>
  );
}
