// src/components/Login.jsx
import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { FaSpinner, FaUser, FaLock } from 'react-icons/fa';
import { Input, Button } from 'antd';
import { loginUser } from '../data/apiArbDetails';

function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login, authToken } = useContext(AuthContext);

    useEffect(() => {
        if (authToken) {
            navigate('/');
        }
    }, [authToken, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const response = await loginUser(username, password);
            login(response.token);
            navigate('/');
        } catch (err) {
            setError(err.message || '登录失败');
        } finally {
            setLoading(false);
        }
    };

  return (
    <div className="min-h-[calc(100vh-66px)] flex items-center justify-center px-4 bg-gradient-to-br from-[#F7F9FC] via-white to-[#EEF2FF]">
      <div className="w-full max-w-[400px] bg-white border border-gray-200 rounded-sm shadow-sm p-6 md:p-8">
        <h1 className="text-center text-2xl font-semibold text-gray-900 mb-6">
          Welcome to Data Monitor
        </h1>

        {error && (
          <div className="mb-5 rounded-sm border border-red-200 bg-red-50 text-red-600 text-sm px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block mb-2 text-sm text-gray-600">Username</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              prefix={<FaUser className="text-gray-400" />}
              allowClear
              disabled={loading}
              autoComplete="username"
              className="rounded-sm"
              style={{ borderRadius: 2, height: 44 }}
            />
          </div>

          <div>
            <label className="block mb-2 text-sm text-gray-600">Password</label>
            <Input.Password
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              prefix={<FaLock className="text-gray-400" />}
              disabled={loading}
              autoComplete="current-password"
              className="rounded-sm"
              style={{ borderRadius: 2, height: 44 }}
            />
          </div>

          <Button
            type="primary"
            htmlType="submit"
            block
            disabled={loading}
            className="rounded-sm"
            style={{ borderRadius: 2, height: 44 }}
            size="middle"
          >
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <FaSpinner className="animate-spin" />
                Signing in...
              </span>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default Login;
