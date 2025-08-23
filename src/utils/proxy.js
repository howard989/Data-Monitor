const { HttpsProxyAgent } = require("https-proxy-agent");

const proxyPool = [];

function initProxyPool() {
    for (let i = 10001; i < 10200; i++) {
        proxyPool.push(new HttpsProxyAgent(`http://sp7p8qpxpf:wwlrjPyV~V6k4bTc59@dc.smartproxy.com:${i}`));
    }
}

function getProxyAgent() {
    return proxyPool[Math.floor(Math.random() * proxyPool.length)];
}

initProxyPool();

module.exports = { getProxyAgent };
