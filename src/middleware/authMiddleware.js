// src/middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
require('dotenv').config();

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ message: '未提供 token' });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: '未提供 token' });
    }

    try {
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        req.user = decoded; // 将解码后的用户信息附加到请求对象
        next();
    } catch (err) {
        return res.status(401).json({ message: '无效的 token' });
    }
};

module.exports = authMiddleware;
