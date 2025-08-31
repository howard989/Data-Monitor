/* global BigInt */
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { authFetch, API_URL } from '../data/apiClient';
import { fetchAttackByTx, fetchAttacksByBlock, fetchBuilderList,
  fetchSandwichStats, fetchBuilderSandwiches, fetchSandwichSearch } from '../data/apiSandwichStats';
import { useTimezone } from '../context/TimezoneContext';
import { formatBlockTime } from '../utils/timeFormatter';
import TimezoneSelector from './TimezoneSelector';
import SandwichChart from './SandwichChart';
import useBnbUsdPrice from '../hooks/useBnbUsdPrice';
import { Select, Spin, Input } from 'antd';
import DateRangePicker from './common/DateRangePicker';

const { Option } = Select;

const TOKEN_INFO = {
  '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c': { symbol: 'WBNB', decimals: 18, isStable: false },
  '0x55d398326f99059ff775485246999027b3197955': { symbol: 'USDT', decimals: 18, isStable: true },
  '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': { symbol: 'USDC', decimals: 18, isStable: true },
  '0xe9e7cea3dedca5984780bafc599bd69add087d56': { symbol: 'BUSD', decimals: 18, isStable: true },
  '0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d': { symbol: 'USD1', decimals: 18, isStable: true }
};

const bundleOptions = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Bundle only' },
  { value: 'false', label: 'Non-bundle only' },
];


const getTokenSymbol = (address) => {
  if (!address) return '-';
  const info = TOKEN_INFO[address.toLowerCase()];
  return info ? info.symbol : `${address.slice(0, 6)}…${address.slice(-4)}`;
};

