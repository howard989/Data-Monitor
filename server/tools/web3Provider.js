// var Web3 = require("web3");

const Web3 = require('web3');

const Web3WsProvider = require("web3-providers-ws");
const BNB48URL = "https://rpc-bsc.48.club"
const ANKRURL = "https://rpc.ankr.com/bsc"

const options = {
  timeout: 5000, // ms
  maxReceivedFrameSize: 100000000,
  maxReceivedMessageSize: 100000000,
  clientConfig: {
    // Useful to keep a connection alive
    keepalive: true,
    keepaliveInterval: 60000, // ms
  },
  reconnect: {
    auto: true,
    delay: 0, // ms
    maxAttempts: 5,
    onTimeout: true,
  },
};

// const ipLocal = "162.19.31.210";
const ip = "162.55.88.251";
const ip2 = "15.204.163.45";
const ip3 = "23.88.64.207";
const localhost = "localhost"


// const wsProvider = new Web3(new Web3.providers.WebsocketProvider(`ws://141.95.66.142:8446`, options));
const wsProvider = new Web3(new Web3.providers.WebsocketProvider(`ws://208.91.110.172:8446`, options));


const wsProviderBnb48 = new Web3(new Web3.providers.HttpProvider(BNB48URL));
const httpProvider = new Web3(new Web3.providers.HttpProvider(`http://${localhost}:8445`));


module.exports = {
  wsProvider,
  httpProvider,
  wsProviderBnb48,
};


