import { Navigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import api from "../api";
import React, { useState, useEffect, useContext } from "react";
import toast from "react-hot-toast";
import { PacmanLoader } from "react-spinners";
import { AuthContext } from "../AuthContext";

const ProtectedRoute = ({ children, requireAuth = true }) => {
  const {auth} = useContext(AuthContext)
  const [isAuthorized, setIsAuthorized] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("access_token");

      if (!token) {
        setIsAuthorized(false);
        return;
      }

      try {
        const decoded = jwtDecode(token);
        const tokenExpiration = decoded.exp;
        const now = Date.now() / 1000;

        if (tokenExpiration < now) {
          await refreshToken();
        } else {
          setIsAuthorized(true);
        }
      } catch (error) {
        console.error("Token validation failed:", error);
        await refreshToken();
      }
    };
    checkAuth();
  }, [auth]);

  const refreshToken = async () => {
    const refreshToken = localStorage.getItem("refresh_token");

    if (!refreshToken) {
      localStorage.clear();
      setIsAuthorized(false);
      return;
    }

    try {
      const response = await api.post("token/refresh/", {
        refresh: refreshToken,
      });

      if (response.status === 200) {
        localStorage.setItem("access_token", response.data.access);
        setIsAuthorized(true);
      } else {
        handleAuthFailure();
      }
    } catch (error) {
      console.error("Refresh token error:", error.response?.data || error);
      handleAuthFailure();
    }
  };

  const handleAuthFailure = () => {
    localStorage.clear();

    toast.error("Session Expired. Please log in again.", {
      duration: 3000,
      position: "top-right",
    });

    setIsAuthorized(false);
  };

  if (isAuthorized === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-100">
        <PacmanLoader size={20} />
      </div>
    );
  }

  if (requireAuth) {
    if (!isAuthorized) {
      return <Navigate to="/" replace state={{ from: location }} />;
    }
    return children;
  } else {
    if (isAuthorized) {
      return <Navigate to="/home" replace />;
    }
    return children;
  }
};

export default ProtectedRoute;
