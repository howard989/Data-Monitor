// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Web3 = require("web3");
const Web3WsProvider = require("web3-providers-ws");
const {
    allClient1,
    connectallClient1,
} = require('../src/data/redisClient');


const app = express();
const port = 3001; //本地
// const port = 8189;



const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../src/middleware/authMiddleware');

const arbDetailsHandler = require('./routes/arbDetailsHandler');
const sandwichStatsHandler = require('./routes/sandwichStatsHandler');





const SECRET_KEY = process.env.SECRET_KEY;

app.use(cors());
app.use(express.json());








(async () => {
    await connectallClient1();;
})();











app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: '用户名和密码是必填项' });
    }

    try {
        const userKey = `user:${username}`;
        const userExists = await allClient1.exists(userKey);
        if (!userExists) {
            return res.status(400).json({ message: '用户名或密码错误' });
        }

        const storedHashedPassword = await allClient1.hGet(userKey, 'password');
        if (!storedHashedPassword) {
            return res.status(400).json({ message: '用户名或密码错误' });
        }

        const isMatch = await bcrypt.compare(password, storedHashedPassword);
        if (!isMatch) {
            return res.status(400).json({ message: '用户名或密码错误' });
        }

        const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '10h' });
        res.json({ token });
    } catch (err) {
        console.error('登录错误:', err);
        res.status(500).json({ message: '服务器错误' });
    }
});

app.get('/protected', authMiddleware, (req, res) => {
    res.json({ message: `欢迎, ${req.user.username}!` });
});

// 二次验证路由
app.post('/secondary-login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // 验证用户名和密码
        const userKey = `user:${username}`;
        const user = await allClient1.hGetAll(userKey);

        if (!user || Object.keys(user).length === 0) {
            return res.json({ isSuccess: false, message: '用户不存在' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            return res.json({ isSuccess: false, message: '密码错误' });
        }


        const token = jwt.sign(
            { username: user.username, role: user.role },
            SECRET_KEY,
            { expiresIn: '10h' }
        );

        res.json({
            isSuccess: true,
            token,
            user: {
                username: user.username,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ isSuccess: false, message: '服务器错误' });
    }
});





app.use('/api/arb', arbDetailsHandler);
app.use('/api/sandwich', sandwichStatsHandler);


app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${port}`);
});


// app.listen(port, 'localhost', () => {
//     console.log(`Server running at http://localhost:${port}`);
// });