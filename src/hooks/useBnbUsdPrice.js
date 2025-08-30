import { useEffect, useState } from 'react';
import Web3 from 'web3';
import { PANCAKE_ROUTER, WBNB, USDT, ROUTER_ABI } from '../contracts/pancakeswap';

export default function useBnbUsdPrice(pollMs = 3000) {
  const [bnbUsdt, setBnbUsdt] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const provider = 'https://bsc-dataseed.binance.org/';
    const web3 = new Web3(provider);
    const router = new web3.eth.Contract(ROUTER_ABI, PANCAKE_ROUTER);

    const fetchPrice = async () => {
      try {
        const amountIn = web3.utils.toWei('1', 'ether'); // 1 BNB
        const amounts = await router.methods.getAmountsOut(amountIn, [WBNB, USDT]).call();
        // USDT has 18 decimals on BSC
        const price = Number(web3.utils.fromWei(amounts[1], 'ether'));
        setBnbUsdt(price);
        setLastUpdated(Date.now());
        setError(null);
      } catch (e) {
        console.error('Failed to fetch BNB price:', e);
        setError(e);
      }
    };

    fetchPrice();
    const t = setInterval(fetchPrice, pollMs);
    return () => clearInterval(t);
  }, [pollMs]);

  return { bnbUsdt, lastUpdated, error };
}