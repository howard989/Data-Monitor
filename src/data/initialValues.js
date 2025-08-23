// 定义高频每个选项的初始值
export const INITIAL_VALUES = {
    backrunbuy: {
        address_excludes: [],
        sellPctBound: "0.000001",
        sellPctRange: ["0.04", "0.07", "0.1", "0.15", "0.2", "0.5", "0.8", "0.95"],
        buyToReservePct: [40, 35, 20, 15, 10, 5, 2, 1],
        buyUpperBoundPct: "70",
        buyAmountInMinPct: [15, 10, 7, 6, 4, 3, 2, 1],
        bundleFirstCost: [0.01, 0.02, 0.03, 0.04, 0.06, 0.1, 0.4, 0.9],
        bundleFirstCostMax: 0.3,
        bundleSecondCost: [0.01, 0.02, 0.03, 0.002, 0.003, 0.003, 0.01, 0.2],
        bundleSecondCostMax: 0.05,
        onlyFirstBundle: false,
        onlyBundle: false,
        maxGas: "17000000000"
    },
    backrunsell: {
        address_excludes: ["0x0", "0x1"],
        buyPctBound: "0.00000003",
        buyPctRange: ["0.05", "0.07", "0.1", "0.15"],
        sellRatio: ["50", "70", "85", "100"],
        bundleFirstCost: [0.01, 0.03, 0.04, 0.05],
        bundleFirstCostMax: 0.02,
        bundleSecondCost: [0.01, 0.03, 0.04, 0.05],
        bundleSecondCostMax: 0.02
    },
    approvesell: {
        address_excludes: ["0x0", "0x1"],
        approvePct: [0.02, 0.07],
        buyAfter: false
    },
    frontrunbuy: {
        address_excludes: [],
        buyPctBound: "0.000001",
        buyPctRange: ["0.04", "0.07", "0.1", "0.15", "0.2", "0.5", "0.8", "0.95"],
        maxBuyAmount: "100000000000000000",
        buyAmountPct: [40, 35, 20, 15, 10, 5, 2, 1],
        bundleFirstCost: [0.01, 0.02, 0.03, 0.04, 0.06, 0.1, 0.4, 0.9],
        bundleFirstCostMax: 0.3,
        bundleSecondCost: [0.01, 0.02, 0.03, 0.002, 0.003, 0.003, 0.01, 0.2],
        bundleSecondCostMax: 0.05,
        onlyBundle: false,
        maxGas: "17000000000"
    },
    frontrunsell: {
        address_excludes: ["0x0", "0x1"],
        sellPct: 0.01,
        bundleFirstCost: 0.04,
        bundleFirstCostMax: 0.02
    },
    arb: {},
    backwardSandwich: {},
    cexMonitorBuySell: {},
    forwardSandwich: {},
    regularsell: {
        sellPct: [0.01, 0.03],
        sellMultiplier: 1,
        bundleFirstCost: 0.001,
        bundleSecondCost: 0.001,
        maxGas: 3000000000
    },
    killbot_1: {},
    killbot_2: {},
    kChartBuySell: {}
};

// 定义 高频function_keys 的初始值结构
export const INITIAL_FUNCTION_KEYS = {
    backrunbuy: false,
    frontrunbuy: false,
    backrunsell: false,
    frontrunsell: false,
    regularsell: false,
    approvesell: false,
    killbot_1: false,
    killbot_2: false,
    kChartBuySell: false,
    forwardSandwich: false,
    backwardSandwich: false,
    arb: false,
    cexMonitorBuySell: false
};

export const INITIAL_PAIR_VALUE = {
    "stableToken": [
        "0x00",
        0
    ],
    "targetToken": [
        "0x00",
        1
    ],
    "fee": "9975",
    "relatedPairs": {
        "0x0000": {
            "router": [
                "v3",
                0
            ],
            "otherToken": "0x00"
        }
    }
}



// 定义MARKET MAKING 每个选项的初始值
export const MARKET_MAKING_INITIAL_VALUES = {
    TGE: {
        stableToken: "0x00",
        amountInArray: ["100000000000000000", "1000000000000", "20000000000000"],
        mainAmountIn: "1000000000000000000",
        bribeAmount: "1000000000000",
        initialLiq: {
            requireAdd: true,
            stableToken: "0x0001",
            liqAmount: ["10000000000", "100000000000000"]
        }
    },
    deployTokenPrepare: {
        approveStatus: [2, 3, 0],
        transferTokenAmount: [85656826545286, 65656826545286, 0],
        timeGap: [35, 22, 14]
    },
    marketMaking: {
        walletUse: 40,
        aggresive: 0.5,
        frequencyInMin: 10,
        reserveBound: ["10000000000", "100000000000000"]
    },
    tokenCleaning: {
        cleanAll: true,
        cleanProfit: false,
        cleanSpecifiedAddress: ["0x000", "0x1111"]
    },
    tokenFrontrunCleaning: {
        amountOutBound: "1000000000000000000",
        onlyCleanProfitAddress: true
    }
};

export const MARKET_MAKING_INITIAL_FUNCTION_KEYS_VALUE = {
    TGE: false,
    deployTokenPrepare: false,
    tokenCleaning: false,
    tokenFrontrunCleaning: false,
    marketMaking: false
};


