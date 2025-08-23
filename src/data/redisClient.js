// src/data/redisClient.js
const redis = require('redis');
require('dotenv').config();




const allClient1 = redis.createClient({
    url: `redis://:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}/1`
});




allClient1.on('error', (err) => {
    console.error('allClient1 Redis Client Error:', err);
});






async function connectallClient1() {
    try {
        if (!allClient1.isOpen) {
            console.log("Connecting to Redis allClient Client (DB1)...");
            await allClient1.connect();
            console.log("Connected to Redis allClient Client (DB1)");
        }
    } catch (error) {
        console.error('Error connecting to Redis allClient Client:', error);
    }
}




async function reconnectallClient1() {
    if (!allClient1.isOpen) {
        await connectallClient1();
    }
    setTimeout(reconnectallClient1, 3000);
}



connectallClient1();



reconnectallClient1();


module.exports = {
    allClient1,
    connectallClient1,
    reconnectallClient1,
};