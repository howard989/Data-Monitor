// src/components/Login.jsx
import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { FaSpinner, FaUser, FaLock } from 'react-icons/fa';
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
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#ffffff',
            padding: '20px'
        }}>
            <div style={{
                background: '#ffffff',
                borderRadius: '20px',
                padding: '40px',
                width: '100%',
                maxWidth: '400px',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
                animation: 'fadeIn 0.5s ease-out'
            }}>
                <style>
                    {`
                        @keyframes fadeIn {
                            from { opacity: 0; transform: translateY(-20px); }
                            to { opacity: 1; transform: translateY(0); }
                        }
                        @keyframes shake {
                            0%, 100% { transform: translateX(0); }
                            25% { transform: translateX(-10px); }
                            75% { transform: translateX(10px); }
                        }
                        .input-group {
                            position: relative;
                            margin-bottom: 25px;
                        }
                        .input-group input {
                            width: 100%;
                            padding: 12px 40px 12px 40px;
                            border: 2px solid #e1e1e1;
                            border-radius: 10px;
                            font-size: 16px;
                            transition: all 0.3s ease;
                        }
                        .input-group input:focus {
                            border-color: #1890ff;
                            box-shadow: 0 0 0 3px rgba(24, 144, 255, 0.1);
                        }
                        .input-group svg {
                            position: absolute;
                            left: 12px;
                            top: 50%;
                            transform: translateY(-50%);
                            color: #1890ff;
                        }
                        .submit-button {
                            width: 100%;
                            padding: 12px;
                            background: #1890ff;
                            border: none;
                            border-radius: 10px;
                            color: white;
                            font-size: 16px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.3s ease;
                        }
                        .submit-button:hover {
                            transform: translateY(-2px);
                            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
                        }
                        .submit-button:active {
                            transform: translateY(0);
                        }
                        .error-message {
                            background: #fee2e2;
                            border-left: 4px solid #ef4444;
                            color: #dc2626;
                            padding: 12px;
                            margin-bottom: 20px;
                            border-radius: 8px;
                            animation: shake 0.5s ease-in-out;
                        }
                    `}
                </style>

                <h1 style={{
                    textAlign: 'center',
                    fontSize: '28px',
                    color: '#1f2937',
                    marginBottom: '30px',
                    fontWeight: '700'
                }}>
                    欢迎登录
                </h1>

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <FaUser size={18} />
                        <input
                            type="text"
                            placeholder="用户名"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <FaLock size={18} />
                        <input
                            type="password"
                            placeholder="密码"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="submit-button"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <FaSpinner className="animate-spin" style={{ display: 'inline-block', marginRight: '8px' }} />
                                登录中...
                            </>
                        ) : '登录'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default Login;
