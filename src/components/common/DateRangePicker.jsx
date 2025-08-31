import React, { useEffect, useMemo, useState } from 'react';
import { DatePicker, Space } from 'antd';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const MOBILE_MAX_WIDTH = 640;

const DateRangePicker = ({
  value = { start: '', end: '' },
  onChange,
  format = 'YYYY-MM-DD',
  allowClear = true,
  disabledDate,
  ...rest
}) => {

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () =>
      setIsMobile(typeof window !== 'undefined' && window.innerWidth < MOBILE_MAX_WIDTH);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const toDayjs = (str) => (str ? dayjs(str, format) : null);

  const startValue = useMemo(() => toDayjs(value.start), [value.start, format]);
  const endValue = useMemo(() => toDayjs(value.end), [value.end, format]);

  const handleRangeChange = (dates) => {
    if (!dates || dates.length !== 2 || !dates[0] || !dates[1]) {
      onChange?.({ start: '', end: '' });
      return;
    }
    onChange?.({
      start: dates[0].format(format),
      end: dates[1].format(format),
    });
  };

  const handleStartChange = (date) => {
    onChange?.({
      start: date ? date.format(format) : '',
      end: value.end || '',
    });
  };

  const handleEndChange = (date) => {
    onChange?.({
      start: value.start || '',
      end: date ? date.format(format) : '',
    });
  };

  const defaultStartDisabledDate = (current) => {
    if (!endValue) return false;
    return current && current.isAfter(endValue, 'day');
  };

  const defaultEndDisabledDate = (current) => {
    if (!startValue) return false;
    return current && current.isBefore(startValue, 'day');
  };

  const startDisabledDate = disabledDate || defaultStartDisabledDate;
  const endDisabledDate = disabledDate || defaultEndDisabledDate;

  if (!isMobile) {
    // 桌面端
    return (
      <RangePicker
        value={[startValue, endValue]}
        onChange={handleRangeChange}
        format={format}
        allowClear={allowClear}
        disabledDate={disabledDate}
        {...rest}
      />
    );
  }

  // 移动端
  return (
    <Space.Compact style={{ width: '100%' }}>
      <DatePicker
        value={startValue}
        onChange={handleStartChange}
        format={format}
        allowClear={allowClear}
        placeholder="开始日期"
        inputReadOnly
        style={{ flex: 1 }}
        disabledDate={startDisabledDate}
        {...rest}
      />
      <DatePicker
        value={endValue}
        onChange={handleEndChange}
        format={format}
        allowClear={allowClear}
        placeholder="结束日期"
        inputReadOnly
        style={{ flex: 1 }}
        disabledDate={endDisabledDate}
        {...rest}
      />
    </Space.Compact>
  );
};

export default DateRangePicker;
