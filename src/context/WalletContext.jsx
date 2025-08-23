import { createContext, useState, useContext, useEffect } from 'react';
import { BrowserProvider } from 'ethers';
import { message } from 'antd';

const WalletContext = createContext();

export function useWallet() {
    const context = useContext(WalletContext);
    if (!context) {
        throw new Error('useWallet must be used within a WalletProvider');
    }
    return context;
}

export function WalletProvider({ children }) {
    const [isWalletConnected, setIsWalletConnected] = useState(false);
    const [walletAddress, setWalletAddress] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);
    const [isRequestPending, setIsRequestPending] = useState(false);
    const [currentProvider, setCurrentProvider] = useState(null);
    const [balance, setBalance] = useState('0');

    // 获取钱包余额
    const getBalance = async (provider, address) => {
        try {
            const balance = await provider.getBalance(address);
            const balanceInEth = parseFloat(balance) / 1e18;
            setBalance(balanceInEth.toFixed(4));
        } catch (error) {
            console.error('获取余额失败:', error);
        }
    };

    // 格式化钱包地址显示
    const formatAddress = (address) => {
        if (!address) return '';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    const connectWallet = async () => {
        if (isRequestPending) {
            message.warning('已有连接请求在处理中，请等待或刷新页面重试');
            return;
        }

        setErrorMessage(null);
        setIsRequestPending(true);

        try {
            if (typeof window !== 'undefined' && window.ethereum) {
                const accounts = await window.ethereum.request({ 
                    method: 'eth_requestAccounts' 
                });

                if (accounts.length > 0) {
                    const provider = new BrowserProvider(window.ethereum);
                    setCurrentProvider(provider);
                    setWalletAddress(accounts[0]);
                    setIsWalletConnected(true);
                    await getBalance(provider, accounts[0]);
                    
                    // 存储连接状态
                    localStorage.setItem('walletConnected', 'true');
                    message.success('钱包连接成功！');
                }
            } else {
                setErrorMessage('请安装MetaMask钱包');
                message.error('请安装MetaMask钱包');
            }
        } catch (error) {
            console.error('连接钱包错误:', error);
            if (error.code === -32002) {
                message.warning('MetaMask 已打开，请检查浏览器扩展程序');
            } else if (error.code === 4001) {
                message.error('您拒绝了连接请求');
            } else {
                message.error('连接钱包失败：' + error.message);
            }
            disconnectWallet();
        } finally {
            setIsRequestPending(false);
        }
    };

    const disconnectWallet = () => {
        // 重置所有状态
        setWalletAddress(null);
        setIsWalletConnected(false);
        setCurrentProvider(null);
        setBalance('0');
        setErrorMessage(null);
        setIsRequestPending(false);
        
        // 清除本地存储并标记为已断开
        localStorage.removeItem('walletAddress');
        localStorage.setItem('walletConnected', 'false');
        
        message.success('钱包已断开连接');
    };

    useEffect(() => {
        // 检查钱包状态
        const checkWalletConnection = async () => {
            // 检查是否手动断开过连接
            const wasConnected = localStorage.getItem('walletConnected');
            if (wasConnected === 'false') {
                return; // 如果之前手动断开过，不自动重连
            }

            if (typeof window !== 'undefined' && window.ethereum) {
                try {
                    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                    if (accounts.length > 0) {
                        const provider = new BrowserProvider(window.ethereum);
                        setCurrentProvider(provider);
                        setWalletAddress(accounts[0]);
                        setIsWalletConnected(true);
                        await getBalance(provider, accounts[0]);
                        localStorage.setItem('walletConnected', 'true');
                    }
                } catch (error) {
                    console.error('检查钱包状态失败:', error);
                }
            }
        };

        checkWalletConnection();

        if (window.ethereum) {
            // 监听账户变化
            const handleAccountsChanged = async (accounts) => {
                if (accounts.length > 0) {
                    const provider = new BrowserProvider(window.ethereum);
                    setCurrentProvider(provider);
                    setWalletAddress(accounts[0]);
                    setIsWalletConnected(true);
                    await getBalance(provider, accounts[0]);
                    localStorage.setItem('walletConnected', 'true');
                } else {
                    disconnectWallet();
                }
            };

            // 监听链变化
            const handleChainChanged = () => {
                window.location.reload();
            };

            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', handleChainChanged);

            return () => {
                if (window.ethereum.removeListener) {
                    window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                    window.ethereum.removeListener('chainChanged', handleChainChanged);
                }
            };
        }
    }, []);

    const value = {
        isWalletConnected,
        walletAddress,
        formattedAddress: formatAddress(walletAddress),
        balance,
        errorMessage,
        isRequestPending,
        currentProvider,
        connectWallet,
        disconnectWallet
    };

    return (
        <WalletContext.Provider value={value}>
            {children}
        </WalletContext.Provider>
    );
}