// PancakeSwap 合约常量
export const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
export const USDT = "0x55d398326f99059fF775485246999027B3197955";  // BSC上的USDT合约地址
export const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

export const ROUTER_ABI = [
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
            {"internalType": "address[]", "name": "path", "type": "address[]"}
        ],
        "name": "getAmountsOut",
        "outputs": [
            {"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}
        ],
        "stateMutability": "view",
        "type": "function"
    }
];