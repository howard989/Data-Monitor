import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { authFetch, API_URL } from '../data/apiClient';
import { fetchAttackByTx, fetchAttacksByBlock, fetchBuilderList, fetchSandwichStats } from '../data/apiSandwichStats';




const SandwichStats = () => {
  const [stats, setStats] = useState(null);
  const [recentBlocks, setRecentBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const { authToken, logout } = useContext(AuthContext);
  const navigate = useNavigate();



  const [txQuery, setTxQuery] = useState('');
  const [txResults, setTxResults] = useState([]);
  const [txLoading, setTxLoading] = useState(false);

  const [blockQuery, setBlockQuery] = useState('');
  const [blockResults, setBlockResults] = useState([]);
  const [blockLoading, setBlockLoading] = useState(false);
  const [blockError, setBlockError] = useState('');


  const [blockMeta, setBlockMeta] = useState(null);
  const [blockClean, setBlockClean] = useState(false);



const [builders, setBuilders] = useState([]);
const [selectedBuilder, setSelectedBuilder] = useState('');
const [builderStats, setBuilderStats] = useState(null);


const loadBuilders = async () => {
  const { data } = await fetchBuilderList();
  setBuilders(data || []);
};

const loadBuilderStats = async (name) => {
  const { data } = await fetchSandwichStats(name || null);
  setBuilderStats(data || null);
};


  const handleUnauthorized = () => {
    logout();
    navigate('/login');
  };

  const fetchStats = async () => {
    // setStats(null);
    try {
      const statsRes = await authFetch(`${API_URL}/api/sandwich/stats`, {
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
    // setRecentBlocks([]);
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
    try {
      const { data } = await fetchAttackByTx(txQuery.trim());
      setTxResults(data || []);
    } catch {
      setTxResults([]);
    } finally {
      setTxLoading(false);
    }
  };

  const onSearchBlock = async () => {
    if (!blockQuery) return;
    setBlockLoading(true);
    setBlockError('');
    setBlockMeta(null);
    setBlockClean(false);
    try {
      const res = await fetchAttacksByBlock(blockQuery.trim());
      const { data, is_clean, meta } = res || {};
      setBlockResults(data || []);
      setBlockMeta(meta || null);
      setBlockClean(!!is_clean);
      if (!data || data.length === 0) {
        setBlockError('This block is clean');
      }
    } catch (e) {
      setBlockResults([]);
      setBlockMeta(null);
      setBlockError('Query failed');
    } finally {
      setBlockLoading(false);
    }
  };

  useEffect(() => {
    if (!authToken) {
      navigate('/login');
      return;
    }

    fetchStats();
    fetchBlocks();

    const statsInterval = setInterval(() => {
      fetchStats();
    }, 5000);

    const blocksInterval = setInterval(() => {
      fetchBlocks();
    }, 60000);

    return () => {
      clearInterval(statsInterval);
      clearInterval(blocksInterval);
    };
  }, [authToken]);



  useEffect(() => {
    if (!authToken) return;
    loadBuilders();
  }, [authToken]);
  
  useEffect(() => {
    if (!authToken) return;
    if (selectedBuilder) {
      loadBuilderStats(selectedBuilder);
    } else {
      setBuilderStats(null);
    }
  }, [selectedBuilder, authToken]);

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


        {/* Builder Filter */}
<div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg mb-8">
  <div className="flex items-center gap-3 mb-4">
    <label className="text-gray-600">Filter by Builder:</label>
    <select
      value={selectedBuilder}
      onChange={(e) => setSelectedBuilder(e.target.value)}
      className="border rounded-lg px-3 py-2"
    >
      <option value="">All Builders (global)</option>
      {builders.map((b) => (
        <option key={b} value={b}>{b}</option>
      ))}
    </select>
  </div>

  {!selectedBuilder && stats && (
    <div className="text-sm text-gray-600">
      <div className="mb-2">Sandwich on Builder Blocks</div>
      <div className="text-3xl font-bold text-gray-900">
        {stats.sandwich_percentage_on_builder?.toFixed(4)}%
      </div>
      <div className="text-xs text-gray-400 mt-2">
        {`${formatNumber(stats.sandwich_builder_blocks)} / ${formatNumber(stats.builder_blocks)} blocks`}
      </div>

      {/* 可选：Top builders 小表 */}
      {Array.isArray(stats.breakdown_by_builder) && stats.breakdown_by_builder.length > 0 && (
        <div className="mt-4">
          <div className="text-sm text-gray-600 mb-2">Top Builders</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Builder</th>
                  <th className="text-left py-2 px-2">Blocks</th>
                  <th className="text-left py-2 px-2">Sandwich</th>
                  <th className="text-left py-2 px-2">Rate</th>
                </tr>
              </thead>
              <tbody>
                {stats.breakdown_by_builder.slice(0, 5).map((b, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="py-2 px-2">{b.builder_name || '-'}</td>
                    <td className="py-2 px-2">{formatNumber(b.blocks)}</td>
                    <td className="py-2 px-2">{formatNumber(b.sandwich_blocks)}</td>
                    <td className="py-2 px-2">{b.sandwich_percentage.toFixed(4)}%</td>
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
    <div className="text-sm text-gray-600">
      <div className="mb-2">Sandwich Rate for <span className="font-semibold">{selectedBuilder}</span></div>
      <div className="text-3xl font-bold text-gray-900">
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


        {/* Search by TX */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Search by TX Hash</h2>
          <div className="flex gap-3">
            <input
              value={txQuery}
              onChange={(e) => setTxQuery(e.target.value)}
              placeholder="0x..."
              className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring"
            />
            <button onClick={onSearchTx} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
              {txLoading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {txResults.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3">Block</th>
                    <th className="text-left py-2 px-3">Front</th>
                    <th className="text-left py-2 px-3">Victim</th>
                    <th className="text-left py-2 px-3">Backruns</th>
                    <th className="text-left py-2 px-3">Builder</th>
                    <th className="text-left py-2 px-3">Validator</th>
                  </tr>
                </thead>
                <tbody>
                  {txResults.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100">
                      <td className="py-2 px-3 font-mono">#{r.block_number}</td>
                      <td className="py-2 px-3 font-mono">{r.front_tx_hash}</td>
                      <td className="py-2 px-3 font-mono">{r.victim_tx_hash}</td>
                      <td className="py-2 px-3">
                        <div className="flex flex-col gap-1">
                          {r.backrun_txes?.map((h, i) => (
                            <span key={h} className="font-mono text-sm">{i + 1}. {h}</span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 px-3">{r.builder_name || '-'}</td>
                      <td className="py-2 px-3">{r.validator_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          )}
        </div>

        {blockMeta && (
          <div className="mt-3 text-sm text-gray-600">
            <div>Builder: <span className="font-medium">{blockMeta.builder_name || '-'}</span></div>
            <div>Validator: <span className="font-medium">{blockMeta.validator_name || '-'}</span></div>
          </div>
        )}
        {blockError && <div className="text-red-600 text-sm mt-2">{blockError}</div>}

        {/* Search by Block */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Search by Block</h2>
          <div className="flex gap-3">
            <input
              value={blockQuery}
              onChange={(e) => setBlockQuery(e.target.value)}
              placeholder="Block number"
              className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring"
            />
            <button onClick={onSearchBlock} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
              {blockLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
          {blockError && <div className="text-red-600 text-sm mt-2">{blockError}</div>}

          {blockResults.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3">Attack ID</th>
                    <th className="text-left py-2 px-3">Front</th>
                    <th className="text-left py-2 px-3">Victim</th>
                    <th className="text-left py-2 px-3">Backruns</th>
                    <th className="text-left py-2 px-3">Builder</th>
                    <th className="text-left py-2 px-3">Validator</th>
                  </tr>
                </thead>
                <tbody>
                  {blockResults.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100">
                      <td className="py-2 px-3">{r.id}</td>
                      <td className="py-2 px-3 font-mono">{r.front_tx_hash}</td>
                      <td className="py-2 px-3 font-mono">{r.victim_tx_hash}</td>
                      <td className="py-2 px-3">
                        <div className="flex flex-col gap-1">
                          {r.backrun_txes?.map((h, i) => (
                            <span key={h} className="font-mono text-sm">{i + 1}. {h}</span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 px-3">{r.builder_name || '-'}</td>
                      <td className="py-2 px-3">{r.validator_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          )}
        </div>


        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Blocks</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4">Block Number</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Time</th>
                  <th className="text-left py-3 px-4">Builder</th>
                  <th className="text-left py-3 px-4">Validator</th>
                </tr>
              </thead>
              <tbody>
                {recentBlocks.map((block, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-3 px-4 font-mono">#{block.block_number}</td>
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
                      {new Date(block.block_time || block.updated_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">{block.builder_name || '-'}</td>
                    <td className="py-3 px-4">{block.validator_name || '-'}</td>
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