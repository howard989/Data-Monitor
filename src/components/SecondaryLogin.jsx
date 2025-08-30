import React, { useState, useContext } from 'react';
// import { useNavigate } from 'react-router-dom';
import { secondaryLoginUser } from '../data/apiServiceMainSwitch';
import { AuthContext } from '../context/AuthContext';

function SecondaryLogin({ onLoginSuccess }) {
  const [username] = useState('mainSwitch');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { secondaryLogin } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
        setError('');

        try {
            const response = await secondaryLoginUser(username, password);
            if (response.isSuccess) {
                secondaryLogin(response.token);
            } else {
                setError(response.message || '登录失败');
            }
        } catch (error) {
            setError('登录失败：' + (error.message || '未知错误'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-white-100">
            <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        二次验证
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        请输入管理员账号密码
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div>
                            <label htmlFor="username" className="sr-only">
                                用户名
                            </label>
                          <input
                                id="username"
                                name="username"
                                type="text"
                                readOnly 
                                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm bg-gray-100 cursor-not-allowed"
                                placeholder="用户名"
                                value={username} 
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">
                                密码
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                placeholder="密码"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="text-red-500 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                                loading
                                    ? 'bg-indigo-400'
                                    : 'bg-indigo-600 hover:bg-indigo-700'
                            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                        >
                            {loading ? '登录中...' : '登录'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default SecondaryLogin;
