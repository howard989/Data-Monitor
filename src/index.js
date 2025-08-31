// src/index.js

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { PauseProvider } from './context/PauseContext';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
    <React.StrictMode>
        <PauseProvider>
            <AuthProvider>
                <App />
            </AuthProvider>
        </PauseProvider>
    </React.StrictMode>
);
