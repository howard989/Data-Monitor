import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Bar
} from 'recharts';
import { fetchChartData } from '../data/apiSandwichStats';
import { useTimezone } from '../context/TimezoneContext';
import { Select, Spin } from 'antd';

const COLORS = [
  '#f59e0b', 
  '#eab308', 
  '#84cc16', 
  '#10b981', 
  '#06b6d4', 
  '#3b82f6', 
  '#8b5cf6', 
  '#ec4899', 
];

const intervalOptions = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' }
];

const chartTypeOptions = [
  { value: 'line', label: 'Line Chart' },
  { value: 'area', label: 'Area Chart' },
  { value: 'composed', label: 'Combined View' }
];

const SandwichChart = ({ dateRange, bundleFilter, amountRange, frontrunRouter, loading: parentLoading, refreshKey, snapshotBlock, allBuilders = [] }) => {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [interval, setInterval] = useState('daily');
  const [chartType, setChartType] = useState('line');
  const [availableBuilders, setAvailableBuilders] = useState([]);
  const [builderFilter, setBuilderFilter] = useState('all'); 

  const [builderMode, setBuilderMode] = useState('all');
  const [includedBuilders, setIncludedBuilders] = useState([]);
  const [excludedBuilder, setExcludedBuilder] = useState(null);
  const { timezone } = useTimezone();
  
  const tickFormatter = React.useCallback((d) => {
    const ms = new Date(d).getTime();
    if (Number.isNaN(ms)) return '';
    switch (interval) {
      case 'hourly':
        return new Intl.DateTimeFormat(undefined, {
          timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false
        }).format(ms);
      case 'daily':
        return new Intl.DateTimeFormat(undefined, {
          timeZone: timezone, month: 'short', day: 'numeric'
        }).format(ms);
      case 'weekly':
        return new Intl.DateTimeFormat(undefined, {
          timeZone: timezone, month: 'short', day: 'numeric'
        }).format(ms);
      case 'monthly':
        return new Intl.DateTimeFormat(undefined, {
          timeZone: timezone, year: 'numeric', month: 'short'
        }).format(ms);
      default:
        return new Intl.DateTimeFormat(undefined, {
          timeZone: timezone, month: 'short', day: 'numeric'
        }).format(ms);
    }
  }, [interval, timezone]);

  const tooltipLabelFormatter = React.useCallback((d) => {
    const ms = new Date(d).getTime();
    if (Number.isNaN(ms)) return '';
    switch (interval) {
      case 'hourly':
        return new Intl.DateTimeFormat(undefined, {
          timeZone: timezone, year:'numeric', month:'short', day:'numeric',
          hour:'2-digit', minute:'2-digit', hour12:false
        }).format(ms);
      case 'daily':
      case 'weekly':
        return new Intl.DateTimeFormat(undefined, {
          timeZone: timezone, year:'numeric', month:'short', day:'numeric'
        }).format(ms);
      case 'monthly':
        return new Intl.DateTimeFormat(undefined, {
          timeZone: timezone, year:'numeric', month:'long'
        }).format(ms);
      default:
        return new Intl.DateTimeFormat(undefined, {
          timeZone: timezone, year:'numeric', month:'short', day:'numeric'
        }).format(ms);
    }
  }, [interval, timezone]);
  
  useEffect(() => {
    if (allBuilders && allBuilders.length > 0) {
      setAvailableBuilders(allBuilders);
    }
  }, [allBuilders]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

 
  useEffect(() => {
    if (builderMode !== 'include' && builderFilter === 'all' && snapshotBlock == null) return;
    if (parentLoading && snapshotBlock == null) return;
    
    loadChartData(false);
  }, [dateRange.start, dateRange.end, interval, builderFilter, bundleFilter, amountRange, frontrunRouter, snapshotBlock, parentLoading, builderMode, includedBuilders, excludedBuilder]);


  useEffect(() => {
    if (!refreshKey) return;
    if (builderMode !== 'include' && builderFilter === 'all' && snapshotBlock == null) return;
    if (parentLoading && snapshotBlock == null) return;
    
    loadChartData(true);
  }, [refreshKey, builderFilter, snapshotBlock, parentLoading, builderMode]);

  const loadChartData = async (silent = false) => {
    if (builderMode !== 'include' && builderFilter === 'all' && snapshotBlock == null) {
      return;
    }
    if (parentLoading && snapshotBlock == null) {
      return;
    }
    
    if (!silent) setLoading(true);
    try {
      let buildersToFetch = null;
      if (builderMode === 'include') {
        buildersToFetch = includedBuilders.length ? includedBuilders : null;
      } else if (builderMode === 'all') {
        buildersToFetch = builderFilter !== 'all' ? [builderFilter] : null;
      } else if (builderMode === 'exclude') {
        buildersToFetch = null; 
      }
      
      const data = await fetchChartData(
        interval,
        dateRange.start,
        dateRange.end,
        buildersToFetch,
        bundleFilter,
        amountRange,
        frontrunRouter,
        snapshotBlock
      );

 
      setChartData(data);

      if (data.summary?.builders) {
        const topBuilders = data.summary.builders || [];
        const map = new Map();
        [...topBuilders, ...allBuilders].forEach(b => {
          if (!b) return;
          const key = String(b).toLowerCase();
          if (!map.has(key)) map.set(key, b);
        });
        setAvailableBuilders(Array.from(map.values()).sort());
      }
    } catch (error) {
      console.error('Failed to load chart data:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  if (loading || parentLoading) {
    return (
      <div className="bg-white rounded-xl p-6 border border-gray-200 relative">
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70">
          <Spin size="large" />
        </div>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (!chartData || !chartData.series || chartData.series.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="text-center text-gray-500">No data available for the selected period</div>
      </div>
    );
  }

  const builders = chartData.summary?.builders || [];
  

  let shownBuilders = builders;
  if (builderMode === 'include') {
    shownBuilders = includedBuilders.length ? includedBuilders.filter(b => builders.includes(b)) : builders;
  } else if (builderMode === 'exclude' && excludedBuilder) {
    shownBuilders = builders.filter(b => b !== excludedBuilder);
  } else if (builderMode === 'all' && builderFilter !== 'all') {
    shownBuilders = [builderFilter].filter(b => builders.includes(b));
  }

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 md:gap-0 mb-6">
        <h2 className="relative pl-3 text-base font-semibold text-gray-900 leading-6 md:mb-0">
          <span
            aria-hidden="true"
            className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 bg-yellow-400"
          ></span>
          Sandwich Rate Trends
        </h2>

        <div className="w-full md:w-auto grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-row gap-3">
          {/* Builder Selector with Multi-select */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span className="text-sm text-gray-600">Builder:</span>
            <Select
              value={builderMode}
              onChange={setBuilderMode}
              options={[
                { value: 'all', label: 'All' },
                { value: 'include', label: 'Include only' },
                { value: 'exclude', label: 'Exclude one' },
              ]}
              style={{ width: isMobile ? '100%' : 120 }}
              size="small"
            />
            {builderMode === 'include' ? (
              <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"                  
              filterOption={(input, option) =>         
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              value={includedBuilders}
              onChange={setIncludedBuilders}
              options={availableBuilders.map((b) => ({ value: b, label: b }))}
              placeholder="Select builders"
              style={{ minWidth: isMobile ? '100%' : 200, maxWidth: 300 }}
              maxTagCount={2}
              size="small"
              />
            ) : builderMode === 'exclude' ? (
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                value={excludedBuilder}
                onChange={setExcludedBuilder}
                options={availableBuilders.map((b) => ({ value: b, label: b }))}
                placeholder="Exclude builder"
                style={{ minWidth: isMobile ? '100%' : 180 }}
                size="small"
              />
            ) : (
              <Select
                showSearch
                optionFilterProp="label"
                value={builderFilter}
                onChange={setBuilderFilter}
                options={[
                  { value: 'all', label: 'All Top Builders' },
                  ...availableBuilders.map((b) => ({ value: b, label: b }))
                ]}
                style={{ width: isMobile ? '100%' : 180 }}
                size="small"
              />
            )}
          </div>

          {/* Interval Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span className="text-sm text-gray-600">Interval:</span>
            <Select
              value={interval}
              onChange={(value) => setInterval(value)}
              options={intervalOptions}
              style={{ width: isMobile ? '100%' : 120 }}
            />
          </div>

          {/* Chart Type Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span className="text-sm text-gray-600">Chart Type:</span>
            <Select
              value={chartType}
              onChange={(value) => setChartType(value)}
              options={chartTypeOptions}
              style={{ width: isMobile ? '100%' : 140 }}
            />
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-amber-50 rounded p-3">
          <div className="text-xs text-gray-600">Avg Rate</div>
          <div className="text-xl font-bold text-amber-600">
            {chartData.summary?.avgRate || 0}%
          </div>
        </div>
        <div className="bg-yellow-50 rounded p-3">
          <div className="text-xs text-gray-600">Total Blocks</div>
          <div className="text-xl font-bold text-yellow-600">
            {(chartData.summary?.totalBlocks || 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-orange-50 rounded p-3">
          <div className="text-xs text-gray-600">Sandwiches</div>
          <div className="text-xl font-bold text-orange-600">
            {(chartData.summary?.totalSandwiches || 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-red-50 rounded p-3">
          <div className="text-xs text-gray-600">Builders</div>
          <div className="text-xl font-bold text-red-600">
            {builders.length}
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={isMobile ? 300 : 420}>
        {chartType === 'line' ? (
          <LineChart data={chartData.series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: isMobile ? 10 : 12 }}
              angle={isMobile ? 0 : -45}
              textAnchor={isMobile ? 'middle' : 'end'}
              height={isMobile ? 40 : 80}
              tickFormatter={tickFormatter}
              minTickGap={isMobile ? 20 : 8}
              interval="preserveStartEnd"
            />
            <YAxis
              label={{ value: 'Sandwich Rate (%)', angle: -90, position: 'insideLeft' }}
              tick={{ fontSize: isMobile ? 10 : 12 }}
              domain={[0, 'dataMax']}
              scale="linear"
            />
            <Tooltip
              formatter={(value) => `${value}%`}
              labelFormatter={tooltipLabelFormatter}
            />
            {!isMobile && <Legend />}

            {/* Overall rate line */}
            <Line
              type="monotone"
              dataKey="overall_rate"
              name="Overall"
              stroke="#6b7280"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />

            {/* Builder lines */}
            {shownBuilders.map((builder, index) => (
              <Line
                key={builder}
                type="monotone"
                dataKey={builder}
                name={builder}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        ) : chartType === 'area' ? (
          <AreaChart data={chartData.series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: isMobile ? 10 : 12 }}
              angle={isMobile ? 0 : -45}
              textAnchor={isMobile ? 'middle' : 'end'}
              height={isMobile ? 40 : 80}
              tickFormatter={tickFormatter}
              minTickGap={isMobile ? 20 : 8}
              interval="preserveStartEnd"
            />
            <YAxis
              label={{ value: 'Sandwich Rate (%)', angle: -90, position: 'insideLeft' }}
              tick={{ fontSize: isMobile ? 10 : 12 }}
              domain={[0, 'dataMax']}
              scale="linear"
            />
            <Tooltip
              formatter={(value) => `${value}%`}
              labelFormatter={tooltipLabelFormatter}
            />
            {!isMobile && <Legend />}

            {shownBuilders.map((builder, index) => (
              <Area
                key={builder}
                type="monotone"
                dataKey={builder}
                name={builder}
                stroke={COLORS[index % COLORS.length]}
                fill={COLORS[index % COLORS.length]}
                fillOpacity={0.3}
                stackId="1"
              />
            ))}
          </AreaChart>
        ) : (
          <ComposedChart data={chartData.series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: isMobile ? 10 : 12 }}
              angle={isMobile ? 0 : -45}
              textAnchor={isMobile ? 'middle' : 'end'}
              height={isMobile ? 40 : 80}
              tickFormatter={tickFormatter}
              minTickGap={isMobile ? 20 : 8}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="left"
              label={{ value: 'Sandwich Rate (%)', angle: -90, position: 'insideLeft' }}
              tick={{ fontSize: isMobile ? 10 : 12 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              label={{ value: 'Total Blocks', angle: 90, position: 'insideRight' }}
              tick={{ fontSize: isMobile ? 10 : 12 }}
            />
            <Tooltip
              formatter={(value, name) => {
                if (name === 'Total Blocks') return value.toLocaleString();
                return `${value}%`;
              }}
              labelFormatter={tooltipLabelFormatter}
            />
            {!isMobile && <Legend />}

            {/* Bar for total blocks */}
            <Bar
              yAxisId="right"
              dataKey="overall_total"
              name="Total Blocks"
              fill="#e5e7eb"
              opacity={0.5}
            />

            {/* Lines for sandwich rates */}
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="overall_rate"
              name="Overall Rate"
              stroke="#6b7280"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />

            {shownBuilders.slice(0, 3).map((builder, index) => (
              <Line
                key={builder}
                yAxisId="left"
                type="monotone"
                dataKey={builder}
                name={builder}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </ComposedChart>
        )}
      </ResponsiveContainer>

      {/* Builder Legend with Toggle */}
      <div className="mt-6 border-t pt-4">
        <div className="text-sm text-gray-600 mb-2">Top Builders by Activity:</div>
        <div className="flex flex-wrap gap-2">
          {shownBuilders.map((builder, index) => (
            <div
              key={builder}
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100"
              style={{
                backgroundColor: `${COLORS[index % COLORS.length]}20`,
                color: COLORS[index % COLORS.length]
              }}
            >
              <div
                className="w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              {builder}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SandwichChart;