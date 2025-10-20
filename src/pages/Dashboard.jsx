// src/components/Dashboard.jsx

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  getDocs,
  query,
  where as whereFirestore,
  orderBy,
  limit as limitTo,
} from "firebase/firestore";
import { db } from "../firebase";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend,
} from "recharts";
import { formatDistanceToNow, startOfDay, subDays } from "date-fns";

const DAYS_TO_SHOW = 7;

// helper to fetch daily counts for a collection + timestamp field
const fetchDailyCounts = async (colName, dateField, days = DAYS_TO_SHOW) => {
  const today = startOfDay(new Date());
  const start = subDays(today, days - 1);

  const q = query(
    collection(db, colName),
    whereFirestore(dateField, ">=", start)
  );
  const snap = await getDocs(q);

  // initialize buckets
  const buckets = {};
  for (let i = 0; i < days; i++) {
    const day = subDays(today, i).toISOString().slice(0, 10);
    buckets[day] = 0;
  }

  snap.docs.forEach((d) => {
    const ts = d.data()[dateField]?.toDate?.() || new Date(d.data()[dateField]);
    const key = ts.toISOString().slice(0, 10);
    if (buckets[key] != null) buckets[key]++;
  });

  return Object.entries(buckets)
    .sort(([a], [b]) => new Date(a) - new Date(b))
    .map(([date, count]) => ({ date, count }));
};

