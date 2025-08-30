import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart
} from 'recharts';
import { fetchChartData } from '../data/apiSandwichStats';
import { useTimezone } from '../context/TimezoneContext';
import { formatBlockTime } from '../utils/timeFormatter';

const COLORS = [
  '#f59e0b', // amber-500
  '#eab308', // yellow-500
  '#84cc16', // lime-500
  '#10b981', // emerald-500
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
];

const SandwichChart = ({ dateRange }) => {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [interval, setInterval] = useState('daily');
  const [chartType, setChartType] = useState('line');
  const [selectedBuilders, setSelectedBuilders] = useState([]);
  const { timezone } = useTimezone();

  useEffect(() => {
    loadChartData();
  }, [dateRange.start, dateRange.end, interval]);

  const loadChartData = async () => {
    setLoading(true);
    try {
      const data = await fetchChartData(
        interval,
        dateRange.start,
        dateRange.end,
        selectedBuilders.length > 0 ? selectedBuilders : null
      );
      
      // Format dates for display
      if (data.series) {
        data.series = data.series.map(item => ({
          ...item,
          displayDate: formatBlockTime(new Date(item.date).getTime(), timezone, 
            interval === 'hourly' ? 'short' : 'date'
          )
        }));
      }
      
      setChartData(data);
    } catch (error) {
      console.error('Failed to load chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (!chartData || !chartData.series || chartData.series.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="text-center text-gray-500">No data available for the selected period</div>
      </div>
    );
  }

  const builders = chartData.summary?.builders || [];

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Sandwich Rate Trends</h2>
        
        <div className="flex gap-3">
          {/* Interval Selector */}
          <select
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>

          {/* Chart Type Selector */}
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value)}
            className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="line">Line Chart</option>
            <option value="area">Area Chart</option>
            <option value="composed">Combined View</option>
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-amber-50 rounded-lg p-3">
          <div className="text-xs text-gray-600">Avg Rate</div>
          <div className="text-xl font-bold text-amber-600">
            {chartData.summary?.avgRate || 0}%
          </div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3">
          <div className="text-xs text-gray-600">Total Blocks</div>
          <div className="text-xl font-bold text-yellow-600">
            {(chartData.summary?.totalBlocks || 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-orange-50 rounded-lg p-3">
          <div className="text-xs text-gray-600">Sandwiches</div>
          <div className="text-xl font-bold text-orange-600">
            {(chartData.summary?.totalSandwiches || 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-red-50 rounded-lg p-3">
          <div className="text-xs text-gray-600">Builders</div>
          <div className="text-xl font-bold text-red-600">
            {builders.length}
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <ResponsiveContainer width="100%" height={400}>
        {chartType === 'line' ? (
          <LineChart data={chartData.series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="displayDate" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              label={{ value: 'Sandwich Rate (%)', angle: -90, position: 'insideLeft' }}
              tick={{ fontSize: 12 }}
            />
            <Tooltip 
              formatter={(value) => `${value}%`}
              labelFormatter={(label) => `Time: ${label}`}
            />
            <Legend />
            
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
            {builders.map((builder, index) => (
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
              dataKey="displayDate" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              label={{ value: 'Sandwich Rate (%)', angle: -90, position: 'insideLeft' }}
              tick={{ fontSize: 12 }}
            />
            <Tooltip 
              formatter={(value) => `${value}%`}
              labelFormatter={(label) => `Time: ${label}`}
            />
            <Legend />
            
            {builders.map((builder, index) => (
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
              dataKey="displayDate" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              yAxisId="left"
              label={{ value: 'Sandwich Rate (%)', angle: -90, position: 'insideLeft' }}
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              label={{ value: 'Total Blocks', angle: 90, position: 'insideRight' }}
              tick={{ fontSize: 12 }}
            />
            <Tooltip 
              formatter={(value, name) => {
                if (name === 'Total Blocks') return value.toLocaleString();
                return `${value}%`;
              }}
              labelFormatter={(label) => `Time: ${label}`}
            />
            <Legend />
            
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
            
            {builders.slice(0, 3).map((builder, index) => (
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
          {builders.map((builder, index) => (
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