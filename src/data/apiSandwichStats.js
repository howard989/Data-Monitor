// const API_URL = 'http://localhost:3001';

const API_URL = 'http://15.204.163.45:8189';  

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

export const fetchSandwichOverview = async (limit = 1000) => {
  try {
    const response = await fetch(`${API_URL}/api/sandwich/overview?limit=${limit}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch sandwich overview');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching sandwich overview:', error);
    throw error;
  }
};

export const fetchSandwichBlocks = async (limit = 100, offset = 0) => {
  try {
    const response = await fetch(`${API_URL}/api/sandwich/blocks?limit=${limit}&offset=${offset}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch sandwich blocks');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching sandwich blocks:', error);
    throw error;
  }
};

export const fetchHourlyStats = async (hours = 24) => {
  try {
    const response = await fetch(`${API_URL}/api/sandwich/hourly?hours=${hours}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch hourly stats');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching hourly stats:', error);
    throw error;
  }
};

