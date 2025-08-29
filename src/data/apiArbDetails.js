// src/data/apiArbDetails.js
import axios from 'axios';

const BASE = 'http://localhost:3001';
// const BASE = 'http://15.204.163.45:8189'; 

const tokenHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem('authToken') || ''}`,
});


export const getArbDetails = async () => {
  const { data } = await axios.get(`${BASE}/api/arb/get-arb-details`, {
    headers: tokenHeader(),
  });
  return data;
};


export const getArbStatistic = async () => {
  const { data } = await axios.get(`${BASE}/api/arb/get-arb-statistic`, {
    headers: tokenHeader(),
  });


  Object.entries(data).forEach(([k, v]) => {
    const n = Number(v);
    if (!Number.isNaN(n)) data[k] = n;
  });

  return data;
};


export const getArbStatisticV2 = async () => {
  const { data } = await axios.get(`${BASE}/api/arb/get-arb-statistic-v2`, {
    headers: tokenHeader(),
  });
  return data;
};

export async function loginUser(username, password) {
  try {
    const response = await axios.post(`${BASE}/login`, 
      { username, password },
      { withCredentials: true } 
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: '登录失败' };
  }
}
