// src/App.js

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import Login from './components/Login';
import Navbar from './components/Navbar';
import PrivateRoute from './components/PrivateRoute';
import ArbDetails from './components/ArbDetails';
import SandwichStats from './components/SandwichStats';
import Service from './components/Service';
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
                                            <Service />
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
                                    path="/service"
                                    element={
                                        <PrivateRoute>
                                            <Service />
                                        </PrivateRoute>
                                    }
                                />
                                
                                {/* <Route
                                    path="/arb-details"
                                    element={
                                        <PrivateRoute>
                                            <ArbDetails />
                                        </PrivateRoute>
                                    }
                                /> */}

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
