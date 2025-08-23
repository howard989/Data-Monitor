require('dotenv').config();
const bcrypt = require('bcryptjs');
const {
  userClient,
  connectUserClient
} = require('./src/data/redisClient'); 

async function reset(username, newPlain) {
  const userKey = `user:${username}`;

  const exists = await userClient.exists(userKey);
  if (!exists) throw new Error(`用户 ${username} 不存在`);

  const hash = await bcrypt.hash(newPlain, 10);   
  await userClient.hSet(userKey, 'password', hash);
  console.log(`✅  ${username} 密码已更新`);
}

(async () => {
  try {
    await connectUserClient();


    await reset('admin',      '');
    await reset('mainSwitch', '');


  } catch (e) {
    console.error(e);
  } finally {
    await userClient.quit();
  }
})();
