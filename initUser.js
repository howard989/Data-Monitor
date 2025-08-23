// initUser.js
const { allClient1, connectallClient1 } = require('./src/data/redisClient');
const bcrypt = require('bcryptjs');

async function initUser() {
    await connectallClient1();
    const username = 'admin';
    const password = '';

    const userKey = `user:${username}`;
    const userExists = await allClient1.exists(userKey);
    if (userExists) {
        console.log(`用户 ${username} 已存在。`);
    } else {
        const hashedPassword = await bcrypt.hash(password, 10);
        await allClient1.hSet(userKey, {
            password: hashedPassword,
        });
        console.log(`用户 ${username} 已创建，密码为: ${password}`);
    }

    await allClient1.quit();
}

initUser().catch(err => {
    console.error('初始化用户时出错:', err);
});