// line chart component
const UserActivityChart = ({ data, title }) => (
  <div className="w-full h-48">
    <h3 className="font-semibold text-gray-700 mb-2">{title}</h3>
    <ResponsiveContainer width="100%" height="80%">
      <LineChart data={data}>
        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
        <YAxis allowDecimals={false} />
        <Tooltip
          labelFormatter={(label) => `Date: ${label}`}
          formatter={(value) => [`${value}`, "Count"]}
        />
        <Line type="monotone" dataKey="count" stroke="#4F46E5" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

const RecentUsers = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    (async () => {
      const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const allUsers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUsers(allUsers);
      setFilteredUsers(allUsers.slice(0, 5)); // Show first 5 by default
    })();
  }, []);

  // Filter users based on selected date
  useEffect(() => {
    if (!dateFilter) {
      setFilteredUsers(users.slice(0, 5)); // Show first 5 when no filter
    } else {
      const filtered = users.filter((user) => {
        if (!user.createdAt) return false;

        // Convert timestamp to date string for comparison
        let userDate;
        if (user.createdAt.toDate) {
          // Firestore timestamp
          userDate = user.createdAt.toDate().toISOString().split("T")[0];
        } else if (user.createdAt instanceof Date) {
          // JavaScript Date object
          userDate = user.createdAt.toISOString().split("T")[0];
        } else if (typeof user.createdAt === "string") {
          // String date
          userDate = new Date(user.createdAt).toISOString().split("T")[0];
        } else {
          return false;
        }

        return userDate === dateFilter;
      });
      setFilteredUsers(filtered.slice(0, 10)); // Show up to 10 when filtered
    }
  }, [users, dateFilter]);

  // Get unique dates for the dropdown
  const getAvailableDates = () => {
    const dates = users
      .map((user) => {
        if (!user.createdAt) return null;

        let dateStr;
        if (user.createdAt.toDate) {
          dateStr = user.createdAt.toDate().toISOString().split("T")[0];
        } else if (user.createdAt instanceof Date) {
          dateStr = user.createdAt.toISOString().split("T")[0];
        } else if (typeof user.createdAt === "string") {
          dateStr = new Date(user.createdAt).toISOString().split("T")[0];
        }
        return dateStr;
      })
      .filter(Boolean);

    return [...new Set(dates)].sort((a, b) => new Date(b) - new Date(a));
  };

  return (
    <div>
      {/* Date Filter Dropdown */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Filter by Registration Date:
        </label>
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
        >
          <option value="">Recent Users (All)</option>
          {getAvailableDates().map((date) => (
            <option key={date} value={date}>
              {new Date(date).toLocaleDateString()}
            </option>
          ))}
        </select>
      </div>

      {filteredUsers.length === 0 ? (
        <p className="text-gray-500 text-center py-4">
          No users found for the selected date.
        </p>
      ) : (
        <ul className="space-y-4">
          {filteredUsers.map((u) => (
            <li key={u.id} className="flex items-center">
              <img
                src={u.photoURL || "/default-avatar.png"}
                alt=""
                className="w-10 h-10 rounded-full mr-4 object-cover"
              />
              <div>
                <p className="font-semibold">{u.username || u.displayName}</p>
                <p className="text-gray-500 text-xs">
                  Joined{" "}
                  {u.createdAt
                    ? formatDistanceToNow(u.createdAt.toDate(), {
                        addSuffix: true,
                      })
                    : "—"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const Dashboard = () => {
  const [rides, setRides] = useState([]);
  const [loadingRides, setLoadingRides] = useState(true);
  const [allBookings, setAllBookings] = useState([]);

  const [activeRidesCount, setActiveRidesCount] = useState(0);
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const [activeDriversCount, setActiveDriversCount] = useState(0);
  const [totalBookingsCount, setTotalBookingsCount] = useState(0);

  const [signUpData, setSignUpData] = useState([]);
  const [bookingData, setBookingData] = useState([]);

  // Financial Analytics State
  const [financialAnalytics, setFinancialAnalytics] = useState({
    totalRevenue: 0,
    companyRevenue: 0, // Service fees
    driverRevenue: 0, // Base costs + special amounts
    specialRidesRevenue: 0,
    regularRidesRevenue: 0,
    averageFare: 0,
    averageServiceFee: 0,
    completedRides: 0,
    revenueBreakdown: [],
    dailyRevenue: [],
    rideTypeComparison: [],
  });

  // Calculate fare components using business logic
  const calculateFareComponents = (ride) => {
    const distanceKm = ride._distanceM ? ride._distanceM / 1000 : 0;
    const raw = distanceKm / 2;
    const baseRideCost = raw < 1 ? 15 : 15 + raw * 1.5;
    const serviceFee = baseRideCost * 0.1;
    const specialAmount = ride.specialAmount || 0;

    let totalFare = baseRideCost + serviceFee;
    if (ride.priorityType === "special") {
      totalFare += specialAmount;
    }

    return {
      baseRideCost: parseFloat(baseRideCost.toFixed(2)),
      serviceFee: parseFloat(serviceFee.toFixed(2)),
      specialAmount: parseFloat(specialAmount.toFixed(2)),
      totalFare: parseFloat(totalFare.toFixed(2)),
      companyEarnings: parseFloat(serviceFee.toFixed(2)),
      driverEarnings: parseFloat(
        (
          baseRideCost + (ride.priorityType === "special" ? specialAmount : 0)
        ).toFixed(2)
      ),
    };
  };

  // Calculate comprehensive financial analytics
  const calculateFinancialAnalytics = (bookings) => {
    const completedBookings = bookings.filter(
      (ride) => ride.status === "Completed"
    );

    const bookingsWithCalculations = completedBookings.map((ride) => ({
      ...ride,
      ...calculateFareComponents(ride),
    }));

    // Overall metrics
    const totalRevenue = bookingsWithCalculations.reduce(
      (sum, ride) => sum + ride.totalFare,
      0
    );
    const companyRevenue = bookingsWithCalculations.reduce(
      (sum, ride) => sum + ride.companyEarnings,
      0
    );
    const driverRevenue = bookingsWithCalculations.reduce(
      (sum, ride) => sum + ride.driverEarnings,
      0
    );

    // Special vs Regular rides
    const specialRides = bookingsWithCalculations.filter(
      (ride) =>
        ride.priorityType === "special" ||
        (ride.specialAmount && ride.specialAmount > 0)
    );
    const regularRides = bookingsWithCalculations.filter(
      (ride) =>
        ride.priorityType !== "special" &&
        (!ride.specialAmount || ride.specialAmount === 0)
    );

    const specialRidesRevenue = specialRides.reduce(
      (sum, ride) => sum + ride.totalFare,
      0
    );
    const regularRidesRevenue = regularRides.reduce(
      (sum, ride) => sum + ride.totalFare,
      0
    );

    const averageFare =
      completedBookings.length > 0
        ? totalRevenue / completedBookings.length
        : 0;
    const averageServiceFee =
      completedBookings.length > 0
        ? companyRevenue / completedBookings.length
        : 0;

    // Revenue breakdown
    const revenueBreakdown = [
      {
        name: "Company Revenue",
        value: companyRevenue,
        percentage:
          totalRevenue > 0
            ? ((companyRevenue / totalRevenue) * 100).toFixed(1)
            : 0,
        color: "#3b82f6",
      },
      {
        name: "Driver Revenue",
        value: driverRevenue,
        percentage:
          totalRevenue > 0
            ? ((driverRevenue / totalRevenue) * 100).toFixed(1)
            : 0,
        color: "#10b981",
      },
    ];

    // Ride type comparison
    const rideTypeComparison = [
      {
        name: "Special Rides",
        revenue: specialRidesRevenue,
        count: specialRides.length,
        avgFare:
          specialRides.length > 0
            ? specialRidesRevenue / specialRides.length
            : 0,
      },
      {
        name: "Regular Rides",
        revenue: regularRidesRevenue,
        count: regularRides.length,
        avgFare:
          regularRides.length > 0
            ? regularRidesRevenue / regularRides.length
            : 0,
      },
    ];

    // Daily revenue trends (last 7 days)
    const dailyRevenueData = {};
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateKey = date.toISOString().split("T")[0];
      dailyRevenueData[dateKey] = {
        date: dateKey,
        totalRevenue: 0,
        companyRevenue: 0,
        driverRevenue: 0,
        specialRevenue: 0,
        regularRevenue: 0,
        rides: 0,
      };
    }

    bookingsWithCalculations.forEach((ride) => {
      const rideDate = ride.dateBooked?.toDate
        ? ride.dateBooked.toDate()
        : new Date(ride.dateBooked);
      const dateKey = rideDate.toISOString().split("T")[0];

      if (dailyRevenueData[dateKey]) {
        dailyRevenueData[dateKey].totalRevenue += ride.totalFare;
        dailyRevenueData[dateKey].companyRevenue += ride.companyEarnings;
        dailyRevenueData[dateKey].driverRevenue += ride.driverEarnings;
        dailyRevenueData[dateKey].rides++;

        if (
          ride.priorityType === "special" ||
          (ride.specialAmount && ride.specialAmount > 0)
        ) {
          dailyRevenueData[dateKey].specialRevenue += ride.totalFare;
        } else {
          dailyRevenueData[dateKey].regularRevenue += ride.totalFare;
        }
      }
    });

    const dailyRevenue = Object.values(dailyRevenueData);

    return {
      totalRevenue,
      companyRevenue,
      driverRevenue,
      specialRidesRevenue,
      regularRidesRevenue,
      averageFare,
      averageServiceFee,
      completedRides: completedBookings.length,
      revenueBreakdown,
      dailyRevenue,
      rideTypeComparison,
    };
  };

  useEffect(() => {
    // stats + activity data
    (async () => {
      try {
        // Top‐level stats
        const [actRidesSnap, usersSnap, driversSnap, bookingsSnap] =
          await Promise.all([
            getDocs(
              query(
                collection(db, "bookings"),
                whereFirestore("active", "==", true)
              )
            ),
            getDocs(collection(db, "users")),
            getDocs(
              query(
                collection(db, "users"),
                whereFirestore("userType", "==", "Driver")
              )
            ),
            getDocs(collection(db, "bookings")),
          ]);

        setActiveRidesCount(actRidesSnap.size);
        setTotalUsersCount(usersSnap.size);
        setActiveDriversCount(driversSnap.size);
        setTotalBookingsCount(bookingsSnap.size);

        // User activity (last 7 days)
        const [signUps, bookings] = await Promise.all([
          fetchDailyCounts("users", "createdAt"),
          fetchDailyCounts("bookings", "dateBooked"),
        ]);
        setSignUpData(signUps);
        setBookingData(bookings);
      } catch (err) {
        console.error("Error fetching dashboard stats/activity:", err);
      }
    })();

    // fetch current rides and all bookings for financial analytics
    (async () => {
      try {
        const snap = await getDocs(collection(db, "bookings"));
        const withRiders = await Promise.all(
          snap.docs.map(async (d) => {
            const data = { id: d.id, ...d.data() };
            let assignedRiderName = "Unassigned";
            if (data.assignedRider) {
              const userSnap = await getDocs(
                query(
                  collection(db, "users"),
                  whereFirestore("uid", "==", data.assignedRider)
                )
              );
              if (!userSnap.empty)
                assignedRiderName = userSnap.docs[0].data().username;
            }
            return { ...data, assignedRiderName };
          })
        );

        // Store all bookings for financial analytics
        setAllBookings(withRiders);

        // Calculate financial analytics
        const analytics = calculateFinancialAnalytics(withRiders);
        setFinancialAnalytics(analytics);

        // Filter for current rides display
        const filtered = withRiders.filter((r) => {
          const st = r.status?.toLowerCase();
          return st === "pending" || st === "accepted";
        });

        const sorted = filtered.sort((a, b) => {
          const tA = a.dateBooked?.toDate
            ? a.dateBooked.toDate().getTime()
            : new Date(a.dateBooked).getTime();
          const tB = b.dateBooked?.toDate
            ? b.dateBooked.toDate().getTime()
            : new Date(b.dateBooked).getTime();
          return tB - tA;
        });

        setRides(sorted);
      } catch (err) {
        console.error("Error fetching current rides:", err);
      } finally {
        setLoadingRides(false);
      }
    })();
  }, []);

  const statusClasses = {
    pending: "bg-yellow-100 text-yellow-800",
    accepted: "bg-blue-100 text-blue-800",
    ongoing: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };

  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

  return (
    <div className="space-y-6">
      {/* Financial Analytics Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">
          Financial Analytics Dashboard
        </h2>

        {/* Key Financial Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
            <h3 className="text-sm font-medium opacity-90">Total Revenue</h3>
            <p className="text-3xl font-bold mt-2">
              ₱{financialAnalytics.totalRevenue.toFixed(2)}
            </p>
            <p className="text-sm opacity-75 mt-1">
              From {financialAnalytics.completedRides} completed rides
            </p>
          </div>

          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
            <h3 className="text-sm font-medium opacity-90">Company Revenue</h3>
            <p className="text-3xl font-bold mt-2">
              ₱{financialAnalytics.companyRevenue.toFixed(2)}
            </p>
            <p className="text-sm opacity-75 mt-1">Service fees (10%)</p>
          </div>

          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
            <h3 className="text-sm font-medium opacity-90">Driver Revenue</h3>
            <p className="text-3xl font-bold mt-2">
              ₱{financialAnalytics.driverRevenue.toFixed(2)}
            </p>
            <p className="text-sm opacity-75 mt-1">Base cost + specials</p>
          </div>

          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
            <h3 className="text-sm font-medium opacity-90">Average Fare</h3>
            <p className="text-3xl font-bold mt-2">
              ₱{financialAnalytics.averageFare.toFixed(2)}
            </p>
            <p className="text-sm opacity-75 mt-1">Per completed ride</p>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Revenue Distribution */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Revenue Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={financialAnalytics.revenueBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {financialAnalytics.revenueBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `₱${value.toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Ride Type Comparison */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">
              Special vs Regular Rides Revenue
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={financialAnalytics.rideTypeComparison}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value, name) =>
                    name === "revenue"
                      ? [`₱${value.toFixed(2)}`, "Revenue"]
                      : [value, name]
                  }
                />
                <Bar dataKey="revenue" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Daily Revenue Trends */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">
              Daily Revenue Trends (7 days)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={financialAnalytics.dailyRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) =>
                    new Date(value).toLocaleDateString()
                  }
                  formatter={(value, name) => [`₱${value.toFixed(2)}`, name]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="totalRevenue"
                  stroke="#8884d8"
                  name="Total Revenue"
                />
                <Line
                  type="monotone"
                  dataKey="companyRevenue"
                  stroke="#3b82f6"
                  name="Company Revenue"
                />
                <Line
                  type="monotone"
                  dataKey="driverRevenue"
                  stroke="#10b981"
                  name="Driver Revenue"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-50 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">
              Special Rides Performance
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Revenue:</span>
                <span className="font-semibold">
                  ₱{financialAnalytics.specialRidesRevenue.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Rides Count:</span>
                <span className="font-semibold">
                  {financialAnalytics.rideTypeComparison[0]?.count || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Average Fare:</span>
                <span className="font-semibold">
                  ₱
                  {(
                    financialAnalytics.rideTypeComparison[0]?.avgFare || 0
                  ).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">
              Regular Rides Performance
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Revenue:</span>
                <span className="font-semibold">
                  ₱{financialAnalytics.regularRidesRevenue.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Rides Count:</span>
                <span className="font-semibold">
                  {financialAnalytics.rideTypeComparison[1]?.count || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Average Fare:</span>
                <span className="font-semibold">
                  ₱
                  {(
                    financialAnalytics.rideTypeComparison[1]?.avgFare || 0
                  ).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500">Active Rides</p>
          <p className="text-2xl font-bold mt-2">{activeRidesCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500">Total Users</p>
          <p className="text-2xl font-bold mt-2">{totalUsersCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500">Active Drivers</p>
          <p className="text-2xl font-bold mt-2">{activeDriversCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500">Total Bookings</p>
          <p className="text-2xl font-bold mt-2">{totalBookingsCount}</p>
        </div>
      </div>

      {/* Current Rides Table */}
      <div className="bg-white rounded-lg shadow p-6 overflow-x-auto">
        <h2 className="text-lg font-semibold mb-4">Current Rides</h2>
        {loadingRides ? (
          <p className="text-center py-10">Loading current rides...</p>
        ) : rides.length === 0 ? (
          <p className="text-center py-10">No current rides.</p>
        ) : (
          <table className="w-full text-left table-auto">
            <thead>
              <tr className="text-gray-500 text-sm">
                <th className="p-2">Ride ID</th>
                <th className="p-2">Passenger</th>
                <th className="p-2">Driver</th>
                <th className="p-2">Status</th>
                <th className="p-2">Price</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {rides.map((ride) => {
                const badgeClass =
                  statusClasses[ride.status?.toLowerCase()] ||
                  "bg-gray-100 text-gray-800";
                const price =
                  ride.fare != null
                    ? ride.fare.toLocaleString(undefined, {
                        style: "currency",
                        currency: "PHP",
                      })
                    : "—";

                return (
                  <tr key={ride.id} className="border-t">
                    <td className="p-2">{ride.id}</td>
                    <td className="p-2">{ride.passenger}</td>
                    <td className="p-2">{ride.assignedRiderName}</td>
                    <td className="p-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${badgeClass}`}
                      >
                        {ride.status}
                      </span>
                    </td>
                    <td className="p-2">{price}</td>
                    <td className="p-2">
                      <Link
                        to={`/bookings/${ride.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Activity & Recent Users */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Activity */}
        <div className="bg-white rounded-lg shadow p-6 col-span-2 space-y-6">
          <h2 className="text-lg font-semibold">User Activity (Last 7 days)</h2>
          <UserActivityChart data={signUpData} title="New Sign-Ups" />
          <UserActivityChart data={bookingData} title="Rides Booked" />
        </div>

        {/* Recent Users */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Users</h2>
          <RecentUsers />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
