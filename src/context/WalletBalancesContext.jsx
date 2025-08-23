// src/context/WalletBalancesContext.jsx
import React, { createContext, useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import defaultWallets from '../data/wallets.json';
import tagAIWallets from '../data/tagAIwallets.json';
import fourMMV3Wallets from '../data/4mmV3Wallets.json';
import fourMMUpgradeWallets from '../data/4mmUpgradeWallets.json';

// 防抖动函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const WALLET_TYPES = {
  DEFAULT: 'default',
  TAG_AI: 'tag_ai',
  FOUR_MM_V3: 'four_mm_v3',
  FOUR_MM_UPGRADE: 'four_mm_upgrade'
};

const API_BASE_URL = 'http://localhost:3001';
// const API_BASE_URL = 'http://15.204.163.45:8083';
//const API_BASE_URL = 'http://148.66.49.26:8083'; //香港服务器

export const WalletBalancesContext = createContext();

export const WalletBalancesProvider = ({ children }) => {
  const [defaultWalletBalances, setDefaultWalletBalances] = useState({});
  const [tagAIWalletBalances, setTagAIWalletBalances] = useState({});
  const [fourMMV3WalletBalances, setFourMMV3WalletBalances] = useState({});
  const [fourMMUpgradeWalletBalances, setFourMMUpgradeWalletBalances] = useState({});

  useEffect(() => {
    try {
      const defaultCache = localStorage.getItem('defaultWalletBalances');
      if (defaultCache) {
        setDefaultWalletBalances(JSON.parse(defaultCache));
      }
      const fourMMUpgradeCache = localStorage.getItem('fourMMUpgradeWalletBalances');
      if (fourMMUpgradeCache) {
        setFourMMUpgradeWalletBalances(JSON.parse(fourMMUpgradeCache));
      }
      const tagAICache = localStorage.getItem('tagAIWalletBalances');
      if (tagAICache) {
        setTagAIWalletBalances(JSON.parse(tagAICache));
      }
      const fourMMV3Cache = localStorage.getItem('fourMMV3WalletBalances');
      if (fourMMV3Cache) {
        setFourMMV3WalletBalances(JSON.parse(fourMMV3Cache));
      }
    } catch (err) {
      console.error('读取本地缓存的余额出错:', err);
    }
  }, []);


  const fetchBalances = async (walletType = WALLET_TYPES.DEFAULT) => {
    const walletAddresses = walletType === WALLET_TYPES.TAG_AI ? tagAIWallets : walletType === WALLET_TYPES.FOUR_MM_V3 ? fourMMV3Wallets : walletType === WALLET_TYPES.FOUR_MM_UPGRADE ? fourMMUpgradeWallets : defaultWallets;
    const batchSize = 20; // 每批处理20个地址
    const results = {};
    let hasError = false;

    for (let i = 0; i < walletAddresses.length; i += batchSize) {
      const batch = walletAddresses.slice(i, i + batchSize);
      try {
        const response = await fetch(`${API_BASE_URL}/api/getWalletBalances`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ addresses: batch })
        });

        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();
        if (data.success) {
          Object.assign(results, data.balances);
        }
      } catch (err) {
        console.error(`批次 ${i / batchSize + 1} 获取失败:`, err);
        hasError = true;
        continue; // 继续处理下一批
      }

      // 每批处理后添加小延迟，避免请求过于密集
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 更新状态
    if (Object.keys(results).length > 0) {
      if (walletType === WALLET_TYPES.DEFAULT) {
        setDefaultWalletBalances(results);
        localStorage.setItem('defaultWalletBalances', JSON.stringify(results));
      } else if (walletType === WALLET_TYPES.TAG_AI) {
        setTagAIWalletBalances(results);
        localStorage.setItem('tagAIWalletBalances', JSON.stringify(results));
      } else if (walletType === WALLET_TYPES.FOUR_MM_V3) {
        setFourMMV3WalletBalances(results);
        localStorage.setItem('fourMMV3WalletBalances', JSON.stringify(results));
      } else if (walletType === WALLET_TYPES.FOUR_MM_UPGRADE) {
        setFourMMUpgradeWalletBalances(results);
        localStorage.setItem('fourMMUpgradeWalletBalances', JSON.stringify(results));
      }
    }

    // 如果有错误但仍然获取到了一些数据，显示警告而不是错误
    if (hasError && Object.keys(results).length > 0) {
      message.warning('部分钱包余额获取失败，请稍后重试');
    }
  };

  // 添加防抖动的fetchBalances
  const debouncedFetchBalances = useCallback(
    debounce((walletType) => {
      fetchBalances(walletType);
    }, 5000),
    []
  );

  return (
    <WalletBalancesContext.Provider value={{
      defaultWalletBalances,
      tagAIWalletBalances,
      fourMMV3WalletBalances,
      fourMMUpgradeWalletBalances,
      fetchBalances,
      debouncedFetchBalances,
      WALLET_TYPES
    }}>
      {children}
    </WalletBalancesContext.Provider>
  );
};
