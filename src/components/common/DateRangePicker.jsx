import React, { useEffect, useMemo, useState } from 'react';
import { DatePicker, Space } from 'antd';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tzPlugin from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(utc);
dayjs.extend(tzPlugin);
dayjs.extend(customParseFormat);

const { RangePicker } = DatePicker;

const MOBILE_MAX_WIDTH = 640;

const DateRangePicker = ({
  value = { start: '', end: '' },
  onChange,
  format = 'YYYY-MM-DD',
  allowClear = true,
  disabledDate,
  timezone,
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

  const toDayjs = (str) => {
    if (!str) return null;
    return timezone ? dayjs.tz(str, format, timezone) : dayjs(str, format);
  };

  const startValue = useMemo(() => toDayjs(value.start), [value.start, format, timezone]);
  const endValue = useMemo(() => toDayjs(value.end), [value.end, format, timezone]);

  const handleRangeChange = (dates) => {
    if (!dates || dates.length !== 2 || !dates[0] || !dates[1]) {
      onChange?.({ start: '', end: '' });
      return;
    }

    onChange?.({
      start: timezone ? dates[0].tz(timezone).format(format) : dates[0].format(format),
      end: timezone ? dates[1].tz(timezone).format(format) : dates[1].format(format),
    });
  };

  const handleStartChange = (date) => {
    onChange?.({
      start: date ? (timezone ? date.tz(timezone).format(format) : date.format(format)) : '',
      end: value.end || '',
    });
  };

  const handleEndChange = (date) => {
    onChange?.({
      start: value.start || '',
      end: date ? (timezone ? date.tz(timezone).format(format) : date.format(format)) : '',
    });
  };

  const defaultStartDisabledDate = (current) => {
    if (!endValue) return false;
    const hasTimeSelection = rest.showTime;
    if (hasTimeSelection) {
      return false; 
    }
    return current && current.isAfter(endValue, 'day');
  };

  const defaultEndDisabledDate = (current) => {
    if (!startValue) return false;
    const hasTimeSelection = rest.showTime;
    if (hasTimeSelection) {
      return false; 
    }
    return current && current.isBefore(startValue, 'day');
  };

  const startDisabledDate = disabledDate || defaultStartDisabledDate;
  const endDisabledDate = disabledDate || defaultEndDisabledDate;

  if (!isMobile) {
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


  return (
    <Space.Compact style={{ width: '100%' }}>
      <DatePicker
        value={startValue}
        onChange={handleStartChange}
        format={format}
        allowClear={allowClear}
        placeholder="Start Date"
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
        placeholder="End Date"
        inputReadOnly
        style={{ flex: 1 }}
        disabledDate={endDisabledDate}
        {...rest}
      />
    </Space.Compact>
  );
};

export default DateRangePicker;
