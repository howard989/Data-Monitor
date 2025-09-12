import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Select, Button, Tabs, Progress, Pagination, DatePicker } from 'antd';
import { PlayCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { useTimezone } from '../context/TimezoneContext';
import TimezoneSelector from './TimezoneSelector';
import DateRangePicker from './common/DateRangePicker';
import {
  fetchBlockProductionStats,
  fetchBuildersTable,
  fetchRange13Months
} from '../data/apiSandwichStats';
import ProductionMarketShareChart from './production/ProductionMarketShareChart';
import ProductionBuildersTrend from './production/ProductionBuildersTrend';
import { formatBlockTime } from '../utils/timeFormatter';
import '../css/Watermark.css';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

const { Option } = Select;

const DEFAULT_PAGE_SIZE = 12;
const PAGE_SIZE_OPTIONS = ['12', '24', '48'];

function BlockProduction() {
  const { timezone, timezoneLabel } = useTimezone();
  const [stats, setStats] = useState(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [dailyTable, setDailyTable] = useState({ rows: [], total: 0, page: 1, limit: DEFAULT_PAGE_SIZE });
  const [hourlyTable, setHourlyTable] = useState({ rows: [], total: 0, page: 1, limit: DEFAULT_PAGE_SIZE });
  const [denom, setDenom] = useState('total');
  const [tableUpdateTime, setTableUpdateTime] = useState({ daily: null, hourly: null });
  const [tableTimeRange, setTableTimeRange] = useState({ start: '', end: '' });
  const [tableTimeRangeUTC, setTableTimeRangeUTC] = useState({ start: '', end: '' });

  const [customDailyTable, setCustomDailyTable] = useState({ rows: [], total: 0, page: 1, limit: DEFAULT_PAGE_SIZE });
  const [customHourlyTable, setCustomHourlyTable] = useState({ rows: [], total: 0, page: 1, limit: DEFAULT_PAGE_SIZE });
  const [customTableUpdateTime, setCustomTableUpdateTime] = useState({ daily: null, hourly: null });
  const [activeChartTab, setActiveChartTab] = useState('share');
  const [activeResultsTab, setActiveResultsTab] = useState('daily');
  const [resultsDate, setResultsDate] = useState(() => dayjs().tz(timezone).format('YYYY-MM-DD'));

  const [resultsDailyPage, setResultsDailyPage] = useState(1);
  const [resultsHourlyPage, setResultsHourlyPage] = useState(1);

  useEffect(() => {
    const check = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const now = dayjs().utc();
    setDateRange({
      start: now.startOf('month').format('YYYY-MM-DD'),
      end: now.format('YYYY-MM-DD'),
    });
  }, []);


  const loadDaily = useCallback(async (p = dailyTable.page, l = dailyTable.limit, overrideStart = null, overrideEnd = null) => {
    try {
      const payload = { page: p, limit: l, denom };
      if (overrideStart && overrideEnd) {
        const hasTime = overrideStart.includes('T') || overrideEnd.includes('T');
        if (hasTime) { payload.start = overrideStart; payload.end = overrideEnd; }
        else { payload.startDate = overrideStart; payload.endDate = overrideEnd; }
      } else {
        payload.startDate = dateRange.start;
        payload.endDate = dateRange.end;
      }
      const res = await fetchBuildersTable('daily', payload);
      setDailyTable({ rows: res.rows || [], total: res.total || 0, page: p, limit: l });
      setTableUpdateTime(prev => ({ ...prev, daily: new Date() }));
    } catch (error) {
      console.error('Failed to load daily table:', error);
    }
  }, [dateRange.start, dateRange.end, denom]);

  const loadHourly = useCallback(async (p = hourlyTable.page, l = hourlyTable.limit, overrideStart = null, overrideEnd = null) => {
    try {
      const payload = { page: p, limit: l, denom };
      if (overrideStart && overrideEnd) {
        const hasTime = overrideStart.includes('T') || overrideEnd.includes('T');
        if (hasTime) { payload.start = overrideStart; payload.end = overrideEnd; }
        else { payload.startDate = overrideStart; payload.endDate = overrideEnd; }
      } else {
        payload.startDate = dateRange.start;
        payload.endDate = dateRange.end;
      }
      const res = await fetchBuildersTable('hourly', payload);
      setHourlyTable({ rows: res.rows || [], total: res.total || 0, page: p, limit: l });
      setTableUpdateTime(prev => ({ ...prev, hourly: new Date() }));
    } catch (error) {
      console.error('Failed to load hourly table:', error);
    }
  }, [dateRange.start, dateRange.end, denom]);



  const loadCustom = useCallback(async (p = 1, l = DEFAULT_PAGE_SIZE) => {
    if (!tableTimeRangeUTC.start || !tableTimeRangeUTC.end) return;
    const startMs = new Date(tableTimeRangeUTC.start).getTime();
    const endMs = new Date(tableTimeRangeUTC.end).getTime();
    const diffHours = (endMs - startMs) / (1000 * 60 * 60);
    const isHourly = diffHours <= 48;
    try {
      const res = await fetchBuildersTable(isHourly ? 'hourly' : 'daily', {
        start: tableTimeRangeUTC.start,
        end: tableTimeRangeUTC.end,
        page: p,
        limit: l,
        denom
      });
      if (isHourly) {
        setCustomHourlyTable({ rows: res.rows || [], total: res.total || 0, page: p, limit: l });
      } else {
        setCustomDailyTable({ rows: res.rows || [], total: res.total || 0, page: p, limit: l });
      }
      setCustomTableUpdateTime(prev => ({ ...prev, [isHourly ? 'hourly' : 'daily']: new Date() }));
    } catch (error) {
      console.error('Failed to load custom table:', error);
    }
  }, [tableTimeRangeUTC.start, tableTimeRangeUTC.end, denom]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetchBlockProductionStats(dateRange.start, dateRange.end);
      setStats(res?.data || null);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, [dateRange.start, dateRange.end]);


  const queryResultsForDay = useCallback(async () => {
    if (!resultsDate) return;
    const fmt = 'YYYY-MM-DD HH:mm';
    const startUtc = dayjs.tz(`${resultsDate} 00:00`, fmt, timezone).utc().toISOString();
    const endUtc = dayjs.tz(`${resultsDate} 23:59`, fmt, timezone).utc().toISOString();

    setResultsDailyPage(1);
    setResultsHourlyPage(1);

    await Promise.all([
      loadDaily(1, dailyTable.limit, startUtc, endUtc),
      loadHourly(1, hourlyTable.limit, startUtc, endUtc),
    ]);
  }, [resultsDate, timezone, loadDaily, loadHourly, dailyTable.limit, hourlyTable.limit]);


  const loadAllData = async () => {
    setLoading(true);
    try {
      await loadStats();
      await queryResultsForDay();
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if (denom) {
      queryResultsForDay();
    }
  }, [denom]);


  useEffect(() => {
    if (dateRange.start && dateRange.end) {
      loadAllData();
    }
  }, [dateRange.start, dateRange.end]);



  useEffect(() => {
    setTableTimeRange({ start: '', end: '' });
    setTableTimeRangeUTC({ start: '', end: '' });
    setCustomDailyTable({ rows: [], total: 0, page: 1, limit: DEFAULT_PAGE_SIZE });
    setCustomHourlyTable({ rows: [], total: 0, page: 1, limit: DEFAULT_PAGE_SIZE });
    setCustomTableUpdateTime({ daily: null, hourly: null });
  }, [timezone]);

  useEffect(() => {
    if (!tableTimeRange.start || !tableTimeRange.end) {
      setTableTimeRangeUTC({ start: '', end: '' });
      setCustomDailyTable({ rows: [], total: 0, page: 1, limit: DEFAULT_PAGE_SIZE });
      setCustomHourlyTable({ rows: [], total: 0, page: 1, limit: DEFAULT_PAGE_SIZE });
      setCustomTableUpdateTime({ daily: null, hourly: null });
      setActiveResultsTab('daily');
      return;
    }
    const fmt = 'YYYY-MM-DD HH:mm';
    const startUtc = dayjs.tz(tableTimeRange.start, fmt, timezone).utc().toISOString();
    const endUtc = dayjs.tz(tableTimeRange.end, fmt, timezone).utc().toISOString();
    setTableTimeRangeUTC({ start: startUtc, end: endUtc });
  }, [tableTimeRange.start, tableTimeRange.end, timezone]);

  useEffect(() => {
    if (tableTimeRangeUTC.start && tableTimeRangeUTC.end) {
      loadCustom();
      setActiveResultsTab('custom');
    }
  }, [tableTimeRangeUTC.start, tableTimeRangeUTC.end, denom, loadCustom]);

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


  const setMonthPreset = (preset) => {
    const now = dayjs().utc();
    const target = preset === 'prev' ? now.subtract(1, 'month') : now;
    const start = target.startOf('month').format('YYYY-MM-DD');
    const end = (preset === 'current' ? now : target.endOf('month')).format('YYYY-MM-DD');
    setDateRange({ start, end });
  };

  const compactRangeLabel = (start, end) => {
    if (!start || !end) return '';
    const sMs = Date.parse(`${start}T00:00:00Z`);
    const eMs = Date.parse(`${end}T00:00:00Z`);
    const fmt = (ms, opts) => new Intl.DateTimeFormat('en-US', { ...opts, timeZone: timezone }).format(ms);

    if (start === end) {
      return fmt(sMs, { year: 'numeric', month: 'short', day: 'numeric' });
    }
    if (start.slice(0, 7) === end.slice(0, 7)) {
      return `${fmt(sMs, { month: 'short', day: 'numeric' })}–${fmt(eMs, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return `${fmt(sMs, { year: 'numeric', month: 'short', day: 'numeric' })} – ${fmt(eMs, { year: 'numeric', month: 'short', day: 'numeric' })}`;
  };


  const renderCards = (interval, loadFunc, customTableData = null, setCustomTableData = null, customUpdateTime = null) => {
    const isHourly = interval === 'hourly';
    const isCustom = customTableData !== null;
    const tableData = isCustom ? customTableData : (isHourly ? hourlyTable : dailyTable);
    const updateTime = isCustom ? customUpdateTime : tableUpdateTime;

    let overrideStart = null;
    let overrideEnd = null;
    if (!isCustom && resultsDate) {
      const fmt = 'YYYY-MM-DD HH:mm';
      overrideStart = dayjs.tz(`${resultsDate} 00:00`, fmt, timezone).utc().toISOString();
      overrideEnd = dayjs.tz(`${resultsDate} 23:59`, fmt, timezone).utc().toISOString();
    }

    const callLoad = (page, pageSize) => {
      if (overrideStart && overrideEnd) {
        loadFunc(page, pageSize, overrideStart, overrideEnd);
      } else {
        loadFunc(page, pageSize);
      }
    };

    const currentPage = isCustom
      ? tableData.page
      : (isHourly ? resultsHourlyPage : resultsDailyPage);

    const setCurrentPage = (page) => {
      if (!isCustom) {
        if (isHourly) setResultsHourlyPage(page);
        else setResultsDailyPage(page);
      } else if (setCustomTableData) {
        setCustomTableData(prev => ({ ...prev, page }));
      }
    };

    const setCurrentPageAndSize = (page, size) => {
      if (!isCustom) {
        if (isHourly) {
          setResultsHourlyPage(page);
        } else {
          setResultsDailyPage(page);
        }
      } else if (setCustomTableData) {
        setCustomTableData(prev => ({ ...prev, page, limit: size }));
      }
    };

    return (
      <div>
        <div className="flex justify-between items-center mb-3">
          <div className="text-sm text-gray-500">{formatNumber(tableData.total)} rows</div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tableData.rows.map((r, i) => {
            const dateStr = formatBlockTime(
              r.block_date.includes('T') || r.block_date.endsWith('Z') ? r.block_date : r.block_date.replace(' ', 'T') + 'Z',
              timezone,
              r.block_date.includes(':') ? 'full' : 'date'
            );
            const ms = Math.max(0, Math.min(100, Number(r.market_share || 0)));
            return (
              <div key={i} className="border border-gray-200 rounded-xl p-4 bg-white hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-gray-500">{dateStr}</div>
                    <div className="text-base font-semibold text-gray-900 mt-1">{r.brand}</div>
                  </div>
                  <Progress
                    type="circle"
                    percent={+ms.toFixed(1)}
                    size={56}
                    strokeColor="#F3BA2F"
                    format={(p) => `${(p ?? 0).toFixed(1)}%`}
                  />
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Blocks</span>
                    <span className="font-medium text-gray-900">{formatNumber(r.blocks)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Integrated Validators</span>
                    <span className="font-medium text-gray-900">{formatNumber(r.integrated_validators)}</span>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="w-full h-2 bg-gray-100 rounded">
                    <div className="h-2 rounded bg-yellow-400 transition-all duration-300" style={{ width: `${ms}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <Pagination
            size="small"
            current={currentPage}
            pageSize={tableData.limit}
            total={tableData.total}
            showSizeChanger
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            showTotal={(t, range) => `${range[0]}-${range[1]} of ${t}`}
            onChange={(page, pageSize) => {
              setCurrentPage(page);
              callLoad(page, pageSize);
            }}
            onShowSizeChange={(_, pageSize) => {
              setCurrentPageAndSize(1, pageSize);
              callLoad(1, pageSize);
            }}
          />
        </div>

        {updateTime && updateTime[isHourly ? 'hourly' : 'daily'] && (
          <div className="mt-4 text-right text-xs text-gray-400" title={`Last Updated: ${updateTime[isHourly ? 'hourly' : 'daily'].toLocaleString()}`}>
            {getTimeAgo(updateTime[isHourly ? 'hourly' : 'daily'])}
          </div>
        )}
      </div>
    );
  };


  const resetCustomRange = () => {
    setTableTimeRange({ start: '', end: '' });
  };

  const quickSetRange = (days) => {
    const end = dayjs().utc().format('YYYY-MM-DD');
    const start = dayjs().utc().subtract(days, 'day').format('YYYY-MM-DD');
    setDateRange({ start, end });
  };



  const resultTabs = [
    {
      key: 'daily',
      label: 'Daily',
      children: (() => {
        const byBuilder = new Map();
        (dailyTable.rows || []).forEach(r => {
          const name = (r.builder_group ?? r.brand ?? 'Unknown').trim();
          const v = Number(r.blocks || 0);
          byBuilder.set(name, (byBuilder.get(name) || 0) + v);
        });

        let slices = Array.from(byBuilder.entries()).map(([name, value]) => ({ name, value }));
        slices.sort((a, b) => b.value - a.value);

        const MAX_SLICES = 10;
        const total = slices.reduce((s, e) => s + e.value, 0);
        if (slices.length > MAX_SLICES) {
          const top = slices.slice(0, MAX_SLICES);
          const restSum = slices.slice(MAX_SLICES).reduce((s, e) => s + e.value, 0);
          if (restSum > 0) top.push({ name: 'Other', value: restSum });
          slices = top;
        }


        const PALETTE = [
          '#FFC801', '#5470c6', '#91cc75', '#fac858', '#ee6666',
          '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc',
          '#a0a7e6', '#c4ccd3'
        ];

        const dayTitle = resultsDate ? dayjs(resultsDate).tz(timezone).format('YYYY-MM-DD') : '';
        const option = {
          color: PALETTE,
          title: {
            text: 'Daily Market Share',
            subtext: dayTitle,
            left: 'center',
            top: 8,
            textStyle: { fontSize: 14, fontWeight: 600 },
            subtextStyle: { color: '#6b7280', fontSize: 12 }
          },
          tooltip: {
            trigger: 'item',
            formatter: (p) => {
              const val = Number(p.value || 0);
              const pct = (p.percent ?? 0).toFixed(1);
              return `${p.name}<br/>Blocks: ${val.toLocaleString()}<br/>Share: ${pct}%`;
            }
          },
          legend: {
            type: 'scroll',
            orient: 'vertical',
            right: 0,
            top: 'middle',
            height: 300,
            itemWidth: 12,
            itemHeight: 12,
            textStyle: { fontSize: 12 },
            data: slices.map(s => s.name)
          },
          series: [{
            name: 'Blocks',
            type: 'pie',
            radius: ['42%', '68%'],
            center: ['38%', '55%'],
            data: slices,
            minAngle: 3,
            avoidLabelOverlap: true,
            label: {
              show: true,
              formatter: (p) => {
                const pct = (p.percent ?? 0).toFixed(1);
                return `${p.name}\n${pct}%`;
              },
              fontSize: 12,
              lineHeight: 16
            },
            labelLine: {
              show: true,
              length: 12,
              length2: 10,
              smooth: true
            },
            emphasis: {
              scale: true,
              scaleSize: 6,
              itemStyle: {
                shadowBlur: 18,
                shadowColor: 'rgba(0,0,0,0.25)'
              },
              label: {
                fontSize: 13,
                fontWeight: 'bold'
              }
            },
            animation: true,
            animationDuration: 600,
            animationEasing: 'cubicOut'
          }],
          grid: { containLabel: false }
        };

        return (
          <div>
            {slices.length > 0 ? (
              <ReactECharts option={option} style={{ height: '420px', width: '100%' }} />
            ) : (
              <div className="text-center text-gray-500 py-8">No data available</div>
            )}
          </div>
        );
      })()
    },
    { key: 'hourly', label: 'Hourly', children: renderCards('hourly', loadHourly) }
  ];
  if (tableTimeRangeUTC.start && tableTimeRangeUTC.end) {
    const startMs = new Date(tableTimeRangeUTC.start).getTime();
    const endMs = new Date(tableTimeRangeUTC.end).getTime();
    const diffHours = (endMs - startMs) / (1000 * 60 * 60);
    const showHourly = diffHours <= 48;
    resultTabs.push({
      key: 'custom',
      label: 'Custom',
      children: (
        <div>
          <p className="text-sm text-gray-600 mb-4">
            Showing {showHourly ? 'hourly' : 'daily'} data from {dayjs(tableTimeRangeUTC.start).tz(timezone).format('YYYY-MM-DD HH:mm')} to {dayjs(tableTimeRangeUTC.end).tz(timezone).format('YYYY-MM-DD HH:mm')}
          </p>
          {renderCards(
            showHourly ? 'hourly' : 'daily',
            loadCustom,
            showHourly ? customHourlyTable : customDailyTable,
            showHourly ? setCustomHourlyTable : setCustomDailyTable,
            customTableUpdateTime
          )}
        </div>
      )
    });
  }

  return (
    <div className={`min-h-screen watermark-container ${isMobile ? 'p-4' : 'p-8 mx-auto max-w-[1280px]'}`}>
      <div className="flex justify-between items-center mb-4">
        <nav className="text-sm text-gray-600">
          <Link to="/data-center" className="text-[#F3BA2F] hover:underline">Data Center</Link>
          <span className="mx-2">/</span>
          <span>Block Stats</span>
        </nav>
        {dateRange.start && dateRange.end && (
          <div className="text-sm text-gray-600">
            Date Range: {compactRangeLabel(dateRange.start, dateRange.end)} ({timezoneLabel})
          </div>
        )}
      </div>

      <hr className="my-4 border-t border-gray-300" />

      <div className="flex items-start justify-between mb-3">
        <h1 className={`${isMobile ? 'text-xl' : 'text-2xl md:text-3xl'} font-bold text-gray-800`}>MEV Builders Stats</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-9 order-2 lg:order-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className={`${isMobile ? 'text-3xl' : 'text-4xl'} font-bold text-yellow-400 mb-2 text-center`}>
                {stats ? formatNumber(stats.builder_blocks) : '—'}
              </div>
              <div className="text-sm text-gray-600 font-medium text-center">MEV_Blocks_24H</div>
              <div className="text-xs text-gray-400 mt-1 text-center">@bnbchain</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
              <div className={`${isMobile ? 'text-3xl' : 'text-4xl'} font-bold text-gray-900 mb-2`}>
                {stats ? formatNumber(stats.total_blocks) : '—'}
              </div>
              <div className="text-sm text-gray-600 font-medium">Total_MEV_Blocks</div>
              <div className="text-xs text-gray-400 mt-1">@bnbchain</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
              <div className={`${isMobile ? 'text-3xl' : 'text-4xl'} font-bold text-red-500 mb-2`}>
                {stats ? formatNumber(stats.total_builders) : '—'}
              </div>
              <div className="text-sm text-gray-600 font-medium">Total_Builders</div>
              <div className="text-xs text-gray-400 mt-1">@bnbchain</div>
            </div>
          </div>

          {dateRange.start && dateRange.end && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 mb-8">
              <h2 className="relative pl-3 text-base font-semibold text-gray-900 mb-4 leading-6">
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 bg-yellow-400"
                ></span>
                Charts
              </h2>
              <div className="flex gap-2">
                <Button size="small" type="primary" onClick={() => setMonthPreset('current')}>This Month</Button>
                <Button size="small" onClick={() => setMonthPreset('prev')}>Last Month</Button>
              </div>
              <Tabs
                activeKey={activeChartTab}
                onChange={(key) => {
                  setActiveChartTab(key);
                  setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
                }}
                destroyInactiveTabPane={false}
                animated={false}
                items={[
                  {
                    key: 'share',
                    label: 'Market Share',
                    children: (
                      <ProductionMarketShareChart
                        startDate={dateRange.start}
                        endDate={dateRange.end}
                        interval="daily"
                        height={360}
                      />
                    )
                  },
                  {
                    key: 'trend',
                    label: 'Trend by Builders',
                    children: (
                      <ProductionBuildersTrend
                        startDate={dateRange.start}
                        endDate={dateRange.end}
                        interval="daily"
                        height={360}
                      />
                    )
                  }
                ]}
              />
            </div>
          )}


          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2 className="relative pl-3 text-base font-semibold text-gray-900 leading-6">
                <span aria-hidden className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 bg-yellow-400"></span>
                Results
              </h2>

              <div className="flex flex-wrap items-center gap-3">
                <DatePicker
                  size="small"
                  value={resultsDate ? dayjs(resultsDate) : null}
                  onChange={(date) => setResultsDate(date ? date.format('YYYY-MM-DD') : null)}
                  format="YYYY-MM-DD"
                />
                <Button size="small" onClick={queryResultsForDay}>QUERY</Button>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Denominator</span>
                  <Select
                    size="small"
                    value={denom}
                    onChange={setDenom}
                    style={{ width: 140 }}
                  >
                    <Option value="total">All blocks</Option>
                    <Option value="builder">Builder blocks</Option>
                  </Select>
                </div>
              </div>
            </div>
            <Tabs
              activeKey={activeResultsTab}
              onChange={setActiveResultsTab}
              destroyInactiveTabPane={false}
              animated={false}
              items={resultTabs}
            />
          </div>
        </div>

        <div className="lg:col-span-3 order-1 lg:order-2">
          <div className="sticky top-0 space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-600">Controls</div>
                <div className="text-xs text-gray-500">{timezoneLabel}</div>
              </div>
              <div className="flex gap-2 mb-3">
                <Button
                  type="primary"
                  onClick={loadAllData}
                  disabled={loading}
                  icon={loading ? <LoadingOutlined /> : <PlayCircleOutlined />}
                  block
                >
                  {loading ? 'Loading...' : 'RUN'}
                </Button>
              </div>
              <div className="mb-3">
                <TimezoneSelector />
              </div>
              <div className="mb-3">
                <div className="text-sm text-gray-600 mb-2">Quick Range</div>
                <div className="grid grid-cols-3 gap-2">
                  <Button onClick={() => quickSetRange(7)} size="small">7D</Button>
                  <Button onClick={() => quickSetRange(30)} size="small">30D</Button>
                  <Button onClick={() => quickSetRange(90)} size="small">90D</Button>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="relative pl-3 text-base font-semibold text-gray-900 mb-3 leading-6">
                <span aria-hidden className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 bg-yellow-400"></span>
                Custom Time Range
              </h2>
              <div className="mb-2 text-xs text-gray-500">Timezone: {timezoneLabel}</div>
              <DateRangePicker
                value={tableTimeRange}
                onChange={setTableTimeRange}
                format="YYYY-MM-DD HH:mm"
                showTime={{ format: 'HH:mm' }}
                allowClear
                timezone={timezone}
                className="w-full"
              />
              <div className="mt-3">
                <Button onClick={resetCustomRange} disabled={!tableTimeRange.start && !tableTimeRange.end} block>Reset</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BlockProduction;