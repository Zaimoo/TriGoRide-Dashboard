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
import Verification from "./pages/Verification";
import Drivers from "./pages/Drivers";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import RideDetails from "./pages/RideDetails";
import Passengers from "./pages/Passengers";
import SpecialRides from "./pages/SpecialRides";

// --- Auth Context ----------------------------------------------------------
export const AuthContext = createContext({
	isLoggedIn: false,
	login: () => {},
	logout: () => {},
});

const AuthProvider = ({ children }) => {
	const [isLoggedIn, setIsLoggedIn] = useState(false);

	// Initialize from localStorage
	useEffect(() => {
		const stored = localStorage.getItem("isLoggedIn") === "true";
		setIsLoggedIn(stored);
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
		return <Navigate to='/login' state={{ from: location }} replace />;
	}
	return children;
};

// --- App Component ---------------------------------------------------------
const App = () => {
	const location = useLocation();
	const { isLoggedIn, logout } = useContext(AuthContext);
	const hideSidebar = location.pathname === "/login" || !isLoggedIn;

	return (
		<div className='flex h-screen bg-gray-100'>
			{/* Sidebar */}
			{!hideSidebar && (
				<div className='w-64 bg-gray-800 text-white flex flex-col'>
					<div className='p-6 text-2xl font-bold border-b border-gray-700'>
						TrigoRide Admin
					</div>
					<nav className='flex-1 p-4'>
						<ul className='space-y-4'>
							{[
								["Dashboard", "/dashboard"],
								["Active Rides", "/active-rides"],
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
												? "block bg-gray-700 rounded px-4 py-2"
												: "block hover:text-gray-300 px-4 py-2"
										}>
										{label}
									</NavLink>
								</li>
							))}
						</ul>
					</nav>
					<button
						onClick={logout}
						className='m-4 px-4 py-2 bg-red-600 rounded hover:bg-red-700 transition'>
						Logout
					</button>
				</div>
			)}

			{/* Main Content */}
			<div className='flex-1 p-6 overflow-auto'>
				<Routes>
					{/* Public */}
					<Route path='/login' element={<Login />} />
					<Route path='/' element={<Navigate to='/login' replace />} />

					{/* Protected */}
					<Route
						path='/dashboard'
						element={
							<RequireAuth>
								<Dashboard />
							</RequireAuth>
						}
					/>
					<Route
						path='/passengers'
						element={
							<RequireAuth>
								<Passengers />
							</RequireAuth>
						}
					/>
					<Route
						path='/active-rides'
						element={
							<RequireAuth>
								<ActiveRides />
							</RequireAuth>
						}
					/>
					<Route
						path='/verification'
						element={
							<RequireAuth>
								<Verification />
							</RequireAuth>
						}
					/>
					<Route
						path='/drivers'
						element={
							<RequireAuth>
								<Drivers />
							</RequireAuth>
						}
					/>
					<Route
						path='/reports'
						element={
							<RequireAuth>
								<Reports />
							</RequireAuth>
						}
					/>
					<Route
						path='/bookings/:id'
						element={
							<RequireAuth>
								<RideDetails />
							</RequireAuth>
						}
					/>
					<Route
						path='/special-rides'
						element={
							<RequireAuth>
								<SpecialRides />
							</RequireAuth>
						}
					/>

					{/* Catch-all */}
					<Route path='*' element={<Navigate to='/login' replace />} />
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
