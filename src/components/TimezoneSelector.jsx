import React from 'react';
import { Select } from 'antd';
import { useTimezone, TIMEZONES } from '../context/TimezoneContext';
import { getTimezoneOffset } from '../utils/timeFormatter';

const TimezoneSelector = () => {
  const { timezoneKey, setTimezone } = useTimezone();

  const timezoneOptions = Object.entries(TIMEZONES).map(([key, { label, value }]) => ({
    value: key,
    label: `${label} ${getTimezoneOffset(value)}`,
  }));

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600">Timezone:</span>
      <Select
        value={timezoneKey}
        onChange={(value) => setTimezone(value)}
        options={timezoneOptions}
        style={{ width: 160 }}
      />
    </div>
  );
};

export default TimezoneSelector;