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
    <div className="flex items-center justify-center h-full bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm"
      >
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Admin Login</h2>
        {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}
        <label className="block mb-4">
          <span className="text-gray-700">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full px-4 py-2 border rounded-md focus:ring focus:ring-indigo-200"
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
            className="mt-1 block w-full px-4 py-2 border rounded-md focus:ring focus:ring-indigo-200"
            placeholder="secret"
          />
        </label>

        <button
          type="submit"
          className="w-full py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
        >
          Log In
        </button>
      </form>
    </div>
  );
};

export default Login;
