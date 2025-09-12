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
const cookieParser = require('cookie-parser'); 

const app = express();
// const port = 3001; //本地
const port = 8189;



const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../src/middleware/authMiddleware');


const sandwichStatsHandler = require('./routes/sandwichStatsHandler');





app.set('trust proxy', 1);

const SECRET_KEY = process.env.SECRET_KEY;
const REFRESH_SECRET = process.env.REFRESH_SECRET || SECRET_KEY;


// const corsOrigins = ['http://localhost:3000'];
// app.use(cors({ origin: corsOrigins, credentials: true }));

app.use(express.json());
app.use(cookieParser());




(async () => {
    await connectallClient1();;
})();


const cookieOptions = { 
    httpOnly: true, 
    sameSite: 'lax', 
    secure: true,    
    maxAge: 30 * 24 * 3600 * 1000 
  };
  

  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    try {
        const userKey = `user:${username}`;
        const userExists = await allClient1.exists(userKey);
        if (!userExists) {
            return res.status(400).json({ message: 'User not found' });
        }

        const storedHashedPassword = await allClient1.hGet(userKey, 'password');
        if (!storedHashedPassword) {
            return res.status(400).json({ message: 'Password incorrect' });
        }

        const isMatch = await bcrypt.compare(password, storedHashedPassword);
        if (!isMatch) {
            return res.status(400).json({ message: 'Password incorrect' });
        }

        const access = jwt.sign({ username }, SECRET_KEY, { expiresIn: '12h' });
        const refresh = jwt.sign({ username }, REFRESH_SECRET, { expiresIn: '30d' });
        res.cookie('rt', refresh, cookieOptions);
        res.json({ token: access });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});


app.post('/api/auth/refresh', async (req, res) => {
    const token = req.cookies?.rt;
    if (!token) return res.status(401).json({ success: false });
    try {
      const payload = jwt.verify(token, REFRESH_SECRET);
      const access = jwt.sign({ username: payload.username }, SECRET_KEY, { expiresIn: '12h' });
      const refresh = jwt.sign({ username: payload.username }, REFRESH_SECRET, { expiresIn: '30d' });
      res.cookie('rt', refresh, cookieOptions);
      res.json({ success: true, token: access });
    } catch {
      res.status(401).json({ success: false });
    }
  });

  app.get('/api/protected', authMiddleware, (req, res) => {
    res.json({ message: `Welcome, ${req.user.username}!` });
});


app.post('/api/secondary-login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const userKey = `user:${username}`;
        const user = await allClient1.hGetAll(userKey);

        if (!user || Object.keys(user).length === 0) {
            return res.json({ isSuccess: false, message: 'User not found' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            return res.json({ isSuccess: false, message: 'Password incorrect' });
        }


        const access = jwt.sign(
            { username: user.username, role: user.role },
            SECRET_KEY,
            { expiresIn: '12h' }
        );
        const refresh = jwt.sign(
            { username: user.username, role: user.role },
            REFRESH_SECRET,
            { expiresIn: '30d' }
        );
        res.cookie('rt', refresh, cookieOptions);

        res.json({
            isSuccess: true,
            token: access,
            user: {
                username: user.username,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ isSuccess: false, message: 'Server error' });
    }
});






app.use('/api/sandwich', sandwichStatsHandler);


app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${port}`);
});


// app.listen(port, 'localhost', () => {
//     console.log(`Server running at http://localhost:${port}`);
// });