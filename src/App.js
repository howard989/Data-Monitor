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
import RefundStatus from './components/RefundStatus';
import SandwichDetectLogic from './components/SandwichDetectLogic';
import { TimezoneProvider } from './context/TimezoneContext';

const antdTheme = {
  token: {
    colorPrimary: '#FFC801',
    colorTextLightSolid: '#1E1E1E',
    // colorSuccess: '#52c41a',
    // colorWarning: '#faad14',
    // colorError: '#ff4d4f',
    // colorInfo: '#1890ff',
  },
  components: {
    Button: {
      colorPrimary: '#FFC801',
      colorPrimaryHover: '#FFD84D',
      colorPrimaryActive: '#E6B800',
      colorPrimaryBorder: '#FFC801',
    },
    Segmented: {
      itemSelectedBg: '#FFC801',
    },
    Tooltip: {
      colorTextLightSolid: '#ffffff',
    },
  },
  componentSize: 'middle',
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
                                    path="/sandwich-detect-logic"
                                    element={
                                        <PrivateRoute>
                                            <SandwichDetectLogic />
                                        </PrivateRoute>
                                    }
                                />

                                <Route
                                    path="/block-stats"
                                    element={
                                        <PrivateRoute>
                                            <BlockProduction />
                                        </PrivateRoute>
                                    }
                                />

                                <Route
                                    path="/refund-status"
                                    element={
                                        <PrivateRoute>
                                            <RefundStatus />
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
