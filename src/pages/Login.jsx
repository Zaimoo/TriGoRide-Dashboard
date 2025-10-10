// src/pages/Login.jsx

import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App"; // we’ll export it from App.jsx

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    // placeholder credentials
    if (email === "admin@example.com" && password === "secret") {
      login();
      navigate("/dashboard", { replace: true });
    } else {
      setError("Invalid email or password");
    }
  };

  return (
    <div className="flex items-center justify-center h-full bg-white">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-lg shadow-lg w-full max-w-sm"
      >
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2" style={{ color: "#FF9800" }}>
            TriGoRide
          </h1>
          <h2 className="text-xl font-semibold text-gray-800">Admin Login</h2>
        </div>
        {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}
        <label className="block mb-4">
          <span className="text-gray-700">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent"
            style={{
              borderColor: "#E5E7EB",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#FF9800";
              e.target.style.boxShadow = "0 0 0 3px rgba(255, 152, 0, 0.1)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#E5E7EB";
              e.target.style.boxShadow = "none";
            }}
            placeholder="admin@example.com"
          />
        </label>

        <label className="block mb-6">
          <span className="text-gray-700">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent"
            style={{
              borderColor: "#E5E7EB",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#FF9800";
              e.target.style.boxShadow = "0 0 0 3px rgba(255, 152, 0, 0.1)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#E5E7EB";
              e.target.style.boxShadow = "none";
            }}
            placeholder="secret"
          />
        </label>

        <button
          type="submit"
          className="w-full py-2 text-white rounded-md transition font-medium"
          style={{ backgroundColor: "#FF9800" }}
          onMouseEnter={(e) => (e.target.style.backgroundColor = "#F57C00")}
          onMouseLeave={(e) => (e.target.style.backgroundColor = "#FF9800")}
        >
          Log In
        </button>
      </form>
    </div>
  );
};

export default Login;
