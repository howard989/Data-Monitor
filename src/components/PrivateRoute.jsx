// src/components/PrivateRoute.jsx

import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

function PrivateRoute({ children }) {
    const { authToken } = useContext(AuthContext);
    const location = useLocation();

    return authToken ? children : <Navigate to="/login" replace state={{ from: location }} />;
}

export default PrivateRoute;