const SandwichStats = () => {
  const [stats, setStats] = useState(null);
  const [recentBlocks, setRecentBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const { authToken, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { timezone } = useTimezone();
  const { bnbUsdt } = useBnbUsdPrice(5000); 



  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const [txQuery, setTxQuery] = useState('');
  const [txResults, setTxResults] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txSearched, setTxSearched] = useState(false);

  const [blockQuery, setBlockQuery] = useState('');
  const [blockResults, setBlockResults] = useState([]);
  const [blockSearched, setBlockSearched] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [blockError, setBlockError] = useState('');


  const [blockMeta, setBlockMeta] = useState(null);
  const [blockClean, setBlockClean] = useState(false);



  const [builders, setBuilders] = useState([]);
  const [selectedBuilder, setSelectedBuilder] = useState('');
  const [builderStats, setBuilderStats] = useState(null);
  
  const [showBuilderDetails, setShowBuilderDetails] = useState(false);
  const [builderSandwiches, setBuilderSandwiches] = useState([]);
  const [builderPage, setBuilderPage] = useState(1);
  const [builderTotal, setBuilderTotal] = useState(0);
  const [builderTotalPages, setBuilderTotalPages] = useState(0);
  const [builderLoading, setBuilderLoading] = useState(false);

  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [builderDateRange, setBuilderDateRange] = useState({ start: '', end: '' });


  const [filterVictimTo, setFilterVictimTo] = useState('');
  const [filterIsBundle, setFilterIsBundle] = useState('');
  const [filterProfitToken, setFilterProfitToken] = useState('');
  const [searchDateRange, setSearchDateRange] = useState({ start: '', end: '' });
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [searchLimit] = useState(50);

  const short = (addr) => (addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '-');

  const formatWei = (weiStr, decimals = 18, digits = 6) => {
    if (!weiStr) return '0';
    try {
      const bi = BigInt(weiStr);
      const base = BigInt(10) ** BigInt(decimals);
      const int = bi / base;
      let frac = (bi % base).toString().padStart(decimals, '0').slice(0, digits);
      frac = frac.replace(/0+$/, '');
      return frac.length ? `${int.toString()}.${frac}` : int.toString();
    } catch {
      const n = parseFloat(weiStr);
      if (!isFinite(n)) return '0';
      return (n / 1e18).toFixed(digits);
    }
  };

  const loadBuilders = async () => {
    const { data } = await fetchBuilderList();
    setBuilders(data || []);
  };

  const loadBuilderStats = async (name, startDate = null, endDate = null) => {
    const { data } = await fetchSandwichStats(name || null, startDate, endDate);
    setBuilderStats(data || null);
  };

  const loadBuilderSandwiches = async (builder, page, startDate = null, endDate = null) => {
    setBuilderLoading(true);
    try {
      const result = await fetchBuilderSandwiches(builder, page, 50, startDate, endDate);
      if (result.success === false && result.maxPages) {
        // Handle max pages exceeded error
        alert(result.error || `Maximum ${result.maxPages} pages allowed. Please use date filter to narrow down results.`);
        setBuilderSandwiches([]);
        setBuilderTotal(0);
        setBuilderTotalPages(0);
      } else if (result.success || result.data) {
        setBuilderSandwiches(result.data || []);
        setBuilderTotal(result.total || 0);
        setBuilderTotalPages(Math.min(result.totalPages || 0, 100)); // Cap at 100 pages
        setBuilderPage(page);
        // Update date range if returned from backend
        if (result.dateRange && !startDate && !endDate) {
          setBuilderDateRange(result.dateRange);
        }
      }
    } catch (error) {
      console.error('Error loading builder sandwiches:', error);
      setBuilderSandwiches([]);
    } finally {
      setBuilderLoading(false);
    }
  };

  const handleUnauthorized = () => {
    logout();
    navigate('/login');
  };

  const fetchStats = async (startDate = null, endDate = null) => {
    try {
      let url = `${API_URL}/api/sandwich/stats`;
      if (startDate && endDate) {
        url += `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
      }

      const statsRes = await authFetch(url, {
        method: 'GET'
      });

      if (!statsRes.ok) {
        if (statsRes.status === 401) handleUnauthorized();
        return;
      }
      const statsData = await statsRes.json();
      setStats(statsData.data);
      setLastUpdate(new Date());
    } catch (error) {
      if (error.status === 401) {
        handleUnauthorized();
      } else {
        console.error('Error fetching stats:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchBlocks = async () => {
    try {
      const blocksRes = await authFetch(`${API_URL}/api/sandwich/recent?limit=20`, {
        method: 'GET'
      });
      if (!blocksRes.ok) {
        if (blocksRes.status === 401) handleUnauthorized();
        return;
      }
      const blocksData = await blocksRes.json();
      setRecentBlocks(blocksData.data);
    } catch (error) {
      if (error.status === 401) {
        handleUnauthorized();
      } else {
        console.error('Error fetching blocks:', error);
      }
    }
  };

  const onSearchTx = async () => {
    if (!txQuery) return;
    setTxLoading(true);
    setTxSearched(true);
    try {
      const { data } = await fetchAttackByTx(txQuery.trim());
      setTxResults(data || []);
    } catch {
      setTxResults([]);
    } finally {
      setTxLoading(false);
    }
  };

  const onClearTx = () => {
    setTxQuery('');
    setTxResults([]);
    setTxSearched(false);
  };

  const onSearchBlock = async () => {
    if (!blockQuery) return;
    setBlockLoading(true);
    setBlockSearched(true);
    setBlockError('');
    setBlockMeta(null);
    setBlockClean(false);
    try {
      const res = await fetchAttacksByBlock(blockQuery.trim());
      const { data, is_clean, meta } = res || {};
      setBlockResults(data || []);
      setBlockMeta(meta || null);
      setBlockClean(!!is_clean);
    } catch (e) {
      setBlockResults([]);
      setBlockMeta(null);
      setBlockError('Query failed');
    } finally {
      setBlockLoading(false);
    }
  };

  const onClearBlock = () => {
    setBlockQuery('');
    setBlockResults([]);
    setBlockMeta(null);
    setBlockClean(false);
    setBlockError('');
    setBlockSearched(false);
  };

  const runSearch = async (page = 1) => {
    setSearchLoading(true);
    try {
      const params = { page, limit: searchLimit };
      if (filterVictimTo) params.victim_to = filterVictimTo.trim().toLowerCase();
      if (filterIsBundle !== '') params.is_bundle = filterIsBundle;
      if (filterProfitToken) params.profit_token = filterProfitToken.trim().toLowerCase();
      if (searchDateRange.start && searchDateRange.end) {
        params.startDate = searchDateRange.start;
        params.endDate = searchDateRange.end;
      }
      if (selectedBuilder) params.builder = selectedBuilder;

      const res = await fetchSandwichSearch(params);
      setSearchResults(res.data || []);
      setSearchPage(res.page || page);
    } catch (e) {
      console.error('Search failed', e);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const clearSearch = () => {
    setFilterVictimTo('');
    setFilterIsBundle('');
    setFilterProfitToken('');
    setSearchDateRange({ start: '', end: '' });
    setSearchResults([]);
    setSearchPage(1);
  };

  useEffect(() => {
    if (!authToken) {
      navigate('/login');
      return;
    }
    fetchStats(dateRange.start, dateRange.end);
    fetchBlocks();

    const statsInterval = setInterval(() => {
      fetchStats(dateRange.start, dateRange.end);
    }, 5000);

    const blocksInterval = setInterval(() => {
      fetchBlocks();
    }, 60000);

    return () => {
      clearInterval(statsInterval);
      clearInterval(blocksInterval);
    };
  }, [authToken, dateRange.start, dateRange.end]); 

  useEffect(() => {
    if (!authToken) return;
    loadBuilders();
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return;
    if (selectedBuilder) {
      loadBuilderStats(selectedBuilder, dateRange.start, dateRange.end);
    } else {
      setBuilderStats(null);
    }
  }, [selectedBuilder, authToken, dateRange.start, dateRange.end]); 

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatPercentage = (num) => {
    return `${parseFloat(num).toFixed(4)}%`;
  };

  const calculateTotalUSD = (builder) => {
    if (!builder) return 0;
    let totalUSD = builder.stable_usd_total || 0;
    if (bnbUsdt && builder.wbnb_wei_total) {
      const bnbAmount = Number(builder.wbnb_wei_total) / 1e18;
      totalUSD += bnbAmount * bnbUsdt;
    }
    return totalUSD;
  };

  const formatProfitUSD = (totalUSD) => {
    if (!totalUSD || totalUSD === 0) return "$0";
    try {
      if (totalUSD < 0.01) return "<$0.01";
      if (totalUSD < 1000) return `$${totalUSD.toFixed(2)}`;
      if (totalUSD < 1000000) return `$${(totalUSD / 1000).toFixed(1)}K`;
      return `$${(totalUSD / 1000000).toFixed(2)}M`;
    } catch {
      return "-";
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-70px)] bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-gray-50 to-white ${isMobile ? 'p-4' : 'p-8'}`}>
      <div className="max-w-7xl mx-auto">

        <div className={`${isMobile ? 'mb-6' : 'mb-8'}`}>
          <div className={`flex ${isMobile ? 'flex-col' : 'md:flex-row'} justify-between items-start gap-3`}>
            <div>
              <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl md:text-4xl'} font-bold text-gray-800 mb-2`}>
                MEV Sandwich Attack Monitor
              </h1>
              <p className="text-sm text-gray-600 mt-2">
                Last update: {formatBlockTime(lastUpdate.getTime(), timezone, 'full')}
              </p>
            </div>
            <div className={`flex ${isMobile ? 'w-full justify-between' : 'items-center'} gap-4`}>
              {bnbUsdt && (
                <div className="text-sm text-gray-600">
                  1 BNB ≈ ${bnbUsdt.toFixed(2)} USD
                </div>
              )}
              <div className={`${isMobile ? 'w-[180px]' : ''}`}>
                <TimezoneSelector />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#FFFBEC] rounded-2xl p-6 md:p-8 mb-8">
          <div className="text-center">
            <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-semibold mb-4 text-[#F3BA2F]`}>Sandwich Attack Rate</h2>
            <div className={`${isMobile ? 'text-4xl' : 'text-6xl'} font-bold mb-2 text-gray-900`}>
              {stats && stats.sandwich_percentage ? formatPercentage(stats.sandwich_percentage) : '0%'}
            </div>
            <div className={`${isMobile ? 'text-base' : 'text-lg'} text-gray-500`}>
              {stats && stats.sandwich_blocks ? formatNumber(stats.sandwich_blocks) : '0'} / {stats && stats.total_blocks ? formatNumber(stats.total_blocks) : '0'} blocks
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded p-4 md:p-6">
            <div className="text-gray-900 text-sm mb-2">Total Blocks Analyzed</div>
            <div className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-[1E1E1E]`}>
              {stats ? formatNumber(stats.total_blocks) : '0'}
            </div>
            <div className="text-xs text-gray-400 mt-2">
              Block #{stats?.earliest_block || 0} to #{stats?.latest_block || 0}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded p-4 md:p-6">
            <div className="text-gray-900 text-sm mb-2">Blocks with Sandwich</div>
            <div className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-[#E63946]`}>
              {stats ? formatNumber(stats.sandwich_blocks) : '0'}
            </div>
            <div className="text-xs text-gray-400 mt-2">
              Detected sandwich attacks
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded p-4 md:p-6">
            <div className="text-gray-900 text-sm mb-2">Latest Block</div>
            <div className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-[#F3BA2F]`}>
              #{stats?.latest_block || 0}
            </div>
            <div className="text-xs text-gray-400 mt-2">
              Most recent analyzed
            </div>
          </div>
        </div>

        {/* Builder Filter */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 mb-8">
          <div className={`flex ${isMobile ? 'flex-col' : 'sm:flex-row sm:items-center'} gap-2 sm:gap-3 mb-4`}>
            <label className="text-sm text-gray-600">Filter by Builder:</label>

            <div className={`${isMobile ? 'w-full' : 'w-full sm:w-[200px]'}`}>
              <Select
                value={selectedBuilder}
                onChange={(value) => setSelectedBuilder(value)}
                options={[
                  { value: '', label: 'All Builders (global)' },
                  ...builders.map((b) => ({ value: b, label: b }))
                ]}
                className="w-full"
                size="middle"
                optionFilterProp="label"
                showSearch
                style={{ width: '100%' }}
              />
            </div>

            {selectedBuilder && (
              <button
                onClick={() => {
                  setShowBuilderDetails(true);
                  setBuilderPage(1);
                  loadBuilderSandwiches(selectedBuilder, 1);
                }}
                className={
                  isMobile
                    ? 'w-full py-2 px-3 rounded-sm bg-[#FFC801] text-[#1E1E1E] text-sm font-medium hover:bg-[#FFD829] transition-all'
                    : 'px-2 py-1 rounded bg-[#FFC801] text-[#1E1E1E] font-medium hover:bg-[#FFD829] transition-all'
                }
              >
                View Details
              </button>
            )}
          </div>

          <div className={`flex ${isMobile ? 'flex-col' : 'sm:flex-row sm:items-center'} gap-2 sm:gap-3 mt-4`}>
            <label className="text-sm text-gray-600">Date Range:</label>

            <div className={`${isMobile ? 'w-full' : 'w-full sm:w-[280px]'}`}>
              <DateRangePicker
                value={dateRange}
                onChange={(v) => setDateRange(v)}
                inputReadOnly
                className="w-full"
              />
            </div>

            <button
              onClick={() => {
                if (dateRange.start && dateRange.end) {
                  fetchStats(dateRange.start, dateRange.end);
                  if (selectedBuilder) {
                    loadBuilderStats(selectedBuilder, dateRange.start, dateRange.end);
                  }
                }
              }}
              className={
                isMobile
                  ? 'w-full px-4 py-2 rounded bg-[#FFC801] text-[#1E1E1E] text-sm font-medium hover:bg-[#FFD829] transition-all'
                  : 'px-4 py-1 rounded bg-[#FFC801] text-[#1E1E1E] text-sm font-medium hover:bg-[#FFD829] transition-all'
              }
            >
              Apply
            </button>
            {(dateRange.start || dateRange.end) && (
              <button
                onClick={() => {
                  setDateRange({ start: '', end: '' });
                  fetchStats();
                  if (selectedBuilder) {
                    loadBuilderStats(selectedBuilder);
                  }
                }}
                className={
                  isMobile
                    ? 'w-full px-4 py-2 rounded-sm border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 transition-all'
                    : 'px-4 py-1 rounded-sm border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 transition-all'
                }
              >
                Clear
              </button>
            )}
          </div>

          {!selectedBuilder && stats && (
            <div className="text-sm text-gray-600">
              <div className="mb-2">Sandwich on Builder Blocks</div>
              <div className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-gray-900`}>
                {stats.sandwich_percentage_on_builder?.toFixed(4)}%
              </div>
              <div className="text-xs text-gray-400 mt-2">
                {`${formatNumber(stats.sandwich_builder_blocks)} / ${formatNumber(stats.builder_blocks)} blocks`}
              </div>

              {/* Top builders table */}
              {Array.isArray(stats.breakdown_by_builder) && stats.breakdown_by_builder.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm text-gray-600 mb-2">Builders by Sandwich Rate (High to Low)</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[760px]">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-2 text-gray-500">Builder</th>
                          <th className="text-left py-2 px-2 text-gray-500">Blocks</th>
                          <th className="text-left py-2 px-2 text-gray-500">Sandwich</th>
                          <th className="text-left py-2 px-2 text-gray-500">Rate</th>
                          <th className="text-left py-2 px-2 text-gray-500">attack amount(USD) / tx</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.breakdown_by_builder.slice(0, 10).map((b, idx) => (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 px-2 text-gray-700">{b.builder_name || '-'}</td>
                            <td className="py-2 px-2 text-gray-700">{formatNumber(b.blocks)}</td>
                            <td className="py-2 px-2 text-gray-700">{formatNumber(b.sandwich_blocks)}</td>
                            <td className="py-2 px-2 text-amber-600 font-semibold">
                              {b.sandwich_percentage.toFixed(4)}%
                            </td>
                            <td className="py-2 px-2 text-green-600 font-semibold">
                              {formatProfitUSD(calculateTotalUSD(b))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedBuilder && builderStats && (
            <div className="text-sm text-gray-600 mt-4">
              <div className="mb-2">
                Sandwich Rate for <span className="font-semibold text-amber-600">{selectedBuilder}</span>
              </div>
              <div className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-gray-900`}>
                {builderStats.sandwich_percentage?.toFixed(4)}%
              </div>
              <div className="text-xs text-gray-400 mt-2">
                {`${formatNumber(builderStats.sandwich_blocks)} / ${formatNumber(builderStats.total_blocks)} blocks`}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Blocks #{builderStats.earliest_block || 0} to #{builderStats.latest_block || 0}
              </div>
            </div>
          )}
        </div>

        {/* Chart Section */}
        <div className={`${isMobile ? 'mb-6' : 'mb-8'}`}>
          <SandwichChart dateRange={dateRange} />
        </div>

        {/* Advanced Search (victim_to / bundle / profit_token / date) */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 mb-8">
          <h2 className="relative pl-3 text-base font-semibold text-gray-900 mb-4 leading-6">
            <span
              aria-hidden="true"
              className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 bg-yellow-400"
            ></span>
            Filter Sandwiches
          </h2>
          <div className={`grid grid-cols-1 md:grid-cols-4 ${isMobile ? 'gap-2' : 'gap-3'}`}>
            <div>
              <label className="text-gray-600 text-sm">Victim Router (tx.to)</label>
                <Input
                  value={filterVictimTo}
                  onChange={(e) => setFilterVictimTo(e.target.value)}
                  placeholder="0x..."
                  className="w-full"
                />
            </div>

            <div>
              <label className="text-gray-600 text-sm">Bundle</label>
              <Select
                value={filterIsBundle}
                onChange={(value) => setFilterIsBundle(value)}
                className="w-full text-sm custom-select"
                popupClassName="custom-dropdown"
                popupMatchSelectWidth={false}
              >
                {bundleOptions.map(({ value, label }) => (
                  <Option key={value} value={value}>
                    {label}
                  </Option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-gray-600 text-sm">Profit Token</label>
              <Input
                value={filterProfitToken}
                onChange={(e) => setFilterProfitToken(e.target.value)}
                placeholder="0xbb4c... (WBNB)"
                className="w-full"
              />
            </div>

            <div className={`flex ${isMobile ? 'flex-col' : 'items-end'} gap-2`}>
              <button
                onClick={() => runSearch(1)}
                className={
                  isMobile
                    ? 'w-full px-4 py-2 rounded bg-[#FFC801] text-[#1E1E1E] hover:bg-[#FFD829] transition-all'
                    : 'flex-2 px-4 py-1 rounded bg-[#FFC801] text-[#1E1E1E] hover:bg-[#FFD829] transition-all'
                }
              >
                Search
              </button>
              <button
                onClick={clearSearch}
                className={
                  isMobile
                    ? 'w-full px-4 py-2 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-all'
                    : 'flex-2 px-4 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-all'
                }
              >
                Clear
              </button>
            </div>
          </div>

          <div className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-3 mt-3`}>
            <label className="text-gray-600 text-sm">Date Range:</label>
            <div className={`${isMobile ? 'w-full' : ''}`}>
              <DateRangePicker
                value={searchDateRange}
                onChange={(v) => setSearchDateRange(v)}
                style={{ minWidth: isMobile ? 0 : 260, width: isMobile ? '100%' : undefined }}
                inputReadOnly
                size="middle"
              />
            </div>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Block</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Profit</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Type</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Victim Router</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">FrontRun TX</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Victim TX</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Backruns TXS</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Builder</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Validator</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100 hover:bg-amber-50 transition-colors">
                      <td className="py-2 px-3">
                        <a 
                          href={`https://bscscan.com/block/${r.block_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-amber-600 font-semibold hover:text-amber-700 hover:underline"
                        >
                          #{r.block_number}
                        </a>
                      </td>
                      <td className="py-2 px-3 font-mono text-gray-800">
                        {formatWei(r.profit_wei, 18, 4)}{' '}
                        <a
                          href={`https://bscscan.com/token/${r.profit_token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-600 hover:text-amber-700 hover:underline font-semibold"
                        >
                          {getTokenSymbol(r.profit_token)}
                        </a>
                      </td>
                      <td className="py-2 px-3">
                        {r.is_bundle ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            bundle{r.bundle_size ? ` (${r.bundle_size})` : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            non-bundle
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <a
                          href={`https://bscscan.com/address/${r.victim_to}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-gray-500 hover:text-gray-700 hover:underline"
                        >
                          {short(r.victim_to)}
                        </a>
                      </td>
                      <td className="py-2 px-3">
                        <a
                          href={`https://bscscan.com/tx/${r.front_tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-gray-500 hover:text-gray-700 hover:underline"
                        >
                          {short(r.front_tx_hash)}
                        </a>
                      </td>
                      <td className="py-2 px-3">
                        <a
                          href={`https://bscscan.com/tx/${r.victim_tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-gray-500 hover:text-gray-700 hover:underline"
                        >
                          {short(r.victim_tx_hash)}
                        </a>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex flex-col gap-1">
                          {r.backrun_txes?.slice(0, 2).map((h, i) => (
                            <a
                              key={h}
                              href={`https://bscscan.com/tx/${h}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-xs text-gray-500 hover:text-gray-700 hover:underline"
                            >
                              {i + 1}. {short(h)}
                            </a>
                          ))}
                          {r.backrun_txes?.length > 2 && (
                            <span className="text-xs text-gray-400">+{r.backrun_txes.length - 2} more</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-gray-700">{r.builder_name || '-'}</td>
                      <td className="py-2 px-3 text-gray-700">{r.validator_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Search by TX */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 mb-8">
          <h2 className="relative pl-3 text-base font-semibold text-gray-900 mb-4 leading-6">
            <span
              aria-hidden="true"
              className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 bg-yellow-400"
            ></span>
            Search by TX Hash
          </h2>
          <div className={`flex ${isMobile ? 'flex-col' : ''} gap-3`}>
            <Input
              value={txQuery}
              onChange={(e) => setTxQuery(e.target.value)}
              onPressEnter={onSearchTx}
              placeholder="0x..."
              className={`${isMobile ? 'w-full' : 'flex-1'}`}
            />
            <div className={`flex ${isMobile ? 'flex-col w-full' : 'flex-row'} gap-3`}>
              <button
                onClick={onSearchTx}
                className={
                  isMobile
                    ? 'w-full px-4 py-2 rounded bg-[#FFC801] text-[#1E1E1E] font-medium hover:bg-[#FFD829] transition-all'
                    : 'px-4 py-1 rounded bg-[#FFC801] text-[#1E1E1E] font-medium hover:bg-[#FFD829] transition-all'
                }
              >
                {txLoading ? 'Searching...' : 'Search'}
              </button>
              {txSearched && (
                <button
                  onClick={onClearTx}
                  className={
                    isMobile
                      ? 'w-full px-4 py-2 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-all'
                      : 'px-4 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-all'
                  }
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {txSearched && !txLoading && txResults.length === 0 && (
            <div className="mt-4 p-4 bg-[#FFFBEC] border border-amber-200 rounded">
              <p className="text-[#1E1E1E] text-sm">
                This transaction is not part of a sandwich attack.
              </p>
            </div>
          )}

          {txResults.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Block</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Front</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Victim</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Backruns</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Builder</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Validator</th>
                  </tr>
                </thead>
                <tbody>
                  {txResults.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100 hover:bg-amber-50 transition-colors">
                      <td className="py-2 px-3 font-mono text-amber-600 font-semibold">#{r.block_number}</td>
                      <td className="py-2 px-3 font-mono text-gray-600 text-xs">{r.front_tx_hash.slice(0,10)}...</td>
                      <td className="py-2 px-3 font-mono text-gray-600 text-xs">{r.victim_tx_hash.slice(0,10)}...</td>
                      <td className="py-2 px-3">
                        <div className="flex flex-col gap-1">
                          {r.backrun_txes?.map((h, i) => (
                            <span key={h} className="font-mono text-xs text-gray-500">{i + 1}. {h.slice(0,8)}...</span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-gray-700">{r.builder_name || '-'}</td>
                      <td className="py-2 px-3 text-gray-700">{r.validator_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          )}
        </div>

        {/* Search by Block */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 mb-8">
          <h2 className="relative pl-3 text-base font-semibold text-gray-900 mb-4 leading-6">
            <span
              aria-hidden="true"
              className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 bg-yellow-400"
            ></span>
            Search by Block
          </h2>
          <div className={`flex ${isMobile ? 'flex-col' : ''} gap-3`}>
            <Input
              value={blockQuery}
              onChange={(e) => setBlockQuery(e.target.value)}
              onPressEnter={onSearchBlock}
              placeholder="Block number"
              className={`${isMobile ? 'w-full' : 'flex-1'}`}
            />
            <div className={`flex ${isMobile ? 'flex-col w-full' : 'flex-row'} gap-3`}>
              <button
                onClick={onSearchBlock}
                className={
                  isMobile
                    ? 'w-full px-4 py-2 rounded bg-[#FFC801] text-[#1E1E1E] font-medium hover:bg-[#FFD829] transition-all'
                    : 'px-4 py-1 rounded bg-[#FFC801] text-[#1E1E1E] font-medium hover:bg-[#FFD829] transition-all'
                }
              >
                {blockLoading ? 'Searching...' : 'Search'}
              </button>
              {blockSearched && (
                <button
                  onClick={onClearBlock}
                  className={
                    isMobile
                      ? 'w-full px-4 py-2 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-all'
                      : 'px-4 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-all'
                  }
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          
          {blockMeta && (
            <div className="mt-4 p-3 bg-amber-50 rounded border border-amber-200">
              <div className="text-sm text-gray-700">
                <div className={`flex ${isMobile ? 'flex-wrap' : 'items-center'} gap-2 mb-1`}>
                  {blockClean ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-emerald-500">
                      ✓ Clean Block
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-rose-600">
                      🥪 Sandwich Detected
                    </span>
                  )}
                  <a 
                    href={`https://bscscan.com/block/${blockMeta.block_number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-amber-600 hover:text-amber-700 hover:underline"
                  >
                    #{blockMeta.block_number}
                  </a>
                </div>
                <div>Builder: <span className="font-medium text-amber-600">{blockMeta.builder_name || '-'}</span></div>
                <div>Validator: <span className="font-medium text-amber-600">{blockMeta.validator_name || '-'}</span></div>
              </div>
            </div>
          )}
          
          {blockError && <div className="text-red-600 text-sm mt-2">{blockError}</div>}

          {blockResults.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Attack ID</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Front</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Victim</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Backruns</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Builder</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Validator</th>
                  </tr>
                </thead>
                <tbody>
                  {blockResults.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100 hover:bg-amber-50 transition-colors">
                      <td className="py-2 px-3 text-amber-600 font-semibold">{r.id}</td>
                      <td className="py-2 px-3 font-mono text-gray-600 text-xs">{r.front_tx_hash.slice(0,10)}...</td>
                      <td className="py-2 px-3 font-mono text-gray-600 text-xs">{r.victim_tx_hash.slice(0,10)}...</td>
                      <td className="py-2 px-3">
                        <div className="flex flex-col gap-1">
                          {r.backrun_txes?.map((h, i) => (
                            <span key={h} className="font-mono text-xs text-gray-500">{i + 1}. {h.slice(0,8)}...</span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-gray-700">{r.builder_name || '-'}</td>
                      <td className="py-2 px-3 text-gray-700">{r.validator_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6">
          <h2 className="relative pl-3 text-base font-semibold text-gray-900 mb-4 leading-6">
            <span
              aria-hidden="true"
              className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 bg-yellow-400"
            ></span>
            Recent Blocks
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-gray-600 font-medium">Block Number</th>
                  <th className="text-left py-3 px-4 text-gray-600 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-gray-600 font-medium">Time</th>
                  <th className="text-left py-3 px-4 text-gray-600 font-medium">Builder</th>
                  <th className="text-left py-3 px-4 text-gray-600 font-medium">Validator</th>
                </tr>
              </thead>
              <tbody>
                {recentBlocks.map((block, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-amber-50 transition-colors">
                    <td className="py-3 px-4">
                      <a 
                        href={`https://bscscan.com/block/${block.block_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-amber-600 font-medium hover:text-amber-700 hover:underline"
                      >
                        #{block.block_number}
                      </a>
                    </td>
                    <td className="py-3 px-4">
                      {block.has_sandwich ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          🥪 Sandwich Detected
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ✓ Clean
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-sm">
                      {formatBlockTime(block.block_time_ms || block.block_time || block.updated_at, timezone, 'full')}
                    </td>
                    <td className="py-3 px-4 text-gray-700">{block.builder_name || '-'}</td>
                    <td className="py-3 px-4 text-gray-700">{block.validator_name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Builder Details */}
        {showBuilderDetails && selectedBuilder && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowBuilderDetails(false)}
          >
            <div 
              className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200">
                <div className={`flex ${isMobile ? 'flex-col gap-2' : 'justify-between items-center'}`}>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Sandwich Attacks by {selectedBuilder}
                  </h2>
                  <button
                    onClick={() => setShowBuilderDetails(false)}
                    className="self-end text-gray-500 hover:text-gray-700 text-2xl font-bold"
                  >
                    ×
                  </button>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  Total: {formatNumber(builderTotal)} attacks
                  {builderDateRange.start && builderDateRange.end ? (
                    <span className="ml-2">
                      ({builderDateRange.start} to {builderDateRange.end})
                    </span>
                  ) : (
                    <span className="ml-2 text-amber-600">
                      (Showing last 30 days by default)
                    </span>
                  )}
                </div>
                
                {/* Quick date range buttons */}
                <div className={`flex ${isMobile ? 'flex-wrap' : 'items-center'} gap-2 mt-3`}>
                  <span className="text-sm text-gray-600">Quick select:</span>
                  <button
                    onClick={() => {
                      const end = new Date().toISOString().split('T')[0];
                      const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                      setBuilderDateRange({ start, end });
                      setBuilderPage(1);
                      loadBuilderSandwiches(selectedBuilder, 1, start, end);
                    }}
                    className="text-xs px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-gray-700"
                  >
                    Last 7 days
                  </button>
                  <button
                    onClick={() => {
                      const end = new Date().toISOString().split('T')[0];
                      const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                      setBuilderDateRange({ start, end });
                      setBuilderPage(1);
                      loadBuilderSandwiches(selectedBuilder, 1, start, end);
                    }}
                    className="text-xs px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-gray-700"
                  >
                    Last 30 days
                  </button>
                  <button
                    onClick={() => {
                      const end = new Date().toISOString().split('T')[0];
                      const start = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                      setBuilderDateRange({ start, end });
                      setBuilderPage(1);
                      loadBuilderSandwiches(selectedBuilder, 1, start, end);
                    }}
                    className="text-xs px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-gray-700"
                  >
                    Last 2 months
                  </button>
                  <button
                    onClick={() => {
                      const end = new Date().toISOString().split('T')[0];
                      const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                      setBuilderDateRange({ start, end });
                      setBuilderPage(1);
                      loadBuilderSandwiches(selectedBuilder, 1, start, end);
                    }}
                    className="text-xs px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-gray-700"
                  >
                    Last 3 months
                  </button>
                </div>
                
                {/* Date filter for builder details */}
                <div className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-3 mt-4`}>
                  <label className="text-sm text-gray-600">Date Range:</label>
                  <div className={`${isMobile ? 'w-full' : ''}`}>
                    <DateRangePicker
                      value={builderDateRange}
                      onChange={(v) => setBuilderDateRange(v)}
                      style={{ minWidth: isMobile ? 0 : 240, width: isMobile ? '100%' : undefined }}
                      size="middle"
                      inputReadOnly
                    />
                  </div>
                  <div className={`flex ${isMobile ? 'flex-col w-full' : 'flex-row'} gap-2`}>
                    <button
                      onClick={() => {
                        if (builderDateRange.start && builderDateRange.end) {
                          setBuilderPage(1);
                          loadBuilderSandwiches(selectedBuilder, 1, builderDateRange.start, builderDateRange.end);
                        }
                      }}
                      className={
                        isMobile
                          ? 'w-full px-3 py-2 rounded bg-[#FFC801] text-[#1E1E1E] text-sm hover:bg-[#FFD829] transition-all'
                          : 'px-2 py-1 rounded bg-[#FFC801] text-[#1E1E1E] text-sm  hover:bg-[#FFD829] transition-all'
                      }
                    >
                      Apply
                    </button>
                    {(builderDateRange.start || builderDateRange.end) && (
                      <button
                        onClick={() => {
                          setBuilderDateRange({ start: '', end: '' });
                          setBuilderPage(1);
                          loadBuilderSandwiches(selectedBuilder, 1);
                        }}
                        className={
                          isMobile
                            ? 'w-full text-sm px-3 py-2 rounded border border-gray-300 text-gray-600 hover:bg-gray-50'
                            : 'text-sm px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50'
                        }
                      >
                        Reset to default
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
                {builderLoading ? (
                  <div className="text-center py-8">
                    <div className="text-gray-600">Loading...</div>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 px-3 text-gray-600 font-medium">Block</th>
                            <th className="text-left py-2 px-3 text-gray-600 font-medium">Time</th>
                            <th className="text-left py-2 px-3 text-gray-600 font-medium">Front TX</th>
                            <th className="text-left py-2 px-3 text-gray-600 font-medium">Victim TX</th>
                            <th className="text-left py-2 px-3 text-gray-600 font-medium">Backruns</th>
                            <th className="text-left py-2 px-3 text-gray-600 font-medium">Validator</th>
                          </tr>
                        </thead>
                        <tbody>
                          {builderSandwiches.map((s) => (
                            <tr key={s.id} className="border-b border-gray-100 hover:bg-amber-50">
                              <td className="py-2 px-3">
                                <a
                                  href={`https://bscscan.com/block/${s.block_number}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-amber-600 hover:text-amber-700 hover:underline"
                                >
                                  #{s.block_number}
                                </a>
                              </td>
                              <td className="py-2 px-3 text-gray-600 text-sm">
                                {s.block_time_ms ? 
                                  formatBlockTime(s.block_time_ms, timezone, 'full') : 
                                  formatBlockTime(s.block_time, timezone, 'full')}
                              </td>
                              <td className="py-2 px-3">
                                <a
                                  href={`https://bscscan.com/tx/${s.front_tx_hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-xs text-blue-600 hover:text-blue-700 hover:underline"
                                >
                                  {s.front_tx_hash.slice(0, 10)}...
                                </a>
                              </td>
                              <td className="py-2 px-3">
                                <a
                                  href={`https://bscscan.com/tx/${s.victim_tx_hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-xs text-red-600 hover:text-red-700 hover:underline"
                                >
                                  {s.victim_tx_hash.slice(0, 10)}...
                                </a>
                              </td>
                              <td className="py-2 px-3">
                                <div className="flex flex-col gap-1">
                                  {s.backrun_txes?.slice(0, 2).map((h, i) => (
                                    <a
                                      key={h}
                                      href={`https://bscscan.com/tx/${h}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-mono text-xs text-gray-500 hover:text-gray-700 hover:underline"
                                    >
                                      {i + 1}. {h.slice(0, 8)}...
                                    </a>
                                  ))}
                                  {s.backrun_txes?.length > 2 && (
                                    <span className="text-xs text-gray-400">
                                      +{s.backrun_txes.length - 2} more
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-3 text-gray-700 text-sm">
                                {s.validator_name || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className={`flex ${isMobile ? 'flex-col gap-3' : 'justify-between items-center'} mt-6`}>
                      <div className={`flex ${isMobile ? 'flex-col gap-2' : 'items-center gap-3'}`}>
                        <span className="text-sm text-gray-600">
                          Page {builderPage} of {builderTotalPages}
                          {builderTotalPages > 100 && (
                            <span className="ml-2 text-xs text-red-600">
                              (Max 100 pages - use date filter for more)
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">Go to:</span>
                          <input
                            type="number"
                            min="1"
                            max={builderTotalPages}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const page = parseInt(e.target.value);
                                if (page >= 1 && page <= builderTotalPages) {
                                  loadBuilderSandwiches(selectedBuilder, page, builderDateRange.start, builderDateRange.end);
                                }
                              }
                            }}
                            placeholder="#"
                          />
                        </div>
                      </div>
                      <div className={`flex ${isMobile ? 'flex-col' : 'flex-row'} gap-2`}>
                        <button
                          onClick={() => loadBuilderSandwiches(selectedBuilder, builderPage - 1, builderDateRange.start, builderDateRange.end)}
                          disabled={builderPage <= 1}
                          className={`px-4 py-2 rounded font-medium transition-all ${
                            builderPage <= 1
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-gradient-to-r from-yellow-300 to-amber-400 text-gray-800 hover:from-yellow-400 hover:to-amber-500'
                          }`}
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => loadBuilderSandwiches(selectedBuilder, builderPage + 1, builderDateRange.start, builderDateRange.end)}
                          disabled={builderPage >= builderTotalPages}
                          className={`px-4 py-2 rounded font-medium transition-all ${
                            builderPage >= builderTotalPages
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-gradient-to-r from-yellow-300 to-amber-400 text-gray-800 hover:from-yellow-400 hover:to-amber-500'
                          }`}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SandwichStats;