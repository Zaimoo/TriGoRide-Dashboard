// src/App.jsx

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation,
} from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ActiveRides from "./pages/ActiveRides";
import SpecialRides from "./pages/SpecialRides";
import Verification from "./pages/Verification";
import Drivers from "./pages/Drivers";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import RideDetails from "./pages/RideDetails";
import Passengers from "./pages/Passengers";

// --- Auth Context ----------------------------------------------------------
export const AuthContext = createContext({
  isLoggedIn: false,
  login: () => {},
  logout: () => {},
});

const AuthProvider = ({ children }) => {
  // Initialize state directly from localStorage to prevent flash of login screen
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem("isLoggedIn") === "true";
  });

  // Sync with localStorage changes (optional - for multi-tab support)
  useEffect(() => {
    const handleStorageChange = () => {
      const stored = localStorage.getItem("isLoggedIn") === "true";
      setIsLoggedIn(stored);
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const login = () => {
    localStorage.setItem("isLoggedIn", "true");
    setIsLoggedIn(true);
  };

  const logout = () => {
    localStorage.removeItem("isLoggedIn");
    setIsLoggedIn(false);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// --- Route Guard -----------------------------------------------------------
const RequireAuth = ({ children }) => {
  const { isLoggedIn } = useContext(AuthContext);
  const location = useLocation();
  if (!isLoggedIn) {
    // redirect to /login, preserve attempted path in state if desired
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
};

// --- App Component ---------------------------------------------------------
const App = () => {
  const location = useLocation();
  const { isLoggedIn, logout } = useContext(AuthContext);
  const hideSidebar = location.pathname === "/login" || !isLoggedIn;

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      {!hideSidebar && (
        <div
          className="w-64 bg-orange-500 text-black flex flex-col"
          style={{ backgroundColor: "#FF9800" }}
        >
          <div
            className="p-6 text-2xl font-bold border-b border-orange-600"
            style={{ borderBottomColor: "#E65100" }}
          >
            TriGoRide Admin
          </div>
          <nav className="flex-1 p-4">
            <ul className="space-y-4">
              {[
                ["Dashboard", "/dashboard"],
                ["Rides", "/active-rides"],
                ["Special Rides", "/special-rides"],
                ["Verification", "/verification"],
                ["Drivers", "/drivers"],
                ["Passengers", "/passengers"],
                ["Reports", "/reports"],
              ].map(([label, to]) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    className={({ isActive }) =>
                      isActive
                        ? "block bg-orange-600 rounded px-4 py-2"
                        : "block hover:text-orange-200 px-4 py-2"
                    }
                    style={({ isActive }) =>
                      isActive ? { backgroundColor: "#E65100" } : {}
                    }
                  >
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <button
            onClick={logout}
            className="m-4 px-4 py-2 bg-orange-600 rounded hover:bg-orange-700 transition"
            style={{ backgroundColor: "#E65100" }}
            onMouseEnter={(e) => (e.target.style.backgroundColor = "#BF360C")}
            onMouseLeave={(e) => (e.target.style.backgroundColor = "#E65100")}
          >
            Logout
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-auto">
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Protected */}
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/passengers"
            element={
              <RequireAuth>
                <Passengers />
              </RequireAuth>
            }
          />
          <Route
            path="/active-rides"
            element={
              <RequireAuth>
                <ActiveRides />
              </RequireAuth>
            }
          />
          <Route
            path="/special-rides"
            element={
              <RequireAuth>
                <SpecialRides />
              </RequireAuth>
            }
          />
          <Route
            path="/verification"
            element={
              <RequireAuth>
                <Verification />
              </RequireAuth>
            }
          />
          <Route
            path="/drivers"
            element={
              <RequireAuth>
                <Drivers />
              </RequireAuth>
            }
          />
          <Route
            path="/reports"
            element={
              <RequireAuth>
                <Reports />
              </RequireAuth>
            }
          />
          <Route
            path="/bookings/:id"
            element={
              <RequireAuth>
                <RideDetails />
              </RequireAuth>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </div>
  );
};

// wrap with AuthProvider
export default () => (
  <AuthProvider>
    <App />
  </AuthProvider>
);
