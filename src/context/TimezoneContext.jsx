import React, { createContext, useState, useContext } from 'react';

const TimezoneContext = createContext({
  timezone: 'UTC',
  setTimezone: () => {},
  timezoneLabel: 'UTC'
});

export const TIMEZONES = {
  'UTC': { label: 'UTC', value: 'UTC' },
  'Beijing': { label: 'Beijing Time', value: 'Asia/Shanghai' },
  'PST': { label: 'PST/PDT', value: 'America/Los_Angeles' },
  'EST': { label: 'EST/EDT', value: 'America/New_York' }
};

export const TimezoneProvider = ({ children }) => {
  const [timezone, setTimezone] = useState(() => {
    const saved = localStorage.getItem('userTimezone');
    return saved && TIMEZONES[saved] ? saved : 'UTC';
  });

  const updateTimezone = (tz) => {
    setTimezone(tz);
    localStorage.setItem('userTimezone', tz);
  };

  const timezoneLabel = TIMEZONES[timezone]?.label || 'UTC';

  return (
    <TimezoneContext.Provider value={{ 
      timezone: TIMEZONES[timezone]?.value || 'UTC',
      timezoneKey: timezone,
      setTimezone: updateTimezone,
      timezoneLabel 
    }}>
      {children}
    </TimezoneContext.Provider>
  );
};

export const useTimezone = () => {
  const context = useContext(TimezoneContext);
  if (!context) {
    throw new Error('useTimezone must be used within TimezoneProvider');
  }
  return context;
};