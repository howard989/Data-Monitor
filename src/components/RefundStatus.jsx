import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input, Tooltip, Select, Pagination, Tabs, Tag, message } from 'antd';
import { SearchOutlined, SwapOutlined, DollarOutlined } from '@ant-design/icons';
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

function getToken() {
  return localStorage.getItem('token') || localStorage.getItem('authToken') || '';
}
async function ensureToken() {
  let t = getToken();
  if (t) return t;
  const r = await fetch('/api/auth/refresh', { method: 'POST' });
  if (r.ok) {
    const j = await r.json();
    if (j?.token) {
      localStorage.setItem('token', j.token);
      localStorage.setItem('authToken', j.token);
      return j.token;
    }
  }
  throw new Error('no token');
}
async function authedFetch(url) {
  const t = await ensureToken();
  return fetch(url, { headers: { Authorization: `Bearer ${t}` } });
}

async function fetchAllowedBrands() {
  const res = await authedFetch(`/api/refund/brands`);
  if (!res.ok) {
    const text = await res.text();
    console.error('Failed to fetch brands:', res.status, text);
    throw new Error(`Failed to fetch brands: ${res.status}`);
  }
  const data = await res.json();
  return { allowed: Array.isArray(data?.allowed) ? data.allowed : [], user: data?.user || '' };
}
async function fetchRefundSummary({ brand, start, end }) {
  const qs = new URLSearchParams({ brand, start, end }).toString();
  const res = await authedFetch(`/api/refund/summary?${qs}`);
  if (!res.ok) {
    const text = await res.text();
    console.error('Failed to fetch summary:', res.status, text);
    throw new Error(`Failed to fetch summary: ${res.status}`);
  }
  return await res.json();
}
async function fetchRefundTx({ brand, start, end, page = 1, limit = 12, keyword = '', sortBy='time', sortDir='desc' }) {
  const qs = new URLSearchParams({
    brand, start, end,
    page: String(page), limit: String(limit),
    q: keyword || '',
    sort: sortBy, dir: sortDir
  }).toString();
  const res = await authedFetch(`/api/refund/tx?${qs}`);
  if (!res.ok) {
    const text = await res.text();
    console.error('Failed to fetch tx:', res.status, text);
    throw new Error(`Failed to fetch tx: ${res.status}`);
  }
  return await res.json();
}

