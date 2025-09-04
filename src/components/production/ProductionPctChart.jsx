import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { fetchProductionPct } from '../../data/apiSandwichStats';

export default function ProductionPctChart({ startDate, endDate, interval = 'daily', snapshotBlock = null }) {
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!startDate || !endDate) return;
    
    setLoading(true);
    fetchProductionPct(interval, { startDate, endDate, snapshotBlock })
      .then(res => setSeries(res.series || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [startDate, endDate, interval, snapshotBlock]);

  const option = {
    tooltip: { 
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    grid: { 
      top: 60, 
      right: 60, 
      bottom: 60, 
      left: 60,
      containLabel: true 
    },
    legend: {
      data: ['MEV Blocks', 'Percentage'],
      top: 10
    },
    xAxis: {
      type: 'category',
      data: series.map(d => d.date),
      axisLabel: { 
        formatter: (v) => {
          const date = new Date(v);
          return `${date.getMonth() + 1}/${date.getDate()}`;
        },
        rotate: 45
      }
    },
    yAxis: [
      { 
        type: 'value', 
        name: 'Blocks',
        position: 'left',
        axisLabel: { formatter: '{value}' }
      },
      { 
        type: 'value', 
        name: 'Percentage',
        position: 'right',
        min: 0,
        max: 100,
        axisLabel: { formatter: '{value}%' }
      }
    ],
    series: [
      {
        name: 'MEV Blocks',
        type: 'bar',
        data: series.map(d => d.builder_blocks),
        itemStyle: { 
          color: '#5470c6'
        },
        barWidth: '60%'
      },
      {
        name: 'Percentage',
        type: 'line',
        yAxisIndex: 1,
        data: series.map(d => d.pct),
        smooth: true,
        lineStyle: { 
          width: 2,
          color: '#FFC801'
        },
        itemStyle: { 
          color: '#FFC801'
        },
        emphasis: {
          lineStyle: { width: 3 }
        }
      }
    ]
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 mb-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">
        MEV Block PCT — Percentage (Vs Total Blocks)
      </h3>
      {loading ? (
        <div className="flex justify-center items-center h-80">
          <div className="text-gray-500">Loading...</div>
        </div>
      ) : (
        <ReactECharts option={option} style={{ height: 320 }} />
      )}
    </div>
  );
}