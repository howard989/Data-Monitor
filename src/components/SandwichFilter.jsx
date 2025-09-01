import React, { useState, useCallback } from 'react';
import { Select, Input, Button, Pagination } from 'antd';
import DateRangePicker from './common/DateRangePicker';

const { Option } = Select;

const SandwichFilter = ({
  builders = [],
  onSearch,
  onClear,
  loading = false,
  isMobile = false,
  results = [],
  totalResults = 0,
  currentPage = 1,
  pageSize = 25,
  onPageChange,
  className = ''
}) => {
  
  const [victimTo, setVictimTo] = useState('');
  const [bundle, setBundle] = useState('');
  const [builder, setBuilder] = useState('');
  const [sortBy, setSortBy] = useState('time');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });


  const handleSearch = useCallback(() => {
    const filters = {
      victimTo: victimTo.trim(),
      bundle: bundle.trim(),
      builder: builder || undefined,
      sortBy,
      dateRange
    };
    onSearch(filters);
  }, [victimTo, bundle, builder, sortBy, dateRange, onSearch]);


  const handleClear = useCallback(() => {
    setVictimTo('');
    setBundle('');
    setBuilder('');
    setSortBy('time');
    setDateRange({ start: '', end: '' });
    onClear();
  }, [onClear]);


  const handlePageChange = useCallback((page) => {
    onPageChange(page, pageSize);
  }, [onPageChange, pageSize]);


  const handlePageSizeChange = useCallback((current, size) => {
    onPageChange(1, size);
  }, [onPageChange]);
  
  return (
    <div className={`bg-white rounded-xl p-6 border border-gray-200 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Filter Sandwiches</h3>
        
 
        <div className={`grid grid-cols-1 ${isMobile ? 'gap-3' : 'md:grid-cols-5 gap-3'}`}>
          <div>
            <label className="text-gray-600 text-sm">Victim Router (tx.to)</label>
            <Input
              value={victimTo}
              onChange={(e) => setVictimTo(e.target.value)}
              placeholder="0x..."
              className="w-full text-sm"
              size="middle"
              disabled={loading}
            />
          </div>


          <div>
            <label className="text-gray-600 text-sm">Bundle</label>
            <Select
              value={bundle}
              onChange={setBundle}
              className="w-full text-sm"
              size="middle"
              disabled={loading}
              options={[
                { value: '', label: 'All' },
                { value: 'true', label: 'Bundle only' },
                { value: 'false', label: 'Non-bundle only' },
              ]}
            />
          </div>


          <div>
            <label className="text-gray-600 text-sm">Builder (optional)</label>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              value={builder || undefined}
              onChange={(v) => setBuilder(v || '')}
              className="w-full text-sm"
              placeholder="All Builders"
              size="middle"
              disabled={loading}
              options={builders.map((b) => ({ value: b, label: b }))}
            />
          </div>


          <div>
            <label className="text-gray-600 text-sm">Sort By</label>
            <Select
              value={sortBy}
              onChange={setSortBy}
              className="w-full text-sm"
              size="middle"
              disabled={loading}
            >
              <Option value="time">Time (Newest First)</Option>
              <Option value="time_asc">Time (Oldest First)</Option>
              <Option value="profit">Profit (Highest First)</Option>
              <Option value="profit_asc">Profit (Lowest First)</Option>
            </Select>
          </div>

   
          <div className={`flex ${isMobile ? 'flex-col' : 'items-end'} gap-2`}>
            <Button
              type="primary"
              onClick={handleSearch}
              loading={loading}
              className={`${isMobile ? 'w-full' : ''}`}
              size="middle"
            >
              Search
            </Button>
            <Button
              onClick={handleClear}
              disabled={loading}
              className={`${isMobile ? 'w-full' : ''}`}
              size="middle"
            >
              Clear
            </Button>
          </div>
        </div>

 
        <div className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-3 mt-3`}>
          <label className="text-gray-600 text-sm">Date Range:</label>
          <div className={`${isMobile ? 'w-full' : ''}`}>
            <DateRangePicker
              value={dateRange}
              onChange={(v) => setDateRange(v)}
              style={{ minWidth: isMobile ? 0 : 260, width: isMobile ? '100%' : undefined }}
              inputReadOnly
              size="middle"
            />
          </div>
        </div>
      </div>


      {totalResults > 0 && (
        <div className="mb-3 text-sm text-gray-600">
          Found {totalResults} sandwich{totalResults > 1 ? 'es' : ''}
        </div>
      )}

  
      {results.length > 0 && (
        <>
          <div className="mb-4">
          </div>


          <div className="flex justify-center mt-4">
            <Pagination
              current={currentPage}
              total={totalResults}
              pageSize={pageSize}
              onChange={handlePageChange}
              onShowSizeChange={handlePageSizeChange}
              showSizeChanger
              showTotal={(total, range) => `${range[0]}-${range[1]} of ${total}`}
              pageSizeOptions={['10', '25', '50', '100']}
              size={isMobile ? 'small' : 'default'}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default SandwichFilter;
