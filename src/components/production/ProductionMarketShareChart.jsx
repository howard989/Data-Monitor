import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { fetchProductionTrend } from '../../data/apiSandwichStats';

export default function ProductionMarketShareChart({ startDate, endDate, interval = 'daily', height = 360 }) {
  const [data, setData] = useState({ series: [], summary: { builders: [] } });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!startDate || !endDate) return;
    
    setLoading(true);
    fetchProductionTrend(interval, { startDate, endDate, mode: 'share' })
      .then(res => setData(res))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [startDate, endDate, interval]);

  const dates = data.series.map(d => d.date);
  const builders = data.summary.builders || [];

  const colors = [
    '#FFC801', '#5470c6', '#91cc75', '#fac858', '#ee6666', 
    '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'
  ];

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    grid: { 
      top: 60,
      right: 20,
      bottom: 60,
      left: 60,
      containLabel: true
    },
    legend: {
      type: 'scroll',
      top: 10,
      data: builders
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      axisLabel: {
        formatter: (v) => {
          const date = new Date(v);
          return `${date.getMonth() + 1}/${date.getDate()}`;
        },
        rotate: 45
      }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { formatter: '{value}%' }
    },
    series: builders.map((name, idx) => ({
      name,
      type: 'line',
      areaStyle: {
        opacity: 0.7
      },
      stack: 'total',
      smooth: false,
      showSymbol: false,
      data: data.series.map(d => Number(d[name] || 0)),
      itemStyle: {
        color: colors[idx % colors.length]
      },
      emphasis: {
        focus: 'series'
      }
    }))
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full text-gray-500">
        Loading...
      </div>
    );
  }

  return <ReactECharts option={option} style={{ height, width: '100%' }} />;
}