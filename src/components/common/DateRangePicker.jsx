import React from 'react';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const DateRangePicker = ({
  value = { start: '', end: '' },
  onChange,
  format = 'YYYY-MM-DD',
  ...rest
}) => {
  const toDayjs = (str) => (str ? dayjs(str, format) : null);

  const handleChange = (dates) => {
    if (!dates || dates.length !== 2 || !dates[0] || !dates[1]) {
      onChange?.({ start: '', end: '' });
      return;
    }
    onChange?.({
      start: dates[0].format(format),
      end: dates[1].format(format),
    });
  };

  return (
    <RangePicker
      value={[toDayjs(value.start), toDayjs(value.end)]}
      onChange={handleChange}
      format={format}
      allowClear
      {...rest}
    />
  );
};

export default DateRangePicker;
