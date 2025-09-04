import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Select, Spin } from 'antd';
import { PlayCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { useTimezone } from '../context/TimezoneContext';
import TimezoneSelector from './TimezoneSelector';
import DateRangePicker from './common/DateRangePicker';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

import { 
  fetchBlockProductionStats, 
  fetchBuildersTable,  
  fetchRange13Months
} from '../data/apiSandwichStats';
import ProductionPctChart from './production/ProductionPctChart';
import ProductionMarketShareChart from './production/ProductionMarketShareChart';
import ProductionBuildersTrend from './production/ProductionBuildersTrend';
import { formatBlockTime } from '../utils/timeFormatter';
import '../css/Watermark.css';

const { Option } = Select;

function BlockProduction() {
  const { timezone, timezoneLabel } = useTimezone();
  const [stats, setStats] = useState(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [dailyTable, setDailyTable] = useState({ rows: [], total: 0, page: 1, limit: 25 });
  const [hourlyTable, setHourlyTable] = useState({ rows: [], total: 0, page: 1, limit: 25 });
  const [denom, setDenom] = useState('total');
  const [tableUpdateTime, setTableUpdateTime] = useState({ daily: null, hourly: null });
  const [tableTimeRange, setTableTimeRange] = useState({ start: '', end: '' });
  const [tableTimeRangeUTC, setTableTimeRangeUTC] = useState({ start: '', end: '' });
  

  const [customDailyTable, setCustomDailyTable] = useState({ rows: [], total: 0, page: 1, limit: 25 });
  const [customHourlyTable, setCustomHourlyTable] = useState({ rows: [], total: 0, page: 1, limit: 25 });
  const [customTableUpdateTime, setCustomTableUpdateTime] = useState({ daily: null, hourly: null });

  useEffect(() => {
    const check = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchRange13Months();
        const { startDate, endDate } = r.data || {};
        setDateRange({ start: startDate, end: endDate });
      } catch (e) {
        console.error('Failed to get default range:', e);
      }
    })();
  }, []);

  const loadDaily = useCallback(async (p = dailyTable.page, l = dailyTable.limit) => {
    try {
      const res = await fetchBuildersTable('daily', {
        startDate: dateRange.start,
        endDate: dateRange.end,
        page: p, 
        limit: l, 
        denom
      });
      setDailyTable({ 
        rows: res.rows || [], 
        total: res.total || 0, 
        page: p, 
        limit: l 
      });
      setTableUpdateTime(prev => ({ ...prev, daily: new Date() }));
    } catch (error) {
      console.error('Failed to load daily table:', error);
    }
  }, [dateRange.start, dateRange.end, denom, dailyTable.page, dailyTable.limit]);

  const loadHourly = useCallback(async (p = hourlyTable.page, l = hourlyTable.limit) => {
    try {
      const res = await fetchBuildersTable('hourly', {
        startDate: dateRange.start,
        endDate: dateRange.end,
        page: p, 
        limit: l, 
        denom
      });
      setHourlyTable({ 
        rows: res.rows || [], 
        total: res.total || 0, 
        page: p, 
        limit: l 
      });
      setTableUpdateTime(prev => ({ ...prev, hourly: new Date() }));
    } catch (error) {
      console.error('Failed to load hourly table:', error);
    }
  }, [dateRange.start, dateRange.end, denom, hourlyTable.page, hourlyTable.limit]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetchBlockProductionStats(dateRange.start, dateRange.end);
      setStats(res?.data || null);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, [dateRange.start, dateRange.end]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadStats(),
        loadDaily(1, dailyTable.limit),
        loadHourly(1, hourlyTable.limit)
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (denom) {
      loadDaily();
      loadHourly();
    }
  }, [denom, loadDaily, loadHourly]);

  
  useEffect(() => {
    if (dateRange.start && dateRange.end) {
      loadAllData();
    }
  }, [dateRange.start, dateRange.end]);



  useEffect(() => {
    setTableTimeRange({ start: '', end: '' });
    setTableTimeRangeUTC({ start: '', end: '' });
    setCustomDailyTable({ rows: [], total: 0, page: 1, limit: 25 });
    setCustomHourlyTable({ rows: [], total: 0, page: 1, limit: 25 });
    setCustomTableUpdateTime({ daily: null, hourly: null });
  }, [timezone]);

  const formatNumber = (n) => new Intl.NumberFormat('en-US').format(Number(n || 0));

  const getTimeAgo = (date) => {
    if (!date) return '';
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); 
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr`;
    return `${Math.floor(diff / 86400)} days`;
  };

  const compactRangeLabel = (start, end) => {
    if (!start || !end) return '';
    const sMs = Date.parse(`${start}T00:00:00Z`);
    const eMs = Date.parse(`${end}T00:00:00Z`);
    const fmt = (ms, opts) => new Intl.DateTimeFormat('en-US', { ...opts, timeZone: timezone }).format(ms);

    if (start === end) {
      return fmt(sMs, { year:'numeric', month:'short', day:'numeric' });
    }
    if (start.slice(0,7) === end.slice(0,7)) {
      return `${fmt(sMs, { month:'short', day:'numeric' })}–${fmt(eMs, { month:'short', day:'numeric', year:'numeric' })}`;
    }
    return `${fmt(sMs, { year:'numeric', month:'short', day:'numeric' })} – ${fmt(eMs, { year:'numeric', month:'short', day:'numeric' })}`;
  };

  const renderTable = (title, interval, loadFunc, customTableData = null, setCustomTableData = null, customUpdateTime = null) => {
    const isHourly = interval === 'hourly';
    const isCustom = customTableData !== null;
    const tableData = isCustom 
      ? customTableData 
      : (isHourly ? hourlyTable : dailyTable);
    const updateTime = isCustom
      ? customUpdateTime
      : tableUpdateTime;
    
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 mb-6 relative">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-semibold text-gray-900">
            MEV Builders Stats — {title}
          </h3>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">Denominator:</span>
            <Select 
              size="small" 
              value={denom} 
              onChange={(v) => setDenom(v)} 
              style={{ width: 120 }}
            >
              <Option value="total">All blocks</Option>
              <Option value="builder">Builder blocks</Option>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="max-h-[600px] overflow-y-auto border border-gray-200 rounded-lg">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-2 px-2 text-gray-600 font-medium">block_date</th>
                  <th className="text-left py-2 px-2 text-gray-600 font-medium">brand</th>
                  <th className="text-left py-2 px-2 text-gray-600 font-medium">blocks</th>
                  <th className="text-left py-2 px-2 text-gray-600 font-medium">integrated_validators</th>
                  <th className="text-left py-2 px-2 text-gray-600 font-medium">market_share</th>
                </tr>
              </thead>
              <tbody>
                {tableData.rows.map((r, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-2 px-2 text-gray-700">{formatBlockTime(r.block_date.includes('T') || r.block_date.endsWith('Z') ? r.block_date : r.block_date.replace(' ', 'T') + 'Z', timezone, r.block_date.includes(':') ? 'full' : 'date')}</td>
                    <td className="py-2 px-2 text-gray-800 font-medium">{r.brand}</td>
                    <td className="py-2 px-2 text-gray-700">{formatNumber(r.blocks)}</td>
                    <td className="py-2 px-2 text-gray-700">{formatNumber(r.integrated_validators)}</td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-28 h-2 bg-gray-100 rounded overflow-hidden">
                          <div 
                            className="h-2 bg-gradient-to-r from-[#FFC801] to-[#FFD829] rounded transition-all duration-300"
                            style={{ width: `${Math.min(100, Number(r.market_share || 0))}%` }}
                          />
                        </div>
                        <span className="text-amber-600 font-semibold">
                          {Number(r.market_share || 0).toFixed(2)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-between items-center mt-4 text-sm text-gray-600">
          <span>{formatNumber(tableData.total)} rows</span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span>Rows/page:</span>
              <Select
                size="small"
                value={tableData.limit}
                onChange={(l) => loadFunc(1, l)}
                style={{ width: 80 }}
              >
                <Option value={25}>25</Option>
                <Option value={50}>50</Option>
                <Option value={100}>100</Option>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (tableData.page > 1) {
                    loadFunc(tableData.page - 1, tableData.limit);
                    if (isCustom && setCustomTableData) {
                      setCustomTableData(prev => ({ ...prev, page: tableData.page - 1 }));
                    }
                  }
                }}
                className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors"
                disabled={tableData.page <= 1}
              >
                ‹ Prev
              </button>
              <span>Page {tableData.page} of {Math.ceil(tableData.total / tableData.limit) || 1}</span>
              <button
                onClick={() => {
                  if (tableData.page * tableData.limit < tableData.total) {
                    loadFunc(tableData.page + 1, tableData.limit);
                    if (isCustom && setCustomTableData) {
                      setCustomTableData(prev => ({ ...prev, page: tableData.page + 1 }));
                    }
                  }
                }}
                className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors"
                disabled={tableData.page * tableData.limit >= tableData.total}
              >
                Next ›
              </button>
            </div>
          </div>
        </div>
        
        {updateTime && updateTime[isHourly ? 'hourly' : 'daily'] && (
          <div className="absolute bottom-2 right-2 text-xs text-gray-400" 
               title={`Last Updated: ${updateTime[isHourly ? 'hourly' : 'daily'].toLocaleString()}`}>
            {getTimeAgo(updateTime[isHourly ? 'hourly' : 'daily'])}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`min-h-screen watermark-container ${isMobile ? 'p-4' : 'p-8 mx-auto max-w-[1140px]'}`}>
      <div className="flex justify-between items-center mb-4">
        <nav className="text-sm text-gray-600">
          <Link to="/data-center" className="text-[#F3BA2F] hover:underline">Data Center</Link>
          <span className="mx-2">/</span>
          <span>Block Stats</span>
        </nav>
      </div>

      <hr className="my-4 border-t border-gray-300" />

      <div className={`flex ${isMobile ? 'flex-col' : 'justify-between items-start'} gap-3 mb-6`}>
        <div>
          <h1 className={`${isMobile ? 'text-xl' : 'text-2xl md:text-3xl'} font-bold text-gray-800 mb-2`}>
            MEV Builders Stats
          </h1>
          {dateRange.start && dateRange.end && (
            <p className="text-sm text-gray-600 mt-2">
              Date Range: {compactRangeLabel(dateRange.start, dateRange.end)} ({timezoneLabel})
            </p>
          )}
        </div>
        <div className={`flex ${isMobile ? 'w-full justify-between' : 'items-center'} gap-3`}>
          <button
            onClick={loadAllData}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              loading
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-[#FFC801] text-[#1E1E1E] hover:bg-[#FFD829] hover:shadow-md'
            }`}
          >
            {loading ? (
              <>
                <LoadingOutlined className="text-lg" />
                <span>Loading...</span>
              </>
            ) : (
              <>
                <PlayCircleOutlined className="text-lg" />
                <span>RUN</span>
              </>
            )}
          </button>
          <TimezoneSelector />
        </div>
      </div>


      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
          <div className={`${isMobile ? 'text-3xl' : 'text-4xl'} font-bold text-gray-900 mb-2`}>
            {stats ? formatNumber(stats.total_blocks) : '—'}
          </div>
          <div className="text-sm text-gray-600 font-medium">Total_MEV_Blocks</div>
          <div className="text-xs text-gray-400 mt-1">@bnbchain</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
          <div className={`${isMobile ? 'text-3xl' : 'text-4xl'} font-bold text-gray-900 mb-2`}>
            {stats ? formatNumber(stats.total_builders) : '—'}
          </div>
          <div className="text-sm text-gray-600 font-medium">Total_Builders</div>
          <div className="text-xs text-gray-400 mt-1">@bnbchain</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
          <div className={`${isMobile ? 'text-3xl' : 'text-4xl'} font-bold text-gray-900 mb-2`}>
            {stats ? formatNumber(stats.builder_blocks) : '—'}
          </div>
          <div className="text-sm text-gray-600 font-medium">MEV_Blocks_24H</div>
          <div className="text-xs text-gray-400 mt-1">@bnbchain</div>
        </div>
      </div>


      {dateRange.start && dateRange.end && (
        <>
          <ProductionPctChart
            startDate={dateRange.start}
            endDate={dateRange.end}
            interval="daily"
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <ProductionMarketShareChart
              startDate={dateRange.start}
              endDate={dateRange.end}
              interval="daily"
            />
            <ProductionBuildersTrend
              startDate={dateRange.start}
              endDate={dateRange.end}
              interval="daily"
            />
          </div>
        </>
      )}

   
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 mb-6">
        <h2 className="relative pl-3 text-base font-semibold text-gray-900 mb-4 leading-6">
          <span aria-hidden className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 bg-yellow-400"></span>
          Custom Time Range Query ({timezoneLabel})
        </h2>
        <div className={`flex ${isMobile ? 'flex-col' : 'sm:flex-row sm:items-center'} gap-2 sm:gap-3 mb-4`}>
          <label className="text-sm text-gray-600">DateTime Range:</label>
          <div className={`${isMobile ? 'w-full' : 'flex-1 max-w-md'}`}>
            <DateRangePicker
              value={tableTimeRange}
              onChange={setTableTimeRange}
              format="YYYY-MM-DD HH:mm"
              showTime={{ format: 'HH:mm' }}
              allowClear
              timezone={timezone}
              className="w-full"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!tableTimeRange.start || !tableTimeRange.end) return;
                const fmt = 'YYYY-MM-DD HH:mm';
                
       
                const startParsed = dayjs.tz(tableTimeRange.start, fmt, timezone);
                const endParsed = dayjs.tz(tableTimeRange.end, fmt, timezone);
                
             
                const startUtc = startParsed.utc().toISOString();
                const endUtc = endParsed.utc().toISOString();
                
       
                console.log('Time conversion:', {
                  input: { start: tableTimeRange.start, end: tableTimeRange.end },
                  timezone: timezone,
                  parsed: { start: startParsed.format(), end: endParsed.format() },
                  utc: { start: startUtc, end: endUtc }
                });
                
                setTableTimeRangeUTC({ start: startUtc, end: endUtc });
                
          
                const startMs = new Date(startUtc).getTime();
                const endMs = new Date(endUtc).getTime();
                const diffHours = (endMs - startMs) / (1000 * 60 * 60);
                
        
                if (diffHours <= 48) {
                  fetchBuildersTable('hourly', {
                    start: startUtc,
                    end: endUtc,
                    page: 1,
                    limit: 25,
                    denom
                  }).then(res => {
                    console.log('Hourly response:', res);
                    setCustomHourlyTable({
                      rows: res.rows || [],
                      total: res.total || 0,
                      page: 1,
                      limit: 25
                    });
                    setCustomTableUpdateTime(prev => ({ ...prev, hourly: new Date() }));
                  }).catch(err => {
                    console.error('Failed to load hourly:', err);
                  });
                } else {
                  fetchBuildersTable('daily', {
                    start: startUtc,
                    end: endUtc,
                    page: 1,
                    limit: 25,
                    denom
                  }).then(res => {
                    console.log('Daily response:', res);
                    setCustomDailyTable({
                      rows: res.rows || [],
                      total: res.total || 0,
                      page: 1,
                      limit: 25
                    });
                    setCustomTableUpdateTime(prev => ({ ...prev, daily: new Date() }));
                  }).catch(err => {
                    console.error('Failed to load daily:', err);
                  });
                }
              }}
              disabled={!tableTimeRange.start || !tableTimeRange.end}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                tableTimeRange.start && tableTimeRange.end
                  ? 'bg-[#FFC801] text-[#1E1E1E] hover:bg-[#FFD829] hover:shadow-md'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Apply
            </button>
            <button
              onClick={() => {
                setTableTimeRange({ start: '', end: '' });
                setTableTimeRangeUTC({ start: '', end: '' });
                setCustomDailyTable({ rows: [], total: 0, page: 1, limit: 25 });
                setCustomHourlyTable({ rows: [], total: 0, page: 1, limit: 25 });
                setCustomTableUpdateTime({ daily: null, hourly: null });
              }}
              className="px-3 py-2 text-sm bg-gray-50 text-gray-600 rounded hover:bg-gray-100"
            >
              Reset
            </button>
          </div>
        </div>

 
        {tableTimeRangeUTC.start && tableTimeRangeUTC.end && (() => {
          const startMs = new Date(tableTimeRangeUTC.start).getTime();
          const endMs = new Date(tableTimeRangeUTC.end).getTime();
          const diffHours = (endMs - startMs) / (1000 * 60 * 60);
          const showHourly = diffHours <= 48;
          
          return (
            <>
              <div className="border-t border-gray-200 pt-4 mt-4">
                <p className="text-sm text-gray-600 mb-4">
                  Showing {showHourly ? 'hourly' : 'daily'} data from {dayjs(tableTimeRangeUTC.start).tz(timezone).format('YYYY-MM-DD HH:mm')} to {dayjs(tableTimeRangeUTC.end).tz(timezone).format('YYYY-MM-DD HH:mm')}
                </p>
                
                <div className="overflow-x-auto">
                  <div className="max-h-[400px] overflow-y-auto border border-gray-200 rounded-lg">
                    {showHourly 
                      ? (() => {
                          const tableData = customHourlyTable;
                          return (
                            <table className="w-full min-w-[760px] text-sm">
                              <thead className="sticky top-0 z-10">
                                <tr className="border-b border-gray-200 bg-gray-50">
                                  <th className="text-left py-2 px-2 text-gray-600 font-medium">block_date</th>
                                  <th className="text-left py-2 px-2 text-gray-600 font-medium">brand</th>
                                  <th className="text-left py-2 px-2 text-gray-600 font-medium">blocks</th>
                                  <th className="text-left py-2 px-2 text-gray-600 font-medium">integrated_validators</th>
                                  <th className="text-left py-2 px-2 text-gray-600 font-medium">market_share</th>
                                </tr>
                              </thead>
                              <tbody>
                                {tableData.rows.map((r, i) => (
                                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                    <td className="py-2 px-2 text-gray-700">{formatBlockTime(r.block_date.includes('T') || r.block_date.endsWith('Z') ? r.block_date : r.block_date.replace(' ', 'T') + 'Z', timezone, r.block_date.includes(':') ? 'full' : 'date')}</td>
                                    <td className="py-2 px-2 text-gray-800 font-medium">{r.brand}</td>
                                    <td className="py-2 px-2 text-gray-700">{formatNumber(r.blocks)}</td>
                                    <td className="py-2 px-2 text-gray-700">{formatNumber(r.integrated_validators)}</td>
                                    <td className="py-2 px-2">
                                      <div className="flex items-center gap-2">
                                        <div className="w-28 h-2 bg-gray-100 rounded overflow-hidden">
                                          <div 
                                            className="h-2 bg-gradient-to-r from-[#FFC801] to-[#FFD829] rounded transition-all duration-300"
                                            style={{ width: `${Math.min(100, Number(r.market_share || 0))}%` }}
                                          />
                                        </div>
                                        <span className="text-amber-600 font-semibold">
                                          {Number(r.market_share || 0).toFixed(2)}%
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          );
                        })()
                      : (() => {
                          const tableData = customDailyTable;
                          return (
                            <table className="w-full min-w-[760px] text-sm">
                              <thead className="sticky top-0 z-10">
                                <tr className="border-b border-gray-200 bg-gray-50">
                                  <th className="text-left py-2 px-2 text-gray-600 font-medium">block_date</th>
                                  <th className="text-left py-2 px-2 text-gray-600 font-medium">brand</th>
                                  <th className="text-left py-2 px-2 text-gray-600 font-medium">blocks</th>
                                  <th className="text-left py-2 px-2 text-gray-600 font-medium">integrated_validators</th>
                                  <th className="text-left py-2 px-2 text-gray-600 font-medium">market_share</th>
                                </tr>
                              </thead>
                              <tbody>
                                {tableData.rows.map((r, i) => (
                                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                    <td className="py-2 px-2 text-gray-700">{formatBlockTime(r.block_date.includes('T') || r.block_date.endsWith('Z') ? r.block_date : r.block_date.replace(' ', 'T') + 'Z', timezone, r.block_date.includes(':') ? 'full' : 'date')}</td>
                                    <td className="py-2 px-2 text-gray-800 font-medium">{r.brand}</td>
                                    <td className="py-2 px-2 text-gray-700">{formatNumber(r.blocks)}</td>
                                    <td className="py-2 px-2 text-gray-700">{formatNumber(r.integrated_validators)}</td>
                                    <td className="py-2 px-2">
                                      <div className="flex items-center gap-2">
                                        <div className="w-28 h-2 bg-gray-100 rounded overflow-hidden">
                                          <div 
                                            className="h-2 bg-gradient-to-r from-[#FFC801] to-[#FFD829] rounded transition-all duration-300"
                                            style={{ width: `${Math.min(100, Number(r.market_share || 0))}%` }}
                                          />
                                        </div>
                                        <span className="text-amber-600 font-semibold">
                                          {Number(r.market_share || 0).toFixed(2)}%
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          );
                        })()
                    }
                  </div>
                </div>
              </div>
            </>
          );
        })()}
      </div>

      {renderTable('Daily', 'daily', loadDaily)}
      {renderTable('Hourly', 'hourly', loadHourly)}
    </div>
  );
}

export default BlockProduction;