export default function RefundStatus() {
  const { timezone, timezoneLabel } = useTimezone();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const [allowedBrands, setAllowedBrands] = useState([]);
  const [brand, setBrand] = useState('');
  const [who, setWho] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { allowed, user } = await fetchAllowedBrands();
        if (!allowed || allowed.length === 0) {
          message.error('No Data');
          navigate('/data-center');
          return;
        }
        setAllowedBrands(allowed || []);
        setBrand((allowed || [])[0] || '');
        setWho(user || '');
      } catch {
        setAllowedBrands([]);
        setBrand('');
        setWho('');
        message.error('Auth failed');
        navigate('/data-center');
      }
    })();
  }, [navigate]);

  const [dateRange, setDateRange] = useState(() => {
    const now = dayjs().tz(timezone);
    return { start: now.startOf('month').format('YYYY-MM-DD HH:mm'), end: now.endOf('day').format('YYYY-MM-DD HH:mm') };
  });

  const startUtc = useMemo(
    () => dayjs.tz(dateRange.start, 'YYYY-MM-DD HH:mm', timezone).startOf('minute').utc().format('YYYY-MM-DDTHH:mm:ss[Z]'),
    [dateRange.start, timezone]
  );
  const endUtc = useMemo(
    () => dayjs.tz(dateRange.end, 'YYYY-MM-DD HH:mm', timezone).endOf('minute').utc().format('YYYY-MM-DDTHH:mm:ss[Z]'),
    [dateRange.end, timezone]
  );

  const [summary, setSummary] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [table, setTable] = useState({ rows: [], total: 0, page: 1, limit: 12 });
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ field: null, direction: null });

  const compactRangeLabel = useCallback((start, end) => {
    if (!start || !end) return '';
    const fmt = 'YYYY-MM-DD HH:mm';
    const s = dayjs.tz(start, fmt, timezone);
    const e = dayjs.tz(end, fmt, timezone);
    if (s.isSame(e, 'day')) return s.format('MMM D, YYYY');
    if (s.format('YYYY-MM') === e.format('YYYY-MM')) return `${s.format('MMM D')}–${e.format('MMM D, YYYY')}`;
    return `${s.format('MMM D, YYYY')} – ${e.format('MMM D, YYYY')}`;
  }, [timezone]);

  const quickSetRange = useCallback((days) => {
    const end = dayjs().tz(timezone).endOf('day').format('YYYY-MM-DD HH:mm');
    const start = dayjs().tz(timezone).subtract(days, 'day').startOf('day').format('YYYY-MM-DD HH:mm');
    setDateRange({ start, end });
  }, [timezone]);

  const loadSummary = useCallback(async () => {
    if (!brand) return;
    const s = await fetchRefundSummary({ brand, start: startUtc, end: endUtc });
    setSummary(s);
  }, [brand, startUtc, endUtc]);

  const loadTable = useCallback(async (p = table.page, l = table.limit, kw = keyword) => {
    if (!brand) return;
    const sortBy = sortConfig.field === 'rebate' ? 'rebate' : 'time';
    const sortDir = sortConfig.direction || 'desc';
    const r = await fetchRefundTx({ brand, start: startUtc, end: endUtc, page: p, limit: l, keyword: kw, sortBy, sortDir });
    setTable({ rows: Array.isArray(r?.rows) ? r.rows : [], total: Number(r?.total ?? 0), page: p, limit: l });
  }, [brand, startUtc, endUtc, sortConfig]);

  const handleSort = (field) => {
    setSortConfig(prev => {
      if (prev.field !== field) return { field, direction: 'desc' };
      if (prev.direction === 'desc') return { field, direction: 'asc' };
      if (prev.direction === 'asc') return { field: null, direction: null };
      return { field, direction: 'desc' };
    });
  };

  const filteredRows = useMemo(() => {
    if (sourceFilter === 'all') return table.rows;
    return table.rows.filter(r => r.source === sourceFilter);
  }, [table.rows, sourceFilter]);

  useEffect(() => {
    if (!brand) return;
    (async () => {
      await Promise.all([loadSummary(), loadTable(1, table.limit, keyword)]);
      setTable((prev) => ({ ...prev, page: 1 }));
      setLastUpdatedAt(new Date());
    })();
  }, [brand, loadSummary, loadTable, table.limit]);

  useEffect(() => {
    const h = setTimeout(() => { loadTable(1, table.limit, keyword); }, 400);
    return () => clearTimeout(h);
  }, [keyword, table.limit, loadTable]);

  const isAdmin = String(who || '').toLowerCase() === 'admin';
  const brandTabs = isAdmin && allowedBrands.length > 1 ? (
    <Tabs activeKey={brand} onChange={(k) => setBrand(k)} items={allowedBrands.map((b) => ({
      key: b,
      label: b === 'binanceWallet' ? 'Binance' : b === 'pancakeswap' ? 'Pancake' : b === 'blink' ? 'Blink' : b === 'merkle' ? 'Merkle' : b
    }))} />
  ) : null;

  return (
    <div className={`min-h-screen watermark-container ${isMobile ? 'p-4' : 'p-8 mx-auto max-w-[1280px]'}`}>
      <div className="flex justify-between items-center mb-4">
        <nav className="text-sm text-gray-600">
          <Link to="/data-center" className="hover:underline text-yellow-400">Data Center</Link>
          <span className="mx-2">/</span>
          <span>Refund Status</span>
        </nav>
        <div className="text-sm text-gray-600">Date Range: {compactRangeLabel(dateRange.start, dateRange.end)} ({timezoneLabel})</div>
      </div>

      <hr className="my-4 border-t border-gray-300" />

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <h1 className={`${isMobile ? 'text-xl' : 'text-2xl md:text-3xl'} font-bold text-gray-800`}>Refund Status</h1>
          {summary?.since ? <Tag color="blue">{dayjs(summary.since).tz(timezone).format('YYYY-MM-DD')} since</Tag> : null}
          {brand ? <Tag color="gold">{brand}</Tag> : null}
        </div>
        <Button onClick={async () => {
          try{
            await Promise.all([loadSummary(), loadTable(table.page, table.limit, keyword)]);
            setLastUpdatedAt(new Date());
          }catch{
            message.error('Refresh failed');
          }
        }}>REFRESH</Button>
      </div>

      {brandTabs}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
          <div className="text-3xl font-bold text-gray-900 mb-2">
            {summary && Number.isFinite(Number(summary.onchain_count)) ? formatNumber(summary.onchain_count) : '—'}
          </div>
          <div className="text-sm text-gray-600 font-medium">backrun on-chain count</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
          <div className="text-3xl font-bold text-red-500 mb-2">
            {summary && Number.isFinite(Number(summary.rebate_bnb)) ? Number(summary.rebate_bnb).toFixed(4) : '—'}
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
              onChange={(val) => { if (!val || !val.start || !val.end) return; setDateRange(val); }}
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
            <div className="flex gap-2">
              <Select 
                size="small" 
                style={{ width: 120 }} 
                value={sourceFilter}
                onChange={setSourceFilter}
              >
                <Option value="all">All Source</Option>
                <Option value="internal">Internal</Option>
                <Option value="external">External</Option>
              </Select>
              <Tooltip title={sortConfig.field === 'rebate' ? (sortConfig.direction === 'desc' ? 'Highest first' : 'Lowest first') : 'Sort by rebate'}>
                <Button 
                  size="small"
                  type={sortConfig.field === 'rebate' ? 'primary' : 'default'}
                  icon={<DollarOutlined />}
                  onClick={() => handleSort('rebate')}
                >
                  Rebate
                  {sortConfig.field === 'rebate' && (
                    <span className="ml-1">
                      {sortConfig.direction === 'desc' ? '↓' : '↑'}
                    </span>
                  )}
                </Button>
              </Tooltip>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Input allowClear value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Search tx / hash / block..." style={{ width: 320 }} prefix={<SearchOutlined />} />
          </div>
        </div>

        <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-gray-600">tx hash</th>
                  <th className="text-left py-2 px-3 text-gray-600">target tx</th>
                  <th className="text-left py-2 px-3 text-gray-600">source</th>
                  <th className="text-left py-2 px-3 text-gray-600">blockNum</th>
                  <th className="text-left py-2 px-3 text-gray-600">rebate</th>
                  <th className="text-left py-2 px-3 text-gray-600">timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const ms = String(r.timestamp).length <= 10 ? Number(r.timestamp) * 1000 : Number(r.timestamp);
                  const d = dayjs.tz(ms, timezone);
                  return (
                    <tr key={r.txHash} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 text-gray-900">
                        <a href={toExplorerTx(r.txHash)} target="_blank" rel="noreferrer" className="hover:underline">{shortHash(r.txHash)}</a>
                      </td>
                      <td className="py-2 px-3 text-gray-900">
                        {r.targetTx
                          ? <a href={toExplorerTx(r.targetTx)} target="_blank" rel="noreferrer" className="hover:underline">{shortHash(r.targetTx)}</a>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-2 px-3 text-gray-700">{r.source === 'internal' ? <Tag color="gold">internal</Tag> : <Tag color="blue">external</Tag>}</td>
                      <td className="py-2 px-3">
                        <a href={toExplorerBlock(r.blockNum)} target="_blank" rel="noreferrer" className="hover:underline">{formatNumber(r.blockNum)}</a>
                      </td>
                      <td className="py-2 px-3 font-medium text-green-600">{Number(r.profit ?? 0).toFixed(5)} BNB</td>
                      <td className="py-2 px-3 text-gray-700">{d.format('YYYY-MM-DD HH:mm:ss')} {timezoneLabel}</td>
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
                <Select size="small" style={{ width: 100 }} value={String(table.limit)} onChange={(v) => loadTable(1, Number(v), keyword)}>
                  <Option value="12">12</Option>
                  <Option value="24">24</Option>
                  <Option value="48">48</Option>
                </Select>
              </div>
              <Pagination size="small" current={table.page} pageSize={table.limit} total={table.total} showSizeChanger={false} onChange={(p) => loadTable(p, table.limit, keyword)} />
            </div>
          </div>
        </div>

        {lastUpdatedAt ? <div className="mt-3 text-right text-xs text-gray-400">{getTimeAgo(lastUpdatedAt)}</div> : null}
      </div>
    </div>
  );
}
