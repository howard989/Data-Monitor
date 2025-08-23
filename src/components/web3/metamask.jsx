import { useState, useEffect } from 'react';

const SwitchNetwork = ({
  chainId,
  chainName,
  rpcUrls,
  blockExplorerUrls,
  nativeCurrency,
}) => {
  const [error, setError] = useState(null);

  useEffect(() => {
    const switchNetwork = async () => {
      if (window.ethereum) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${parseInt(chainId, 10).toString(16)}`,
                chainName,
                rpcUrls,
                blockExplorerUrls,
                nativeCurrency,
              },
            ],
          });
          setError(null);
        } catch (switchError) {
          setError('Failed to add the network. Please try again.');
        }
      } else {
        setError('MetaMask is not installed. Please install MetaMask and try again.');
      }
    };

    switchNetwork();
  }, [chainId, chainName, rpcUrls, blockExplorerUrls, nativeCurrency]);

  return (
    <div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default SwitchNetwork;
