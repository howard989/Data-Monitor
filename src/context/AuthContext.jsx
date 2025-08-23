// src/context/AuthContext.jsx

import React, { createContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';


export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [authToken, setAuthToken] = useState(() => localStorage.getItem('token'));
    const [secondaryAuthToken, setSecondaryAuthToken] = useState(() => localStorage.getItem('secondaryToken'));
    const [user, setUser] = useState(() => {
        const token = localStorage.getItem('token');
        return token ? jwtDecode(token) : null;
    });

    const [secondaryUser, setSecondaryUser] = useState(() => {
        const token = localStorage.getItem('secondaryToken');
        return token ? jwtDecode(token) : null;
    });

    useEffect(() => {
        if (authToken) {
            localStorage.setItem('token', authToken);
            setUser(jwtDecode(authToken));
        } else {
            localStorage.removeItem('token');
            setUser(null);
        }
    }, [authToken]);


     useEffect(() => {
        if (secondaryAuthToken) {
            localStorage.setItem('secondaryToken', secondaryAuthToken);
            setSecondaryUser(jwtDecode(secondaryAuthToken));
        } else {
            localStorage.removeItem('secondaryToken');
            setSecondaryUser(null);
        }
    }, [secondaryAuthToken]);


    const login = (token) => {
        setAuthToken(token);
    };

    const secondaryLogin = (token) => {
        setSecondaryAuthToken(token);
    };


    const logout = () => {
        setAuthToken(null);
    };

    return (
        <AuthContext.Provider value={{ user, authToken, login, logout, secondaryUser,
            secondaryAuthToken,
            secondaryLogin, }}>
            {children}
        </AuthContext.Provider>
    );
};
