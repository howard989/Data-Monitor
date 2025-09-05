import { useEffect, useState } from 'react';
import Web3 from 'web3';
import { PANCAKE_ROUTER, WBNB, USDT, ROUTER_ABI } from '../contracts/pancakeswap';
import { useOptionalPause } from '../context/PauseContext';

export default function useBnbUsdPrice(pollMs = 3000) {
  const [bnbUsdt, setBnbUsdt] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  
  const { isPaused, isPausedRef } = useOptionalPause();

  useEffect(() => {
    const provider = 'https://bsc-dataseed.binance.org/';
    const web3 = new Web3(provider);
    const router = new web3.eth.Contract(ROUTER_ABI, PANCAKE_ROUTER);
    
    let cancelled = false;

    const fetchPrice = async () => {
      if (isPausedRef.current || cancelled) return;
      
      try {
        const amountIn = web3.utils.toWei('1', 'ether');
        const amounts = await router.methods.getAmountsOut(amountIn, [WBNB, USDT]).call();
        const price = Number(web3.utils.fromWei(amounts[1], 'ether'));
        
        if (!isPausedRef.current && !cancelled) {
          setBnbUsdt(price);
          setLastUpdated(Date.now());
          setError(null);
        }
      } catch (e) {
        console.error('Failed to fetch BNB price:', e);
        if (!isPausedRef.current && !cancelled) {
          setError(e);
        }
      }
    };

    fetchPrice();
    
    if (isPaused || !pollMs) {
      return () => { cancelled = true; };
    }
    
    const t = setInterval(fetchPrice, pollMs);
    return () => { 
      cancelled = true; 
      clearInterval(t); 
    };
  }, [pollMs, isPaused]);

  return { bnbUsdt, lastUpdated, error };
}