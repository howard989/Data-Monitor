import React, { useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { usePause } from '../context/PauseContext';
import { usePausableRequest } from '../hooks/usePausableRequest';
import { authFetch, API_URL } from '../data/apiClient';
import {
  fetchAttackByTx, fetchAttacksByBlock, fetchBuilderList,
  fetchSandwichStats, fetchBuilderSandwiches, fetchSandwichSearch
} from '../data/apiSandwichStats';
import { useTimezone } from '../context/TimezoneContext';
import { formatBlockTime } from '../utils/timeFormatter';
import { monthRangeFromUtcMs, prevMonthRangeFromUtcMs, getAnchorMs, minutesRangeFromNow } from '../utils/dateHelpers';
import TimezoneSelector from './TimezoneSelector';
import SandwichChart from './SandwichChart';
import SandwichFilter from './SandwichFilter';
import useBnbUsdPrice from '../hooks/useBnbUsdPrice';
import { Select, Input, Tooltip, Button } from 'antd';
import DateRangePicker from './common/DateRangePicker';
import { EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import '../css/Watermark.css';

const { Option } = Select;

const TOKEN_INFO = {
  '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c': { symbol: 'WBNB', decimals: 18, isStable: false },
  '0x55d398326f99059ff775485246999027b3197955': { symbol: 'USDT', decimals: 18, isStable: true },
  '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': { symbol: 'USDC', decimals: 18, isStable: true },
  '0xe9e7cea3dedca5984780bafc599bd69add087d56': { symbol: 'BUSD', decimals: 18, isStable: true },
  '0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d': { symbol: 'USD1', decimals: 18, isStable: true }
};

const getTokenSymbol = (address) => {
  if (!address) return '-';
  const info = TOKEN_INFO[address.toLowerCase()];
  return info ? info.symbol : `${address.slice(0, 6)}…${address.slice(-4)}`;
};

const SandwichStats = () => {
  const reportRef = useRef(null);
  const [stats, setStats] = useState(null);
  const [recentBlocks, setRecentBlocks] = useState([]);

  const [statsLoading, setStatsLoading] = useState(true);
  const [blocksLoading, setBlocksLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const { authToken, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { timezone, timezoneLabel } = useTimezone();
  const { bnbUsdt } = useBnbUsdPrice(600000);
  
 
  const compactRangeLabel = (start, end) => {
    if (!start || !end) return '';
    const sMs = start.includes(' ') || start.includes('T') 
      ? Date.parse(start.replace(' ', 'T') + (start.includes('Z') ? '' : 'Z'))
      : Date.parse(`${start}T00:00:00Z`);
    const eMs = end.includes(' ') || end.includes('T')
      ? Date.parse(end.replace(' ', 'T') + (end.includes('Z') ? '' : 'Z'))
      : Date.parse(`${end}T00:00:00Z`);
  
    const fmt = (ms, opts) => new Intl.DateTimeFormat('en-US', { ...opts, timeZone: timezone }).format(ms);

    if (start === end) {
      return fmt(sMs, { year:'numeric', month:'short', day:'numeric' }); 
    }
    if (start.slice(0,7) === end.slice(0,7)) {
      return `${fmt(sMs, { month:'short', day:'numeric' })}–${fmt(eMs, { month:'short', day:'numeric', year:'numeric' })}`;
    }
    return `${fmt(sMs, { year:'numeric', month:'short', day:'numeric' })} – ${fmt(eMs, { year:'numeric', month:'short', day:'numeric' })}`;
  };

  const { isPaused, toggle } = usePause();
  const { executePausableRequest } = usePausableRequest();



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
  const [activeTimeFilter, setActiveTimeFilter] = useState(null);
  const [customMinutes, setCustomMinutes] = useState('');

  const [bundleFilter, setBundleFilter] = useState('all');
  const [amountRange, setAmountRange] = useState({ min: '', max: '' });
  const [frontrunRouter, setFrontrunRouter] = useState('all');


  const [filterVictimTo, setFilterVictimTo] = useState('');
  const [filterIsBundle, setFilterIsBundle] = useState('');
  const [filterSortBy, setFilterSortBy] = useState('time');
  const [searchDateRange, setSearchDateRange] = useState({ start: '', end: '' });
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [searchLimit, setSearchLimit] = useState(25);   // Default page size when no router specified
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchTotalPages, setSearchTotalPages] = useState(0);
  const [searchFilters, setSearchFilters] = useState(null);


  const [builderSort, setBuilderSort] = useState({ key: 'mined_rate', dir: 'desc' });

  const short = (addr) => (addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '-');

  const formatWei = (weiStr, decimals = 18, digits = 6) => {
    if (!weiStr) return '0';
    try {
      const bi = window.BigInt(weiStr);
      const base = window.BigInt(10) ** window.BigInt(decimals);
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
    try {
      const { data } = await fetchBuilderList();
      setBuilders(data || []);
    } catch (error) {
      console.error('Failed to load builders:', error);
    }
  };

  const loadBuilderStats = async (name, startDate = null, endDate = null) => {
    const { data } = await fetchSandwichStats(name || null, startDate, endDate, {
      bundleFilter,
      amountRange,
      frontrunRouter,
    });
    setBuilderStats(data || null);
  };
  

  const loadBuilderSandwiches = async (builder, page, startDate = null, endDate = null) => {
    setBuilderLoading(true);
    try {
      const result = await fetchBuilderSandwiches(builder, page, 50, startDate, endDate);
      if (result.success === false && result.maxPages) {

        alert(result.error || `Maximum ${result.maxPages} pages allowed. Please use date filter to narrow down results.`);
        setBuilderSandwiches([]);
        setBuilderTotal(0);
        setBuilderTotalPages(0);
      } else if (result.success || result.data) {
        setBuilderSandwiches(result.data || []);
        setBuilderTotal(result.total || 0);
        setBuilderTotalPages(Math.min(result.totalPages || 0, 100));
        setBuilderPage(page);

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

  const fetchStats = useCallback(async (startDate = null, endDate = null, options = {}) => {
    const { silent = false } = options;
    if (isPaused) return;

    if (!silent) setStatsLoading(true);

    try {
      let url = `${API_URL}/sandwich/stats`;
      const params = new URLSearchParams();

      if (startDate && endDate) {
        params.append('startDate', startDate);
        params.append('endDate', endDate);
      }

      if (bundleFilter !== 'all') {
        params.append('bundleFilter', bundleFilter);
      }
      if (amountRange.min) {
        params.append('amountMin', amountRange.min);
      }
      if (amountRange.max) {
        params.append('amountMax', amountRange.max);
      }
      if (frontrunRouter !== 'all') {
        params.append('frontrunRouter', frontrunRouter);
      }

      const queryString = params.toString();
      if (queryString) {
        url += '?' + queryString;
      }

      await executePausableRequest(
        async () => authFetch(url, { method: 'GET' }),
        {
          onSuccess: async (statsRes) => {
            if (!statsRes.ok) {
              if (statsRes.status === 401) handleUnauthorized();
              return;
            }
            const statsData = await statsRes.json();
            setStats(statsData.data);
            
            if (!dateRange.start && !dateRange.end && statsData?.data?.date_range) {
              setDateRange({
                start: statsData.data.date_range.start,
                end: statsData.data.date_range.end
              });
            }
            
            setLastUpdate(new Date());
          },
          onError: (error) => {
            if (error.status === 401) {
              handleUnauthorized();
            } else {
              console.error('Error fetching stats:', error);
            }
          },
          retryOnResume: !silent
        }
      );
    } finally {
      if (!silent) setStatsLoading(false);
    }
  }, [isPaused, executePausableRequest, authFetch, bundleFilter, amountRange.min, amountRange.max, frontrunRouter]);

  const fetchBlocks = useCallback(async () => {
    if (isPaused) return;

    setBlocksLoading(true);

    try {
      await executePausableRequest(
        async () => authFetch(`${API_URL}/sandwich/recent?limit=20`, { method: 'GET' }),
        {
          onSuccess: async (blocksRes) => {
            if (!blocksRes.ok) {
              if (blocksRes.status === 401) handleUnauthorized();
              return;
            }
            const blocksData = await blocksRes.json();
            setRecentBlocks(blocksData.data);
          },
          onError: (error) => {
            if (error.status === 401) {
              handleUnauthorized();
            } else {
              console.error('Error fetching blocks:', error);
            }
          },
          retryOnResume: true
        }
      );
    } finally {
      setBlocksLoading(false);
    }
  }, [isPaused, executePausableRequest, authFetch]);

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


  const clearSearch = () => {
    setFilterVictimTo('');
    setFilterIsBundle('');
    setFilterSortBy('time');
    setSearchDateRange({ start: '', end: '' });
    setSearchResults([]);
    setSearchPage(1);
    setSearchLimit(25);
    setSearchTotal(0);
    setSearchTotalPages(0);
    setHasSearched(false);
  };

  const handleExportCSV = useCallback(async () => {
    // if (!dateRange.start || !dateRange.end) {
    //   alert('Please set a Date Range before exporting CSV.');
    //   return;
    // }
    
    const escapeCSV = (v) => {
      const s = String(v ?? '');
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const download = (content, filename, mime='text/csv;charset=utf-8;') => {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    };

    const rangeLabel = (dateRange?.start && dateRange?.end)
      ? `${dateRange.start}_to_${dateRange.end}`
      : 'current_range';

    if (selectedBuilder) {
      const header = [
        'block_number','time','front_tx','victim_tx','backruns_count','backruns_joined',
        'validator','profit_wei','profit_token','is_bundle','bundle_size'
      ];
      const rows = [];
      let page = 1;
      const MAX_PAGES_TO_EXPORT = 20;
      let totalPages = 1;

      try {
        const first = await fetchBuilderSandwiches(selectedBuilder, 1, 50, builderDateRange.start || dateRange.start || null, builderDateRange.end || dateRange.end || null);
        const list = first?.data || [];
        totalPages = Math.min(first?.totalPages || 1, 100);
        list.forEach(s => {
          rows.push([
            s.block_number,
            formatBlockTime(s.block_time_ms || s.block_time, timezone, 'full'),
            s.front_tx_hash,
            s.victim_tx_hash,
            (s.backrun_txes || []).length,
            (s.backrun_txes || []).join('|'),
            s.validator_name || '',
            s.profit_wei || '',
            s.profit_token || '',
            s.is_bundle ? 1 : 0,
            s.bundle_size || 0
          ]);
        });

        page = 2;
        while (page <= totalPages && page <= MAX_PAGES_TO_EXPORT) {
          const res = await fetchBuilderSandwiches(selectedBuilder, page, 50, builderDateRange.start || dateRange.start || null, builderDateRange.end || dateRange.end || null);
          const arr = res?.data || [];
          arr.forEach(s => {
            rows.push([
              s.block_number,
              formatBlockTime(s.block_time_ms || s.block_time, timezone, 'full'),
              s.front_tx_hash,
              s.victim_tx_hash,
              (s.backrun_txes || []).length,
              (s.backrun_txes || []).join('|'),
              s.validator_name || '',
              s.profit_wei || '',
              s.profit_token || '',
              s.is_bundle ? 1 : 0,
              s.bundle_size || 0
            ]);
          });
          page++;
        }
      } catch (e) {
        console.error('Export CSV error:', e);
      }

      const csv = [header.map(escapeCSV).join(',')]
        .concat(rows.map(r => r.map(escapeCSV).join(',')))
        .join('\n');

      const filename = `sandwich_${selectedBuilder}_${rangeLabel}.csv`;
      download(csv, filename);
      return;
    }

    const header = [
      'builder','blocks','sandwich_blocks','sandwich_percentage','mined_rate',
      'stable_usd_total','wbnb_wei_total','avg_profit_usd_per_tx'
    ];
    const rows = (stats?.breakdown_by_builder || [])
      .slice(0, 100)
      .map(b => {
        const stable = Number(b.stable_usd_total || 0);
        const wbnbWei = Number(b.wbnb_wei_total || 0);
        const bnbUsdNum = Number(bnbUsdt || 0);
        const bnbUsdPart = bnbUsdNum > 0 ? (wbnbWei / 1e18) * bnbUsdNum : 0;
        const totalUsd = stable + bnbUsdPart;

        const count = (b.profit_breakdown || []).reduce((s, it) => s + (it.count || 0), 0);
        const avg = count > 0 ? totalUsd / count : 0;

        return [
          b.builder_name || '',
          Number(b.blocks || 0),
          Number(b.sandwich_blocks || 0),
          Number(b.sandwich_percentage || 0),
          Number(b.mined_rate || 0),
          stable.toFixed(2),
          String(b.wbnb_wei_total || '0'),
          avg.toFixed(4)
        ];
      });

    const csv = [header.map(escapeCSV).join(',')]
      .concat(rows.map(r => r.map(escapeCSV).join(',')))
      .join('\n');

    const filename = `sandwich_builders_${rangeLabel}.csv`;
    download(csv, filename);
  }, [selectedBuilder, stats, dateRange.start, dateRange.end, builderDateRange.start, builderDateRange.end, bnbUsdt, timezone]);

  const handleExportPDF = useCallback(async () => {
    if (!reportRef.current) return;
    const node = reportRef.current;

    const canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'pt', 'a4');

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = canvas.height * (imgWidth / canvas.width);

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const who = selectedBuilder ? selectedBuilder : 'all_builders';
    const rangeLabel = (dateRange?.start && dateRange?.end)
      ? `${dateRange.start}_to_${dateRange.end}`
      : 'current_range';
    pdf.save(`sandwich_report_${who}_${rangeLabel}.pdf`);
  }, [reportRef, selectedBuilder, dateRange.start, dateRange.end]);


  const doSearch = useCallback(async (page = 1, filters = searchFilters, pageSizeOverride = null) => {
    if (!filters) return;
    
    setSearchLoading(true);
    try {
      const limitToUse = pageSizeOverride ?? searchLimit;

      const params = { page, limit: limitToUse, sortBy: filters.sortBy || 'time' };
      if (filters.victimTo) params.victim_to = filters.victimTo.trim().toLowerCase();
      if (filters.bundle) {
        params.is_bundle = filters.bundle === 'true';
      }
      if (filters.dateRange?.start && filters.dateRange?.end) {
        params.startDate = filters.dateRange.start;
        params.endDate = filters.dateRange.end;
      }
      if (filters.builder && filters.builder !== 'all') {
        params.builder = filters.builder;
      }
      // if ((filters.sortBy === 'profit' || filters.sortBy === 'profit_asc') && bnbUsdt) {
      //   params.bnbUsd = bnbUsdt;
      // }

      const res = await fetchSandwichSearch(params);
      
      if (res.success === false) {
        console.error('Search returned error:', res.error);
        setSearchResults([]);
        setSearchTotal(0);
        setSearchTotalPages(0);
        if (res.error) {
          alert(res.error);
        }
      } else {
        setSearchResults(res.data || []);
        setSearchTotal(res.total || 0);
        setSearchTotalPages(res.totalPages || Math.ceil((res.total || 0) / limitToUse));
        setSearchPage(page);
        setSearchLimit(limitToUse);
      }
    } finally {
      setSearchLoading(false);
    }
  }, [searchFilters, searchLimit, bnbUsdt]);


  const handleFilterSearch = useCallback(async (filters) => {
    if (!filters) {
      clearSearch();
      setSearchFilters(null);
      return;
    }

    setHasSearched(true);
    setSearchFilters(filters);
    await doSearch(1, filters);
  }, [doSearch]);

  const handleFilterPageChange = useCallback((page, pageSize) => {
    setSearchPage(page);
    doSearch(page, searchFilters, pageSize);
  }, [doSearch, searchFilters]);




  useEffect(() => {
    if (!authToken) {
      navigate('/login');
      return;
    }


    Promise.allSettled([
      fetchStats(dateRange.start, dateRange.end).catch(console.error),
      fetchBlocks().catch(console.error),
      loadBuilders().catch(console.error)
    ]);
  }, [authToken]);


  useEffect(() => {
    if (!authToken || isPaused) return;


    if (dateRange.start || dateRange.end) {
      fetchStats(dateRange.start, dateRange.end);
    }


    const statsInterval = setInterval(() => {
      fetchStats(dateRange.start, dateRange.end, { silent: true });
      fetchBlocks();
      setLastUpdate(new Date());
    // }, 60000);
  }, 30 * 60 * 1000);

    return () => {
      clearInterval(statsInterval);
    };
  }, [authToken, isPaused, dateRange.start, dateRange.end, fetchStats, fetchBlocks]);


  useEffect(() => {
    if (!authToken || isPaused) return;
    fetchStats(dateRange.start, dateRange.end, { silent: false });
    fetchBlocks();
    setLastUpdate(new Date());
  }, [authToken, isPaused]);


  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    if (!authToken || isPaused) return;

    if (isInitialLoad) {
      setIsInitialLoad(false);
      return;
    }

    fetchStats(dateRange.start, dateRange.end);
  }, [bundleFilter, amountRange.min, amountRange.max, frontrunRouter, isPaused]);


  useEffect(() => {
    if (!authToken) return;
    if (!selectedBuilder) {
      setBuilderStats(null);
      return;
    }
    if (isPaused) return;
    loadBuilderStats(selectedBuilder, dateRange.start, dateRange.end);
  }, [
    selectedBuilder,
    authToken,
    dateRange.start,
    dateRange.end,
    isPaused,
    bundleFilter,
    amountRange.min,
    amountRange.max,
    frontrunRouter
  ]);
  


  const [hasSearched, setHasSearched] = useState(false);


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

  const calculateTotalSandwichCount = (builder) => {
    if (!builder || !builder.profit_breakdown) return 0;
    return builder.profit_breakdown.reduce((sum, item) => sum + (item.count || 0), 0);
  };

  const calculateAvgProfitPerTx = (builder) => {
    const totalUSD = calculateTotalUSD(builder);
    const totalCount = calculateTotalSandwichCount(builder);
    if (totalCount === 0) return 0;
    return totalUSD / totalCount;
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


  const toggleBuilderSort = (key) => {
    setBuilderSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
  
      const isString = key === 'builder_name';
      return { key, dir: isString ? 'asc' : 'desc' };
    });
  };

  const getBuilderSortValue = (row, key) => {
    switch (key) {
      case 'builder_name': 
        return (row.builder_name || '').toLowerCase();
      case 'blocks': 
        return Number(row.blocks || 0);
      case 'sandwich_blocks': 
        return Number(row.sandwich_blocks || 0);
      case 'sandwich_percentage': 
        return Number(row.sandwich_percentage || 0);
      case 'avg_profit': 
        return Number(calculateAvgProfitPerTx(row) || 0);
      case 'mined_rate': 
        return Number(row.mined_rate || 0);
      default: 
        return 0;
    }
  };

  const renderSortIcon = (key) => {
    if (builderSort.key !== key) {
      return <span className="ml-1 text-[10px] opacity-60">↕</span>;
    }
    return (
      <span className="ml-1 text-[10px]">
        {builderSort.dir === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  const sortBuilders = (list) => {
    if (!list || !Array.isArray(list)) return [];
    const sorted = [...list];
    const { key, dir } = builderSort;
    
    sorted.sort((a, b) => {
      const aVal = getBuilderSortValue(a, key);
      const bVal = getBuilderSortValue(b, key);
      

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      

      if (typeof aVal === 'string' || typeof bVal === 'string') {
        return dir === 'asc' 
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      }
      
      return dir === 'asc' ? (aVal - bVal) : (bVal - aVal);
    });
    
    return sorted;
  };

  
  const sortedBuilders = useMemo(() => {
    return sortBuilders(stats?.breakdown_by_builder || []);
  }, [stats?.breakdown_by_builder, builderSort]);

  return (
    // <div className={`min-h-screen ${isMobile ? 'p-4' : 'p-8 mx-auto max-w-[1140px]'}`}>
    <div className={`min-h-screen watermark-container ${isMobile ? 'p-4' : 'p-8 mx-auto max-w-[1140px]'}`}> {/* Watermark */}
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <nav className="text-sm text-gray-600">
            <Link to="/data-center" className="text-[#F3BA2F] hover:underline">Data Center</Link>
            <span className="mx-2">/</span>
            <span>Sandwich Stats</span>
          </nav>
          <div className="text-sm text-gray-600">
            Last update: {formatBlockTime(lastUpdate.getTime(), timezone, 'full')}
          </div>
        </div>

        <hr className="my-4 border-t border-gray-300" />

        <div className={`${isMobile ? 'mb-6' : 'mb-8'}`}>
          <div className={`flex ${isMobile ? 'flex-col' : 'md:flex-row'} justify-between items-start gap-3`}>
            <div>
              <h1 className={`${isMobile ? 'text-xl' : 'text-2xl md:text-3xl'} font-bold text-gray-800 mb-2`}>
                Block Sandwich Attack Monitor
              </h1>
              <div className={`flex ${isMobile ? 'flex-col' : 'flex-row items-center gap-4'}`}>
                {stats?.earliest_block && (
                  <p className="text-sm text-gray-600 mt-2">
                    Starting Block: #{formatNumber(stats.earliest_block)}
                  </p>
                )}
              </div>
            </div>
            <div>
              <div className={`flex ${isMobile ? 'w-full justify-between' : 'items-center'} gap-2`}>
                <div className="flex items-center gap-2">
                  {bnbUsdt && (
                    <div className="text-sm text-gray-600 flex items-center">
                      1 BNB ≈ ${bnbUsdt.toFixed(2)} USD
                    </div>
                  )}

                  <Tooltip
                    title={isPaused ? 'Resume auto refresh' : 'Pause auto refresh'}
                    placement="top"
                  >
                    <Button
                      type="text"
                      onClick={toggle}
                      aria-pressed={isPaused}
                      icon={isPaused ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                      aria-label={isPaused ? 'Resume auto refresh' : 'Pause auto refresh'}
                    />
                  </Tooltip>
                </div>

                <div className="h-5 w-px bg-gray-300 hidden sm:block"></div>

                <div className={`${isMobile ? 'w-[180px]' : ''}`}>
                  <TimezoneSelector />
                </div>
                <div className={`flex ${isMobile ? 'w-full justify-end' : 'items-center'} gap-2`}>
                  {/* <Button onClick={handleExportCSV}>Export CSV</Button> */}
                  {/* <Button type="primary" onClick={handleExportPDF}>Generate PDF</Button> */}
                </div>
              </div>
              
              <div className="mt-2">
                <Link to="/sandwich-detect-logic">
                  <Button 
                    type="primary"
                    size="small"
                  >
                    Detection Logic
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div ref={reportRef}>
        <div className="bg-[#FFFBEC] rounded-2xl p-6 md:p-8 mb-8">
          <div className="text-center">
            <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-semibold mb-4 text-[#F3BA2F]`}>
              Sandwich Attack Rate
              {stats?.month_info?.monthName ? (
                <span className="block text-sm font-normal text-gray-600 mt-1">
                  ({stats.month_info.monthName})
                </span>
              ) : (dateRange.start && dateRange.end ? (
                <span className="block text-sm font-normal text-gray-600 mt-1">
                  ({compactRangeLabel(dateRange.start, dateRange.end)} {timezoneLabel})
                </span>
              ) : null)}
            </h2>
            {statsLoading ? (
              <div className="animate-pulse">
                <div className="h-12 bg-amber-100 rounded w-32 mx-auto mb-2"></div>
                <div className="h-6 bg-amber-100 rounded w-48 mx-auto"></div>
              </div>
            ) : (
              <>
                <div className={`${isMobile ? 'text-4xl' : 'text-6xl'} font-bold mb-2 text-gray-900`}>
                  {stats && stats.sandwich_percentage ? formatPercentage(stats.sandwich_percentage) : '0%'}
                </div>
                <div className={`${isMobile ? 'text-base' : 'text-lg'} text-gray-500`}>
                  {stats && stats.sandwich_blocks ? formatNumber(stats.sandwich_blocks) : '0'} / {stats && stats.total_blocks ? formatNumber(stats.total_blocks) : '0'} blocks
                </div>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded p-4 md:p-6">
            <div className="text-gray-900 text-sm mb-2">Total Blocks Analyzed</div>
            <div className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-gray-900`}>
              {stats ? formatNumber(stats.total_blocks) : '0'}
            </div>
            <div className="text-xs text-gray-400 mt-2">
              Block #{stats?.earliest_block || 0} to #{stats?.latest_block || 0}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded p-4 md:p-6">
            <div className="text-gray-900 text-sm mb-2">Blocks with Sandwich</div>
            <div className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-red-500`}>
              {stats ? formatNumber(stats.sandwich_blocks) : '0'}
            </div>
            <div className="text-xs text-gray-400 mt-2">
              Detected sandwich attacks
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded p-4 md:p-6">
            <div className="text-gray-900 text-sm mb-2">Latest Block</div>
            <div className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-yellow-400`}>
              #{stats?.latest_block || 0}
            </div>
            <div className="text-xs text-gray-400 mt-2">
              Most recent analyzed
            </div>
          </div>
        </div>


        <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 mb-8">
          <div data-html2canvas-ignore="true">
            <h2 className="relative pl-3 text-base font-semibold text-gray-900 mb-4 leading-6">
              <span
                aria-hidden="true"
                className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 bg-yellow-400"
              ></span>
              Builder Statistics & Filters
            </h2>

          <div className={`flex ${isMobile ? 'flex-col' : 'sm:flex-row sm:items-center'} gap-2 sm:gap-3 mb-4`}>
            <label className="text-sm text-gray-600">Filter by Builder:</label>

            <div className={`${isMobile ? 'w-full' : 'w-full sm:w-[200px]'}`}>
              <Select
                value={selectedBuilder}
                onChange={(value) => setSelectedBuilder(value)}
                options={[
                  { value: '', label: 'All Builders' },
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
              <Button
                type="primary"
                onClick={() => {
                  setShowBuilderDetails(true);
                  setBuilderPage(1);
                  loadBuilderSandwiches(selectedBuilder, 1);
                }}
                block={isMobile}
              >
                View Details
              </Button>
            )}
          </div>


          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Advanced Filters</span>
                {statsLoading && !isPaused && (
                  <span
                    className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700"
                    aria-live="polite"
                  >
                    <svg className="animate-spin h-3 w-3 mr-1" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 004 12z" />
                    </svg>
                    searching...
                  </span>
                )}
              </div>
              {(bundleFilter !== 'all' || amountRange.min || amountRange.max || frontrunRouter !== 'all') && (
                <Button
                  size="middle"
                  onClick={() => {
                    setBundleFilter('all');
                    setAmountRange({ min: '', max: '' });
                    setFrontrunRouter('all');
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>

            <div className={`grid grid-cols-1 ${isMobile ? '' : 'sm:grid-cols-2 lg:grid-cols-3'} gap-2`} aria-busy={statsLoading && !isPaused} aria-live="polite">
              <div>
                <label className="text-sm text-gray-600">Filter by Bundles:</label>
                <Select
                  value={bundleFilter}
                  onChange={(value) => setBundleFilter(value)}
                  className="w-full text-sm"
                  size="middle"
                  disabled={statsLoading || isPaused}
                >
                  <Option value="all">All</Option>
                  <Option value="bundle-only">Bundle Only</Option>
                  <Option value="non-bundle-only">Non-Bundle Only</Option>
                </Select>
              </div>

              <div>
                <label className="text-sm text-gray-600">Attacked Amount (USD):</label>
                <Select
                  value={amountRange?.filterType || 'all'}
                  onChange={(value) => {
                    switch (value) {
                      case 'lt1':
                        setAmountRange({ filterType: 'lt1', min: '', max: '1' });
                        break;
                      case 'gt1':
                        setAmountRange({ filterType: 'gt1', min: '1', max: '' });
                        break;
                      case 'gt10':
                        setAmountRange({ filterType: 'gt10', min: '10', max: '' });
                        break;
                      // case 'gt100':
                      //   setAmountRange({ filterType: 'gt100', min: '100', max: '' });
                      //   break;
                      // case 'gt1000':
                      //   setAmountRange({ filterType: 'gt1000', min: '1000', max: '' });
                      //   break;
                      default:
                        setAmountRange({ filterType: 'all', min: '', max: '' });
                    }
                  }}
                  className="w-full text-sm"
                  size="middle"
                  disabled={statsLoading || isPaused}
                >
                  <Option value="all">All</Option>
                  <Option value="lt1">&lt; $1</Option>
                  <Option value="gt1">&gt; $1</Option>
                  <Option value="gt10">&gt; $10</Option>
                  {/* <Option value="gt100">&gt; $100</Option> */}
                  {/* <Option value="gt1000">&gt; $1K</Option> */}
                </Select>
              </div>

              <div>
                <label className="text-sm text-gray-600">Frontrun TX Router:</label>
                <Select
                  value={frontrunRouter}
                  onChange={(value) => setFrontrunRouter(value)}
                  className="w-full text-sm"
                  size="middle"
                  disabled={statsLoading || isPaused}
                >
                  <Option value="all">All</Option>
                  <Option value="public">Public Router</Option>
                  <Option value="customized">Customized Contract</Option>
                </Select>
              </div>
            </div>


            {(bundleFilter !== 'all' || amountRange.min || amountRange.max || frontrunRouter !== 'all') && (
              <div className="mt-4 text-xs text-gray-500">
                Active filters:
                {bundleFilter !== 'all' && <span className="ml-1 px-2 py-1 bg-blue-50 text-blue-600 rounded">Bundle: {bundleFilter}</span>}
                {amountRange.filterType && amountRange.filterType !== 'all' && (
                  <span className="ml-1 px-2 py-1 bg-green-50 text-green-600 rounded">
                    Amount: {
                      amountRange.filterType === 'lt1' ? '< $1' :
                      amountRange.filterType === 'gt1' ? '> $1' :
                      amountRange.filterType === 'gt10' ? '> $10' :
                      // amountRange.filterType === 'gt100' ? '> $100' :
                      // amountRange.filterType === 'gt1000' ? '> $1K' : 
                      ''
                    }
                  </span>
                )}
                {frontrunRouter !== 'all' && <span className="ml-1 px-2 py-1 bg-purple-50 text-purple-600 rounded">Router: {frontrunRouter}</span>}
              </div>
            )}
          </div>

          <div className={`flex ${isMobile ? 'flex-col' : 'sm:flex-row sm:items-center'} gap-2 sm:gap-3 mt-4`}>
            <label className="text-sm text-gray-600">Date Range:</label>

            <div className={`${isMobile ? 'w-full' : 'w-full sm:w-[280px]'}`}>
              <DateRangePicker
                value={dateRange}
                onChange={(v) => {
                  setDateRange(v);
                  setActiveTimeFilter(null);
                }}
                inputReadOnly
                className="w-full"
              />
            </div>

            <div className={`flex gap-2 ${isMobile ? 'w-full' : ''}`}>
              <Button
                size="middle"
                type={activeTimeFilter === 'month' ? 'primary' : 'default'}
                onClick={() => {
                  const anchor = getAnchorMs(recentBlocks);
                  setDateRange(monthRangeFromUtcMs(anchor));
                  setActiveTimeFilter('month');
                }}
                disabled={statsLoading || isPaused}
              >
                This Month
              </Button>

              <Button
                size="middle"
                onClick={() => {
                  const anchor = getAnchorMs(recentBlocks);
                  setDateRange(prevMonthRangeFromUtcMs(anchor));
                }}
                disabled={statsLoading || isPaused}
              >
                Last Month
              </Button>

              <Button
                size="middle"
                type={activeTimeFilter === '2m' ? 'primary' : 'default'}
                onClick={() => {
                  setDateRange(minutesRangeFromNow(2));
                  setActiveTimeFilter('2m');
                }}
                disabled={statsLoading || isPaused}
              >
                Last 2m
              </Button>

              <Button
                size="middle"
                type={activeTimeFilter === '20m' ? 'primary' : 'default'}
                onClick={() => {
                  setDateRange(minutesRangeFromNow(20));
                  setActiveTimeFilter('20m');
                }}
                disabled={statsLoading || isPaused}
              >
                Last 20m
              </Button>

              <div className="flex items-center gap-1">
                <Input
                  size="middle"
                  placeholder="Min"
                  value={customMinutes}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setCustomMinutes(value);
                  }}
                  onPressEnter={() => {
                    if (customMinutes && Number(customMinutes) > 0) {
                      const range = minutesRangeFromNow(Number(customMinutes));
                      setDateRange(range);
                      setActiveTimeFilter(`custom-${customMinutes}`);
                      fetchStats(range.start, range.end);
                      if (selectedBuilder) {
                        loadBuilderStats(selectedBuilder, range.start, range.end);
                      }
                    }
                  }}
                  style={{ width: 60 }}
                  disabled={statsLoading || isPaused}
                />
                <span className="text-sm text-gray-600">m</span>
              </div>

            </div>

            <Button
              type="primary"
              onClick={() => {
                let range = dateRange;
                if (customMinutes && Number(customMinutes) > 0) {
                  range = minutesRangeFromNow(Number(customMinutes));
                  setDateRange(range);
                  setActiveTimeFilter(`custom-${customMinutes}`);
                }
                fetchStats(range.start, range.end);
                if (selectedBuilder) {
                  loadBuilderStats(selectedBuilder, range.start, range.end);
                }
              }}
              disabled={isPaused || statsLoading}
              block={isMobile}
            >
              {statsLoading && !isPaused ? 'Applying...' : 'Apply'}
            </Button>
            {(dateRange.start || dateRange.end) && (
              <Button
                onClick={() => {
                  setDateRange({ start: '', end: '' });
                  setActiveTimeFilter(null);
                  setCustomMinutes('');
                  fetchStats('', '');
                  if (selectedBuilder) {
                    loadBuilderStats(selectedBuilder, '', '');
                  }
                }}
                block={isMobile}
              >
                Clear
              </Button>
            )}
          </div>
          </div>

          {!selectedBuilder && stats && (
            <div className="text-sm text-gray-600">
              <div className="mt-2">Sandwich on Builder Blocks</div>
              <div className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-gray-900`}>
                {stats.sandwich_percentage_on_builder?.toFixed(4)}%
              </div>
              <div className="text-xs text-gray-400 mt-2">
                {`${formatNumber(stats.sandwich_builder_blocks)} / ${formatNumber(stats.builder_blocks)} blocks`}
              </div>


              {Array.isArray(stats.breakdown_by_builder) && stats.breakdown_by_builder.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm text-gray-600 mb-2">
                    Builders — sorted by <b>{
                      builderSort.key === 'builder_name' ? 'Builder' :
                      builderSort.key === 'blocks' ? 'Blocks' :
                      builderSort.key === 'sandwich_blocks' ? 'Sandwich' :
                      builderSort.key === 'sandwich_percentage' ? 'Rate' :
                      builderSort.key === 'avg_profit' ? 'USD/tx' :
                      'Mined Rate'
                    }</b> ({builderSort.dir === 'asc' ? 'asc' : 'desc'})
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[760px]">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th 
                            className="text-left py-2 px-2 text-gray-600 cursor-pointer select-none hover:bg-gray-50"
                            onClick={() => toggleBuilderSort('builder_name')}
                          >
                            Builder {renderSortIcon('builder_name')}
                          </th>
                          <th 
                            className="text-left py-2 px-2 text-gray-600 cursor-pointer select-none hover:bg-gray-50"
                            onClick={() => toggleBuilderSort('blocks')}
                          >
                            Blocks {renderSortIcon('blocks')}
                          </th>
                          <th 
                            className="text-left py-2 px-2 text-gray-600 cursor-pointer select-none hover:bg-gray-50"
                            onClick={() => toggleBuilderSort('sandwich_blocks')}
                          >
                            Sandwich {renderSortIcon('sandwich_blocks')}
                          </th>
                          <th 
                            className="text-left py-2 px-2 text-gray-600 cursor-pointer select-none hover:bg-gray-50"
                            onClick={() => toggleBuilderSort('sandwich_percentage')}
                          >
                            Rate {renderSortIcon('sandwich_percentage')}
                          </th>
                          <th 
                            className="text-left py-2 px-2 text-gray-600 cursor-pointer select-none hover:bg-gray-50"
                            onClick={() => toggleBuilderSort('avg_profit')}
                          >
                            attack amount(USD) / tx {renderSortIcon('avg_profit')}
                          </th>
                          <th 
                            className="text-left py-2 px-2 text-gray-600 cursor-pointer select-none hover:bg-gray-50"
                            onClick={() => toggleBuilderSort('mined_rate')}
                          >
                            Mined Rate {renderSortIcon('mined_rate')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedBuilders.slice(0, 10).map((b, idx) => (
                            <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-2 px-2 text-gray-700">{b.builder_name || '-'}</td>
                              <td className="py-2 px-2 text-gray-700">{formatNumber(b.blocks)}</td>
                              <td className="py-2 px-2 text-gray-700">{formatNumber(b.sandwich_blocks)}</td>
                              <td className="py-2 px-2 text-amber-600 font-semibold">
                                {Number(b.sandwich_percentage || 0).toFixed(4)}%
                              </td>
                              <td className="py-2 px-2 text-green-600 font-semibold">
                                {formatProfitUSD(calculateAvgProfitPerTx(b))}
                              </td>
                              <td className="py-2 px-2 text-blue-600 font-semibold">
                                {b.mined_rate ? `${Number(b.mined_rate).toFixed(2)}%` : '-'}
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
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Builder Blocks</div>
                  <div className="text-lg font-semibold">{formatNumber(builderStats.total_blocks)}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Sandwich Rate</div>
                  <div className="text-lg font-semibold">{builderStats.sandwich_percentage?.toFixed(2)}%</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Attack Amount(USD)/tx</div>
                  <div className="text-lg font-semibold">
                    {(() => {
                      const builderRow = (stats?.breakdown_by_builder || []).find(b => b.builder_name === selectedBuilder);
                      return builderRow ? formatProfitUSD(calculateAvgProfitPerTx(builderRow)) : '-';
                    })()}
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Mined Rate</div>
                  <div className="text-lg font-semibold">
                    {(() => {
                      const builderRow = (stats?.breakdown_by_builder || []).find(b => b.builder_name === selectedBuilder);
                      return builderRow?.mined_rate ? `${Number(builderRow.mined_rate).toFixed(2)}%` : '-';
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>


        <div className={`${isMobile ? 'mb-6' : 'mb-8'}`}>
          <SandwichChart
            dateRange={dateRange}
            bundleFilter={bundleFilter}
            amountRange={amountRange}
            frontrunRouter={frontrunRouter}
            loading={statsLoading && !isPaused}
            refreshKey={lastUpdate ? lastUpdate.getTime() : 0}
            snapshotBlock={stats?.latest_block || null}
            allBuilders={builders}
          />
        </div>
        </div>


        <SandwichFilter
          builders={sortedBuilders.map(b => b.builder_name).filter(Boolean)}
          onSearch={handleFilterSearch}
          onClear={() => handleFilterSearch(null)}
          loading={searchLoading}
          isMobile={isMobile}
          results={searchResults}
          totalResults={searchTotal}
          currentPage={searchPage}
          pageSize={searchLimit}
          onPageChange={handleFilterPageChange}
          className="mb-8"
        />

        {hasSearched && searchResults.length === 0 && !searchLoading && (
          <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded text-center text-gray-600">
            No results found for the search criteria. Try adjusting your filters.
          </div>
        )}
        
        {searchResults.length > 0 && (
            <div className="mt-4 mx-auto max-w-[1140px] overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-2 px-2 text-gray-600 font-medium text-xs">Block</th>
                    <th className="text-left py-2 px-2 text-gray-600 font-medium text-xs">Profit</th>
                    <th className="text-left py-2 px-2 text-gray-600 font-medium text-xs">Type</th>
                    <th className="text-left py-2 px-2 text-gray-600 font-medium text-xs">Victim Router</th>
                    <th className="text-left py-2 px-2 text-gray-600 font-medium text-xs">FrontRun TX</th>
                    <th className="text-left py-2 px-2 text-gray-600 font-medium text-xs">Victim TX</th>
                    <th className="text-left py-2 px-2 text-gray-600 font-medium text-xs">Backruns TXS</th>
                    <th className="text-left py-2 px-2 text-gray-600 font-medium text-xs">Builder</th>
                    <th className="text-left py-2 px-2 text-gray-600 font-medium text-xs">Validator</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100 hover:bg-amber-50 transition-colors">
                      <td className="py-2 px-2">
                        <a
                          href={`https://bscscan.com/block/${r.block_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-amber-600 font-semibold hover:text-amber-700 hover:underline text-sm"
                        >
                          #{r.block_number}
                        </a>
                      </td>

                      <td className="py-2 px-2 font-mono text-gray-800">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm">{formatWei(r.profit_wei, 18, 4)}</span>
                          <a
                            href={`https://bscscan.com/token/${r.profit_token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-amber-600 hover:text-amber-700 hover:underline font-semibold text-xs"
                          >
                            {getTokenSymbol(r.profit_token)}
                          </a>
                        </div>
                      </td>

                      <td className="py-2 px-2">
                        {r.is_bundle ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-500">
                            bundle{r.bundle_size ? ` (${r.bundle_size})` : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700">
                            non-bundle
                          </span>
                        )}
                      </td>

                      <td className="py-2 px-2">
                        <a
                          href={`https://bscscan.com/address/${r.victim_to}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-[10px] text-gray-500 hover:text-gray-700 hover:underline"
                        >
                          {short(r.victim_to, 8)}
                        </a>
                      </td>

                      <td className="py-2 px-2">
                        <a
                          href={`https://bscscan.com/tx/${r.front_tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-[10px] text-gray-500 hover:text-gray-700 hover:underline"
                        >
                          {short(r.front_tx_hash, 8)}
                        </a>
                      </td>

                      <td className="py-2 px-2">
                        <a
                          href={`https://bscscan.com/tx/${r.victim_tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-[10px] text-gray-500 hover:text-gray-700 hover:underline"
                        >
                          {short(r.victim_tx_hash, 8)}
                        </a>
                      </td>

                      <td className="py-2 px-2">
                        <div className="flex flex-col gap-0.5">
                          {r.backrun_txes?.slice(0, 2).map((h, i) => (
                            <a
                              key={h}
                              href={`https://bscscan.com/tx/${h}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-[10px] text-gray-500 hover:text-gray-700 hover:underline"
                            >
                              {i + 1}. {short(h, 8)}
                            </a>
                          ))}
                          {r.backrun_txes?.length > 2 && (
                            <span className="text-[10px] text-gray-400">+{r.backrun_txes.length - 2} more</span>
                          )}
                        </div>
                      </td>

                      <td className="py-2 px-2 text-gray-700 text-sm">
                        {r.builder_name || <span className="text-gray-400">-</span>}
                      </td>
                      <td className="py-2 px-2 text-gray-700 text-sm">
                        {r.validator_name || <span className="text-gray-400">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>


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
              <Button
                type="primary"
                onClick={onSearchTx}
                block={isMobile}
              >
                {txLoading ? 'Searching...' : 'Search'}
              </Button>
              {txSearched && (
                <Button
                  onClick={onClearTx}
                  block={isMobile}
                >
                  Clear
                </Button>
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
                      <td className="py-2 px-3">
                        <a
                          href={`https://bscscan.com/tx/${r.front_tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          {r.front_tx_hash.slice(0, 10)}...
                        </a>
                      </td>
                      <td className="py-2 px-3">
                        <a
                          href={`https://bscscan.com/tx/${r.victim_tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-red-600 hover:text-red-700 hover:underline"
                        >
                          {r.victim_tx_hash.slice(0, 10)}...
                        </a>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex flex-col gap-1">
                          {r.backrun_txes?.map((h, i) => (
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
              <Button
                type="primary"
                onClick={onSearchBlock}
                block={isMobile}
              >
                {blockLoading ? 'Searching...' : 'Search'}
              </Button>
              {blockSearched && (
                <Button
                  onClick={onClearBlock}
                  block={isMobile}
                >
                  Clear
                </Button>
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
                      <td className="py-2 px-3">
                        <a
                          href={`https://bscscan.com/tx/${r.front_tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          {r.front_tx_hash.slice(0, 10)}...
                        </a>
                      </td>
                      <td className="py-2 px-3">
                        <a
                          href={`https://bscscan.com/tx/${r.victim_tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-red-600 hover:text-red-700 hover:underline"
                        >
                          {r.victim_tx_hash.slice(0, 10)}...
                        </a>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex flex-col gap-1">
                          {r.backrun_txes?.map((h, i) => (
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
          <div className="max-w-[1140px] mx-auto overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-2 px-3 text-gray-600 font-medium text-sm">Block Number</th>
                  <th className="text-left py-2 px-3 text-gray-600 font-medium text-sm">Status</th>
                  <th className="text-left py-2 px-3 text-gray-600 font-medium text-sm">Time</th>
                  <th className="text-left py-2 px-3 text-gray-600 font-medium text-sm">Builder</th>
                  <th className="text-left py-2 px-3 text-gray-600 font-medium text-sm">Validator</th>
                </tr>
              </thead>
              <tbody>
                {blocksLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2 px-3">
                        <div className="animate-pulse h-4 bg-gray-200 rounded w-16"></div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="animate-pulse h-5 bg-gray-200 rounded w-20"></div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="animate-pulse h-4 bg-gray-200 rounded w-28"></div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="animate-pulse h-4 bg-gray-200 rounded w-20"></div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="animate-pulse h-4 bg-gray-200 rounded w-20"></div>
                      </td>
                    </tr>
                  ))
                ) : recentBlocks.map((block, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-amber-50 transition-colors">
                    <td className="py-2 px-3">
                      <a
                        href={`https://bscscan.com/block/${block.block_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-amber-600 font-medium hover:text-amber-700 hover:underline text-sm"
                      >
                        #{block.block_number}
                      </a>
                    </td>

                    <td className="py-2 px-3">
                      {block.has_sandwich ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          🥪 Sandwich Detected
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ✓ Clean
                        </span>
                      )}
                    </td>

                    <td className="py-2 px-3 text-gray-500 text-xs whitespace-nowrap">
                      {formatBlockTime(block.block_time_ms || block.block_time || block.updated_at, timezone, 'full')}
                    </td>

                    <td className="py-2 px-3 text-gray-700 text-sm">
                      {block.builder_name || <span className="text-gray-400">-</span>}
                    </td>
                    <td className="py-2 px-3 text-gray-700 text-sm">
                      {block.validator_name || <span className="text-gray-400">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>


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
                  <Button
                    type="text"
                    onClick={() => setShowBuilderDetails(false)}
                    className="self-end text-gray-500 hover:text-gray-700 text-2xl font-bold"
                  >
                    ×
                  </Button>
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


                <div className={`flex ${isMobile ? 'flex-wrap' : 'items-center'} gap-2 mt-3`}>
                  <span className="text-sm text-gray-600">Quick select:</span>
                  <Button
                    size="middle"
                    onClick={() => {
                      const end = new Date().toISOString().split('T')[0];
                      const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                      setBuilderDateRange({ start, end });
                      setBuilderPage(1);
                      loadBuilderSandwiches(selectedBuilder, 1, start, end);
                    }}
                  >
                    Last 7 days
                  </Button>
                  <Button
                    size="middle"
                    onClick={() => {
                      const end = new Date().toISOString().split('T')[0];
                      const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                      setBuilderDateRange({ start, end });
                      setBuilderPage(1);
                      loadBuilderSandwiches(selectedBuilder, 1, start, end);
                    }}
                  >
                    Last 30 days
                  </Button>
                  <Button
                    size="middle"
                    onClick={() => {
                      const end = new Date().toISOString().split('T')[0];
                      const start = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                      setBuilderDateRange({ start, end });
                      setBuilderPage(1);
                      loadBuilderSandwiches(selectedBuilder, 1, start, end);
                    }}
                  >
                    Last 2 months
                  </Button>
                  <Button
                    size="middle"
                    onClick={() => {
                      const end = new Date().toISOString().split('T')[0];
                      const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                      setBuilderDateRange({ start, end });
                      setBuilderPage(1);
                      loadBuilderSandwiches(selectedBuilder, 1, start, end);
                    }}
                  >
                    Last 3 months
                  </Button>
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
                    <Button
                      type="primary"
                      onClick={() => {
                        if (builderDateRange.start && builderDateRange.end) {
                          setBuilderPage(1);
                          loadBuilderSandwiches(selectedBuilder, 1, builderDateRange.start, builderDateRange.end);
                        }
                      }}
                      block={isMobile}
                    >
                      Apply
                    </Button>
                    {(builderDateRange.start || builderDateRange.end) && (
                      <Button
                        onClick={() => {
                          setBuilderDateRange({ start: '', end: '' });
                          setBuilderPage(1);
                          loadBuilderSandwiches(selectedBuilder, 1);
                        }}
                        block={isMobile}
                      >
                        Reset to default
                      </Button>
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
                    <div className="overflow-x-auto text-xs">
                      <table className="w-full min-w-[500px]">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="text-left py-1.5 px-2 text-gray-600 font-medium">Block</th>
                            <th className="text-left py-1.5 px-2 text-gray-600 font-medium">Time</th>
                            <th className="text-left py-1.5 px-2 text-gray-600 font-medium">Front TX</th>
                            <th className="text-left py-1.5 px-2 text-gray-600 font-medium">Victim TX</th>
                            <th className="text-left py-1.5 px-2 text-gray-600 font-medium">Backruns</th>
                            <th className="text-left py-1.5 px-2 text-gray-600 font-medium">Validator</th>
                          </tr>
                        </thead>
                        <tbody>
                          {builderSandwiches.map((s) => (
                            <tr key={s.id} className="border-b border-gray-100 hover:bg-amber-50 transition-colors">
                              <td className="py-1.5 px-2">
                                <a
                                  href={`https://bscscan.com/block/${s.block_number}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-amber-600 hover:text-amber-700 hover:underline"
                                  title={`Block #${s.block_number}`}
                                >
                                  #{s.block_number}
                                </a>
                              </td>
                              <td className="py-1.5 px-2 text-gray-600 whitespace-nowrap">
                                {s.block_time_ms ?
                                  formatBlockTime(s.block_time_ms, timezone, 'short') :
                                  formatBlockTime(s.block_time, timezone, 'short')}
                              </td>
                              <td className="py-1.5 px-2">
                                <a
                                  href={`https://bscscan.com/tx/${s.front_tx_hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-blue-600 hover:text-blue-700 hover:underline"
                                  title={s.front_tx_hash}
                                >
                                  {s.front_tx_hash.slice(0, 8)}...
                                </a>
                              </td>
                              <td className="py-1.5 px-2">
                                <a
                                  href={`https://bscscan.com/tx/${s.victim_tx_hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-red-600 hover:text-red-700 hover:underline"
                                  title={s.victim_tx_hash}
                                >
                                  {s.victim_tx_hash.slice(0, 10)}...
                                </a>
                              </td>
                              <td className="py-1.5 px-2">
                                <div className="flex flex-col gap-0.5">
                                  {s.backrun_txes?.slice(0, 2).map((h, i) => (
                                    <a
                                      key={h}
                                      href={`https://bscscan.com/tx/${h}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-mono text-gray-500 hover:text-gray-700 hover:underline"
                                      title={h}
                                    >
                                      {i + 1}. {h.slice(0, 8)}...
                                    </a>
                                  ))}
                                  {s.backrun_txes?.length > 2 && (
                                    <span className="text-gray-400" title={`${s.backrun_txes.length - 2} more transactions`}>
                                      +{s.backrun_txes.length - 2}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-1.5 px-2 text-gray-700">
                                <div className="max-w-[80px] truncate" title={s.validator_name || 'Unknown'}>
                                  {s.validator_name || '-'}
                                </div>
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
                        <Button
                          onClick={() => loadBuilderSandwiches(selectedBuilder, builderPage - 1, builderDateRange.start, builderDateRange.end)}
                          disabled={builderPage <= 1}
                        >
                          Previous
                        </Button>
                        <Button
                          onClick={() => loadBuilderSandwiches(selectedBuilder, builderPage + 1, builderDateRange.start, builderDateRange.end)}
                          disabled={builderPage >= builderTotalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
  );
};

export default SandwichStats;