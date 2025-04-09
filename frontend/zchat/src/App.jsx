import React, { useState } from "react";
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
import UserAuth from "./pages/UserAuth";
import Home from "./pages/HomePage";
import ProtectedRoute from "./components/ProtectedRoute";
import { useNavigate } from "react-router-dom";
import { PacmanLoader } from "react-spinners";

function App() {


  const Logout = () => {
    const navigate = useNavigate();
  
    const handleLogout = () => {
      localStorage.clear()
      navigate("/");
    };
  
    React.useEffect(() => {
      handleLogout();
    }, []);

    return (
      <div className="flex items-center justify-center h-screen">
        <PacmanLoader />
      </div>
    );
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<ProtectedRoute requireAuth={false}><UserAuth /></ProtectedRoute>} />
        <Route path="/logout" element={<Logout />} />
        <Route
          path="home/"
          element={<ProtectedRoute><Home /></ProtectedRoute>}
        />
      </Routes>
    </Router>
  );
}

export default App;
