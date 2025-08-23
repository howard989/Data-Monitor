import React, { useState, useEffect } from 'react';

const SandwichStats = () => {
  const [stats, setStats] = useState(null);
  const [recentBlocks, setRecentBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const API_URL = 'http://localhost:3001';

  // const API_URL = 'http://localhost:8189';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const fetchData = async () => {
    try {
      const [statsRes, blocksRes] = await Promise.all([
        fetch(`${API_URL}/api/sandwich/stats`, {
          method: 'GET',
          headers: getAuthHeaders()
        }),
        fetch(`${API_URL}/api/sandwich/recent?limit=20`, {
          method: 'GET',
          headers: getAuthHeaders()
        })
      ]);

      if (statsRes.ok && blocksRes.ok) {
        const statsData = await statsRes.json();
        const blocksData = await blocksRes.json();
        
        setStats(statsData.data);
        setRecentBlocks(blocksData.data);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  
    const interval = setInterval(() => {
      fetchData();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatPercentage = (num) => {
    return `${parseFloat(num).toFixed(4)}%`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-7xl mx-auto">

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            MEV Sandwich Attack Monitor
          </h1>
      
          <p className="text-sm text-gray-500 mt-2">
            Last update: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>


        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-8 mb-8 text-white shadow-xl">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-4">Sandwich Attack Rate</h2>
            <div className="text-6xl font-bold mb-2">
              {stats && stats.sandwich_percentage ? formatPercentage(stats.sandwich_percentage) : '0%'}
            </div>
            <div className="text-lg opacity-90">
              {stats && stats.sandwich_blocks ? formatNumber(stats.sandwich_blocks) : '0'} / {stats && stats.total_blocks ? formatNumber(stats.total_blocks) : '0'} blocks
            </div>
          </div>
        </div>


        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg">
            <div className="text-gray-500 text-sm mb-2">Total Blocks Analyzed</div>
            <div className="text-3xl font-bold text-gray-900">
              {stats ? formatNumber(stats.total_blocks) : '0'}
            </div>
            <div className="text-xs text-gray-400 mt-2">
              Block #{stats?.earliest_block || 0} to #{stats?.latest_block || 0}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg">
            <div className="text-gray-500 text-sm mb-2">Blocks with Sandwich</div>
            <div className="text-3xl font-bold text-red-600">
              {stats ? formatNumber(stats.sandwich_blocks) : '0'}
            </div>
            <div className="text-xs text-gray-400 mt-2">
              Detected sandwich attacks
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg">
            <div className="text-gray-500 text-sm mb-2">Latest Block</div>
            <div className="text-3xl font-bold text-blue-600">
              #{stats?.latest_block || 0}
            </div>
            <div className="text-xs text-gray-400 mt-2">
              Most recent analyzed
            </div>
          </div>
        </div>

        
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Blocks</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-gray-600 font-medium">Block Number</th>
                  <th className="text-left py-3 px-4 text-gray-600 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-gray-600 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentBlocks.map((block, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono text-blue-600 font-medium">
                        #{block.block_number}
                      </span>
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
                      {new Date(block.updated_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SandwichStats;