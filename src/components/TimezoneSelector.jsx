import React from 'react';
import { useTimezone, TIMEZONES } from '../context/TimezoneContext';
import { getTimezoneOffset } from '../utils/timeFormatter';

const TimezoneSelector = () => {
  const { timezoneKey, setTimezone, timezone } = useTimezone();
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600">Timezone:</span>
      <select
        value={timezoneKey}
        onChange={(e) => setTimezone(e.target.value)}
        className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
      >
        {Object.entries(TIMEZONES).map(([key, { label, value }]) => (
          <option key={key} value={key}>
            {label} {getTimezoneOffset(value)}
          </option>
        ))}
      </select>
    </div>
  );
};

export default TimezoneSelector;