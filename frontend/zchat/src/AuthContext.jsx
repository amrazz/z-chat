// AuthContext.js
import React, { createContext, useState } from "react";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState({
    accessToken: localStorage.getItem("access_token"),
    refreshToken: localStorage.getItem("refresh_token"),
    user: JSON.parse(localStorage.getItem("user") || "null"),
  });

  const updateAuth = (newAuth) => {
    setAuth(newAuth);
  };

  return (
    <AuthContext.Provider value={{ auth, updateAuth }}>
      {children}
    </AuthContext.Provider>
  );
};
