// src/App.js

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import Login from './components/Login';
import Navbar from './components/Navbar';
import PrivateRoute from './components/PrivateRoute';
import ArbDetails from './components/ArbDetails';
import SandwichStats from './components/SandwichStats';
import DataCenter from './components/DataCenter';
import BlockProduction from './components/BlockProduction';
import { TimezoneProvider } from './context/TimezoneContext';

const antdTheme = {
  token: {
    colorPrimary: '#FFC801',
    // colorSuccess: '#52c41a',
    // colorWarning: '#faad14',
    // colorError: '#ff4d4f',
    // colorInfo: '#1890ff',
  },
  components: {
    Button: {
      colorPrimaryHover: '#E6B600',
      colorPrimaryActive: '#D4A800',
    },
    Segmented: {
      itemSelectedBg: '#FFC801',
    },
  },
  // componentSize: 'middle',
};

function App() {
    return (
        <ConfigProvider theme={antdTheme}>
            <TimezoneProvider>
                <Router>
                    <Navbar />
                    <div className="main-content">
                            <Routes>
                                <Route
                                    path="/"
                                    element={
                                        <PrivateRoute>
                                            <DataCenter />
                                        </PrivateRoute>
                                    }
                                />
                                
                                <Route
                                    path="/sandwich-stats"
                                    element={
                                        <PrivateRoute>
                                            <SandwichStats />
                                        </PrivateRoute>
                                    }
                                />

                                <Route
                                    path="/block-production"
                                    element={
                                        <PrivateRoute>
                                            <BlockProduction />
                                        </PrivateRoute>
                                    }
                                />

                                <Route
                                    path="/data-center"
                                    element={
                                        <PrivateRoute>
                                            <DataCenter />
                                        </PrivateRoute>
                                    }
                                />
                                
                    

                                <Route path="/login" element={<Login />} />

                                <Route path="*" element={<Navigate to="/login" />} />
                            </Routes>
                        </div>
                    </Router>
            </TimezoneProvider>
        </ConfigProvider>
    );
}

export default App;
