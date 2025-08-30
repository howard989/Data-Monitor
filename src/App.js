// src/App.js

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Navbar from './components/Navbar';
import PrivateRoute from './components/PrivateRoute';
import ArbDetails from './components/ArbDetails';
import SandwichStats from './components/SandwichStats';
import { TimezoneProvider } from './context/TimezoneContext';

function App() {
    return (
        <TimezoneProvider>
            <Router>
                <Navbar />
                <div className="main-content">

                        <Routes>
                            <Route
                                path="/"
                                element={
                                    <PrivateRoute>
                                        <SandwichStats />
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
    );
}

export default App;
