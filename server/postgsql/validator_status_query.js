const { pool, SCHEMA } = require('./db');
const { ethers } = require('ethers');

function ident(x) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(x)) throw new Error(`Invalid identifier: ${x}`);
    return `"${x}"`;
}

const schema = String(SCHEMA || 'public').toLowerCase();
const T_VALIDATOR_STATUS = `${ident(schema)}.${ident('validator_status')}`;

const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org');

const BATCH_CONTRACT_ADDRESS = '0x29ababe720242ebad16d7aaa8fa1946c9adccb34';
const BATCH_ABI = [{"inputs":[{"internalType":"address[]","name":"accounts","type":"address[]"}],"name":"nativeBalances","outputs":[{"internalType":"uint256[]","name":"out","type":"uint256[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"address[]","name":"accounts","type":"address[]"}],"name":"tokenBalances","outputs":[{"internalType":"uint256[]","name":"out","type":"uint256[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address[]","name":"tokens","type":"address[]"},{"internalType":"address[]","name":"accounts","type":"address[]"}],"name":"tokensBalances","outputs":[{"internalType":"uint256[][]","name":"out","type":"uint256[][]"}],"stateMutability":"view","type":"function"}];

const batchContract = new ethers.Contract(BATCH_CONTRACT_ADDRESS, BATCH_ABI, provider);

const balanceCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

const VALIDATOR_ADDRESSES = [
    "0xc437593d9C296bf9A5002522A86dad8a4d4Af808",
    "0xf1E586c740C2d7622EA4114a7eE0033fbfbC8563",
    "0x30e0be360D1E7c6dD3f7c54e2F098b9cAB1A9227",
    "0x2804ADA1C219E50898e75B2Bd052030580f4fbAC",
    "0x4AFc633E7B6bEB8e552ccddbE06Cca3754991E9A",
    "0x17592497267112e1d764eD49bb0c78f8073e9D7b",
    "0x487f2663C8e134Eb98495249bBA5C602A89ceaA7",
    "0xeFbb75e446Ec2d8493B3d4d91aC3118953f69b55",
    "0x857AFCc43ba66cfaB52eD8d92C01bDa3072705d0",
    "0xbe7E6c64fbe05FCDAC6d11E8cc83cDf5e1a32399",
    "0x57D6bE3Ba78e611E71e8DE981309f85ee5cb67e4",
    "0x2d09c57cB8EAf970dEEaf30546ec4dc3781c63cf",
    "0xeC06CB25d9add4bDd67B61432163aFF9028Aa921",
    "0xB4c7b55664622Ed960b3418e626d868A2151C470",
    "0x6CbEECB3a0591EAab5d4a6380F0BbBafb06859f2",
    "0xf378f76a9C334F9c337bd3aA1704278d7FD3F0E1",
    "0x8e01CF1C95fe6699C06Aac0a9F3E33297778d682",
    "0xDB92739a910f9261b62FfcD536EEeAC5DF8461B4",
    "0x6006a1d3e973f2E4e575Fc006a56396ebEFc8dbD",
    "0x831d7345eFC4a0aD0056eC98D3A0fd35ae4790A8",
    "0xE48FF82fAA5AAB796bB7E1f2208CB43008462022",
    "0x3890f2104045548BA7D933740A440405d58Cc4b3",
    "0xf7c5625578Bd28777a69D7b0Bb3E3C2292bbD560",
    "0x8370245e6b7EE1B3051Fd6ceeB766A5443E46934",
    "0x9C065e07Da5F95e11c0bAEFdAAC648DfF6DF4bfC",
    "0x7597E59607A1e91E5B4Af6b63c3A0c5070445A52",
    "0x0dcD7180Fa216eE32873A4672254F6355827fac0",
    "0x53aaF2D46a0bAa1a36f2819C9C50427d89F81397",
    "0x830bfDAea0984A5e48B00A06eD09067F2056b512",
    "0x47cdb61e41b7806Ab23B5d4C1296aacC11cAD489",
    "0x19A96b6DE86fAD8C6603d3C35692CF32E4e55AC2",
    "0x7714c9a4EA6e0731Eaf6C47aE9f66AAD27C67b94",
    "0x98346Bc9118E863388Cc83107fb8151b12eeFcd8",
    "0xC096e7781c95a2fc6fEb1efE776B570270B3965d",
    "0xdBC326A25BC5a77cd3C47EFc831aCaec5A1226ba",
    "0xD7a2D4BA21aBaC4E4D8569f572975DdD139067Fc",
    "0x19480607194Ff38BFF28d3314F5852aB4d5E7A91",
    "0xd38aE55B29Ec84d9633d166bae977Fa4618Bf621",
    "0x6eC070c6aF6e2b3cFd1c625bC2888bBC7d9eabE6",
    "0x80403B12587cc9bcF72ED43dE178dFAe63A32564",
    "0xcd3f68a23323D64C57Cd9D9D23a8193077dFEC66",
    "0x78E204A7c1eEFAC5584F2f2a56017c4087c1c858",
    "0xd77C88B0F7adB2A014Cf34C62c12046DF1a4229E",
    "0x0FaB00071bE18cAAD4C9984ec68E860e84c68Dad",
    "0xA3f20731A621E4aDceBF5e67aD7a6bDD256c21D8",
    "0xE7d23547F5E98d59480a29Dee112B4299FAD983b"
];

const VALIDATOR_NAMES = {
    "0xc437593d9C296bf9A5002522A86dad8a4d4Af808": "twstaking",
    "0xf1E586c740C2d7622EA4114a7eE0033fbfbC8563": "fuji",
    "0x30e0be360D1E7c6dD3f7c54e2F098b9cAB1A9227": "figment",
    "0x2804ADA1C219E50898e75B2Bd052030580f4fbAC": "legend III",
    "0x4AFc633E7B6bEB8e552ccddbE06Cca3754991E9A": "legend",
    "0x17592497267112e1d764eD49bb0c78f8073e9D7b": "nodereal",
    "0x487f2663C8e134Eb98495249bBA5C602A89ceaA7": "namelix",
    "0xeFbb75e446Ec2d8493B3d4d91aC3118953f69b55": "defibit",
    "0x857AFCc43ba66cfaB52eD8d92C01bDa3072705d0": "mathwallet",
    "0xbe7E6c64fbe05FCDAC6d11E8cc83cDf5e1a32399": "tranchess",
    "0x57D6bE3Ba78e611E71e8DE981309f85ee5cb67e4": "certik",
    "0x2d09c57cB8EAf970dEEaf30546ec4dc3781c63cf": "hashkey",
    "0xeC06CB25d9add4bDd67B61432163aFF9028Aa921": "legend II",
    "0xB4c7b55664622Ed960b3418e626d868A2151C470": "avengers",
    "0x6CbEECB3a0591EAab5d4a6380F0BbBafb06859f2": "InfStones",
    "0xf378f76a9C334F9c337bd3aA1704278d7FD3F0E1": "bscscan",
    "0x8e01CF1C95fe6699C06Aac0a9F3E33297778d682": "Turing",
    "0xDB92739a910f9261b62FfcD536EEeAC5DF8461B4": "BNBeve",
    "0x6006a1d3e973f2E4e575Fc006a56396ebEFc8dbD": "shannon",
    "0x831d7345eFC4a0aD0056eC98D3A0fd35ae4790A8": "feynman",
    "0xE48FF82fAA5AAB796bB7E1f2208CB43008462022": "48club",
    "0x3890f2104045548BA7D933740A440405d58Cc4b3": "Aoraki",
    "0xf7c5625578Bd28777a69D7b0Bb3E3C2292bbD560": "coda",
    "0x8370245e6b7EE1B3051Fd6ceeB766A5443E46934": "pexmons",
    "0x9C065e07Da5F95e11c0bAEFdAAC648DfF6DF4bfC": "zen",
    "0x7597E59607A1e91E5B4Af6b63c3A0c5070445A52": "ankr",
    "0x0dcD7180Fa216eE32873A4672254F6355827fac0": "legend IV",
    "0x53aaF2D46a0bAa1a36f2819C9C50427d89F81397": "ciscox",
    "0x830bfDAea0984A5e48B00A06eD09067F2056b512": "NovaX",
    "0x47cdb61e41b7806Ab23B5d4C1296aacC11cAD489": "Legend V",
    "0x19A96b6DE86fAD8C6603d3C35692CF32E4e55AC2": "Legend VII",
    "0x7714c9a4EA6e0731Eaf6C47aE9f66AAD27C67b94": "Lista Dao 2",
    "0x98346Bc9118E863388Cc83107fb8151b12eeFcd8": "ListaDao3",
    "0xC096e7781c95a2fc6fEb1efE776B570270B3965d": "ListaDao",
    "0xdBC326A25BC5a77cd3C47EFc831aCaec5A1226ba": "globalstk",
    "0xD7a2D4BA21aBaC4E4D8569f572975DdD139067Fc": "Axion",
    "0x19480607194Ff38BFF28d3314F5852aB4d5E7A91": "Sigm8",
    "0xd38aE55B29Ec84d9633d166bae977Fa4618Bf621": "Legend8",
    "0x6eC070c6aF6e2b3cFd1c625bC2888bBC7d9eabE6": "Seorasksan",
    "0x80403B12587cc9bcF72ED43dE178dFAe63A32564": "Nexa",
    "0xcd3f68a23323D64C57Cd9D9D23a8193077dFEC66": "Star",
    "0x78E204A7c1eEFAC5584F2f2a56017c4087c1c858": "BlkRazor",
    "0xd77C88B0F7adB2A014Cf34C62c12046DF1a4229E": "Kraken",
    "0x0FaB00071bE18cAAD4C9984ec68E860e84c68Dad": "Legend VI",
    "0xA3f20731A621E4aDceBF5e67aD7a6bDD256c21D8": "coinlix",
    "0xE7d23547F5E98d59480a29Dee112B4299FAD983b": "Veri"
};

const NAME_TO_STAKE_ADDR = Object.entries(VALIDATOR_NAMES).reduce((m,[addr,name]) => { m[String(name)] = ethers.getAddress(addr).toLowerCase(); return m; },{});

async function getValidatorBalances(forceRefresh = false) {
    const cacheKey = 'validator_balances';
    const cached = balanceCache.get(cacheKey);
    if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    try {
        const addresses = VALIDATOR_ADDRESSES.map(addr => ethers.getAddress(addr));
        const balances = await batchContract.nativeBalances(addresses, { gasLimit: 5000000 });
        const balanceMap = {};
        addresses.forEach((addr, index) => {
            const lowerAddr = addr.toLowerCase();
            balanceMap[lowerAddr] = balances[index] ? balances[index].toString() : '0';
        });
        const result = { data: balanceMap, timestamp: Date.now() };
        balanceCache.set(cacheKey, result);
        return balanceMap;
    } catch (error) {
        const fallbackBalances = {};
        VALIDATOR_ADDRESSES.forEach(addr => {
            fallbackBalances[addr.toLowerCase()] = '0';
        });
        return fallbackBalances;
    }
}

async function getValidatorStatusData({ timeRange = '1h' }) {
    const timeMap = { '10m': 10 * 60, '1h': 60 * 60, '24h': 24 * 60 * 60, '7d': 7 * 24 * 60 * 60 };
    const seconds = timeMap[timeRange] || 3600;
    const startTime = new Date(Date.now() - seconds * 1000);

    try {
        const rewardsQuery = `
            SELECT
                vs.validator_address,
                vs.validator_name,
                COUNT(*) as reward_count,
                SUM(vs.reward_wei::numeric) as total_rewards_wei,
                MIN(vs.block_time) as first_reward_time,
                MAX(vs.block_time) as last_reward_time,
                MAX(vs.block_number) as last_block
            FROM ${T_VALIDATOR_STATUS} vs
            WHERE vs.block_time >= $1
            GROUP BY vs.validator_address, vs.validator_name
        `;

        const [rewardsResult, balanceMap] = await Promise.all([
            pool.query(rewardsQuery, [startTime]),
            getValidatorBalances()
        ]);

        const validators = rewardsResult.rows.map(row => {
            const totalRewardsWei = row.total_rewards_wei || '0';
            const stakeAddr = NAME_TO_STAKE_ADDR[row.validator_name] || '';
            const balanceWei = stakeAddr ? (balanceMap[stakeAddr] || '0') : '0';

            const rewardsBnb = Number(totalRewardsWei) / 1e18;
            const balanceBnb = Number(balanceWei) / 1e18;

            const timeDiffHours = row.first_reward_time && row.last_reward_time
                ? (new Date(row.last_reward_time) - new Date(row.first_reward_time)) / (1000 * 60 * 60)
                : seconds / 3600;

            const hourlyRewards = timeDiffHours > 0 ? rewardsBnb / timeDiffHours : 0;
            const dailyRewards = hourlyRewards * 24;
            const yearlyRewards = dailyRewards * 365;
            const apy = balanceBnb > 0 ? (yearlyRewards / balanceBnb) * 100 : 0;

            return {
                validator_address: row.validator_address,
                validator_name: row.validator_name,
                stake_address: stakeAddr,
                total_staked_bnb: balanceBnb.toFixed(8),
                rewards_bnb: rewardsBnb.toFixed(8),
                apy: apy.toFixed(2),
                reward_count: Number(row.reward_count),
                last_block: Number(row.last_block || 0),
                daily_rewards_bnb: dailyRewards.toFixed(8),
                hourly_rewards_bnb: hourlyRewards.toFixed(8)
            };
        });

        const existingNames = new Set(validators.map(v => v.validator_name));

        Object.entries(NAME_TO_STAKE_ADDR).forEach(([name, stakeAddr]) => {
            if (!existingNames.has(name)) {
                const balanceWei = balanceMap[stakeAddr] || '0';
                const balanceBnb = Number(balanceWei) / 1e18;
                validators.push({
                    validator_address: '',
                    validator_name: name,
                    stake_address: stakeAddr,
                    total_staked_bnb: balanceBnb.toFixed(8),
                    rewards_bnb: '0.00000000',
                    apy: '0.00',
                    reward_count: 0,
                    last_block: 0,
                    daily_rewards_bnb: '0.00000000',
                    hourly_rewards_bnb: '0.00000000'
                });
            }
        });

        validators.sort((a, b) => parseFloat(b.total_staked_bnb) - parseFloat(a.total_staked_bnb));

        const totalStakedBnb = validators.reduce((sum, v) => sum + parseFloat(v.total_staked_bnb), 0);
        const totalRewardsBnb = validators.reduce((sum, v) => sum + parseFloat(v.rewards_bnb), 0);
        const apys = validators.map(v => parseFloat(v.apy)).filter(x => isFinite(x) && x > 0);
        const avgApy = apys.length > 0 ? apys.reduce((sum, apy) => sum + apy, 0) / apys.length : 0;

        return {
            success: true,
            timeRange,
            summary: {
                total_staked_bnb: totalStakedBnb.toFixed(8),
                total_rewards_bnb: totalRewardsBnb.toFixed(8),
                avg_apy: avgApy.toFixed(2),
                active_validators: validators.filter(v => v.reward_count > 0).length,
                total_validators: validators.length
            },
            validators,
            last_update: new Date().toISOString()
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            validators: [],
            summary: {
                total_staked_bnb: '0',
                total_rewards_bnb: '0',
                avg_apy: '0',
                active_validators: 0,
                total_validators: 0
            }
        };
    }
}

module.exports = {
    getValidatorStatusData
};
