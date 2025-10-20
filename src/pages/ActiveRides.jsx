import React, { useEffect, useState, Fragment } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

const ActiveRides = () => {
  const [rides, setRides] = useState([]);
  const [filteredRides, setFilteredRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [analytics, setAnalytics] = useState({
    totalRides: 0,
    totalRevenue: 0,
    companyRevenue: 0, // Service fees
    driverRevenue: 0,
    averageFare: 0,
    averageServiceFee: 0,
    statusDistribution: [],
    revenueByStatus: [],
    dailyRevenue: [],
    topRoutes: [],
    completionRate: 0,
    totalDistance: 0,
    revenuePerKm: 0,
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
      driverEarnings: parseFloat(baseRideCost.toFixed(2)), // Driver gets base cost + special amount
      companyEarnings: parseFloat(serviceFee.toFixed(2)), // Company gets service fee
      distanceKm: parseFloat(distanceKm.toFixed(2)),
    };
  };

  // Calculate comprehensive analytics
  const calculateAnalytics = (ridesData) => {
    const ridesWithCalculations = ridesData.map((ride) => ({
      ...ride,
      ...calculateFareComponents(ride),
    }));

    const completedRides = ridesWithCalculations.filter(
      (r) => r.status === "Completed"
    );
    const totalRides = ridesWithCalculations.length;

    // Financial metrics
    const totalRevenue = completedRides.reduce(
      (sum, ride) => sum + ride.totalFare,
      0
    );
    const companyRevenue = completedRides.reduce(
      (sum, ride) => sum + ride.companyEarnings,
      0
    );
    const driverRevenue = completedRides.reduce(
      (sum, ride) => sum + (ride.driverEarnings + ride.specialAmount),
      0
    );
    const totalDistance = completedRides.reduce(
      (sum, ride) => sum + ride.distanceKm,
      0
    );

    const averageFare =
      completedRides.length > 0 ? totalRevenue / completedRides.length : 0;
    const averageServiceFee =
      completedRides.length > 0 ? companyRevenue / completedRides.length : 0;
    const completionRate =
      totalRides > 0 ? (completedRides.length / totalRides) * 100 : 0;
    const revenuePerKm = totalDistance > 0 ? totalRevenue / totalDistance : 0;

    // Status distribution
    const statusCounts = ridesWithCalculations.reduce((acc, ride) => {
      acc[ride.status] = (acc[ride.status] || 0) + 1;
      return acc;
    }, {});

    const statusDistribution = Object.entries(statusCounts).map(
      ([status, count]) => ({
        name: status,
        value: count,
        percentage: ((count / totalRides) * 100).toFixed(1),
      })
    );

    // Revenue by status (only completed rides generate revenue)
    const revenueByStatus = Object.entries(statusCounts).map(
      ([status, count]) => {
        const statusRevenue =
          status === "Completed"
            ? ridesWithCalculations
                .filter((r) => r.status === status)
                .reduce((sum, ride) => sum + ride.totalFare, 0)
            : 0;

        return {
          name: status,
          revenue: statusRevenue,
          count: count,
        };
      }
    );

    // Daily revenue trends
    const dailyData = {};
    ridesWithCalculations.forEach((ride) => {
      if (!ride.dateBooked) return;

      let dateKey;
      if (ride.dateBooked.toDate) {
        dateKey = ride.dateBooked.toDate().toISOString().split("T")[0];
      } else if (ride.dateBooked instanceof Date) {
        dateKey = ride.dateBooked.toISOString().split("T")[0];
      } else {
        dateKey = new Date(ride.dateBooked).toISOString().split("T")[0];
      }

      if (!dailyData[dateKey]) {
        dailyData[dateKey] = {
          date: dateKey,
          totalRevenue: 0,
          companyRevenue: 0,
          driverRevenue: 0,
          rides: 0,
          completedRides: 0,
        };
      }

      dailyData[dateKey].rides++;
      if (ride.status === "Completed") {
        dailyData[dateKey].totalRevenue += ride.totalFare;
        dailyData[dateKey].companyRevenue += ride.companyEarnings;
        dailyData[dateKey].driverRevenue +=
          ride.driverEarnings + ride.specialAmount;
        dailyData[dateKey].completedRides++;
      }
    });

    const dailyRevenue = Object.values(dailyData).sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    // Top routes by revenue
    const routeData = {};
    completedRides.forEach((ride) => {
      const route = `${ride.pickUpAddress || "Unknown"} → ${
        ride.dropOffAddress || "Unknown"
      }`;
      if (!routeData[route]) {
        routeData[route] = {
          route,
          revenue: 0,
          companyRevenue: 0,
          rides: 0,
          distance: 0,
        };
      }
      routeData[route].revenue += ride.totalFare;
      routeData[route].companyRevenue += ride.companyEarnings;
      routeData[route].rides++;
      routeData[route].distance += ride.distanceKm;
    });

    const topRoutes = Object.values(routeData)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      totalRides,
      totalRevenue,
      companyRevenue,
      driverRevenue,
      averageFare,
      averageServiceFee,
      statusDistribution,
      revenueByStatus,
      dailyRevenue,
      topRoutes,
      completionRate,
      totalDistance,
      revenuePerKm,
    };
  };

  useEffect(() => {
    const fetchRides = async () => {
      try {
        const colRef = collection(db, "bookings");
        const snap = await getDocs(colRef);

        // Map through bookings and fetch assigned rider username
        const ridesWithRiders = await Promise.all(
          snap.docs.map(async (d) => {
            const data = { id: d.id, ...d.data() };
            let assignedRiderName = "Unassigned";

            if (data.assignedRider) {
              // Query users by uid field
              const usersRef = collection(db, "users");
              const q = query(usersRef, where("uid", "==", data.assignedRider));
              const userSnap = await getDocs(q);
              if (!userSnap.empty) {
                assignedRiderName = userSnap.docs[0].data().username;
              }
            }

            return { ...data, assignedRiderName };
          })
        );

        setRides(ridesWithRiders);
        setFilteredRides(ridesWithRiders);

        // Calculate analytics for all rides
        const analyticsData = calculateAnalytics(ridesWithRiders);
        setAnalytics(analyticsData);
      } catch (err) {
        console.error("Error fetching rides:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRides();
  }, []);

  // Filter rides based on selected date and recalculate analytics
  useEffect(() => {
    let filtered;
    if (!dateFilter) {
      filtered = rides;
    } else {
      filtered = rides.filter((ride) => {
        if (!ride.dateBooked) return false;

        // Convert timestamp to date string for comparison
        let rideDate;
        if (ride.dateBooked.toDate) {
          // Firestore timestamp
          rideDate = ride.dateBooked.toDate().toISOString().split("T")[0];
        } else if (ride.dateBooked instanceof Date) {
          // JavaScript Date object
          rideDate = ride.dateBooked.toISOString().split("T")[0];
        } else if (typeof ride.dateBooked === "string") {
          // String date
          rideDate = new Date(ride.dateBooked).toISOString().split("T")[0];
        } else {
          return false;
        }

        return rideDate === dateFilter;
      });
    }

    setFilteredRides(filtered);
    setCurrentPage(1); // Reset to first page when filtering

    // Recalculate analytics for filtered data
    if (filtered.length > 0) {
      const analyticsData = calculateAnalytics(filtered);
      setAnalytics(analyticsData);
    }
  }, [rides, dateFilter]);

  // Get unique dates for the dropdown
  const getAvailableDates = () => {
    const dates = rides
      .map((ride) => {
        if (!ride.dateBooked) return null;

        let dateStr;
        if (ride.dateBooked.toDate) {
          dateStr = ride.dateBooked.toDate().toISOString().split("T")[0];
        } else if (ride.dateBooked instanceof Date) {
          dateStr = ride.dateBooked.toISOString().split("T")[0];
        } else if (typeof ride.dateBooked === "string") {
          dateStr = new Date(ride.dateBooked).toISOString().split("T")[0];
        }
        return dateStr;
      })
      .filter(Boolean);

    return [...new Set(dates)].sort((a, b) => new Date(b) - new Date(a));
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredRides.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentRides = filteredRides.slice(startIndex, endIndex);

  // Pagination handlers
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const statusClasses = {
    pending: "bg-yellow-100 text-yellow-800",
    ongoing: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };

  const COLORS = ["#FF9800", "#F57C00", "#E65100", "#FFB74D", "#FFCC02"];
  const STATUS_COLORS = {
    Completed: "#FF9800",
    Cancelled: "#ef4444",
    Pending: "#F57C00",
    Ongoing: "#E65100",
  };

  return (
    <div className="space-y-6">
      {/* Financial Analytics Dashboard */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-6 text-primary">
          Rides Financial Analytics
        </h2>

        {/* Key Financial Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-primary-orange rounded-lg shadow-lg p-6 text-white">
            <h3 className="text-sm font-medium opacity-90">Total Rides</h3>
            <p className="text-3xl font-bold mt-2">{analytics.totalRides}</p>
            <p className="text-sm opacity-75 mt-1">
              {filteredRides.filter((r) => r.status === "Completed").length}{" "}
              completed
            </p>
          </div>

          <div className="bg-blue-500 rounded-lg shadow-lg p-6 text-white">
            <h3 className="text-sm font-medium opacity-90">Total Revenue</h3>
            <p className="text-3xl font-bold mt-2">
              ₱{analytics.totalRevenue.toFixed(2)}
            </p>
            <p className="text-sm opacity-75 mt-1">From completed rides only</p>
          </div>

          <div className="bg-green-500 rounded-lg shadow-lg p-6 text-white">
            <h3 className="text-sm font-medium opacity-90">Company Revenue</h3>
            <p className="text-3xl font-bold mt-2">
              ₱{analytics.companyRevenue.toFixed(2)}
            </p>
            <p className="text-sm opacity-75 mt-1">Service fees (10%)</p>
          </div>

          <div className="bg-purple-500 rounded-lg shadow-lg p-6 text-white">
            <h3 className="text-sm font-medium opacity-90">Driver Revenue</h3>
            <p className="text-3xl font-bold mt-2">
              ₱{analytics.driverRevenue.toFixed(2)}
            </p>
            <p className="text-sm opacity-75 mt-1">Base cost + specials</p>
          </div>

          <div className="bg-pink-500 rounded-lg shadow-lg p-6 text-white">
            <h3 className="text-sm font-medium opacity-90">Completion Rate</h3>
            <p className="text-3xl font-bold mt-2">
              {analytics.completionRate.toFixed(1)}%
            </p>
            <p className="text-sm opacity-75 mt-1">Successfully completed</p>
          </div>
        </div>

        {/* Additional Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-700">Average Fare</h4>
            <p className="text-2xl font-bold text-gray-900">
              ₱{analytics.averageFare.toFixed(2)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-700">Avg. Service Fee</h4>
            <p className="text-2xl font-bold text-gray-900">
              ₱{analytics.averageServiceFee.toFixed(2)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-700">Revenue per KM</h4>
            <p className="text-2xl font-bold text-gray-900">
              ₱{analytics.revenuePerKm.toFixed(2)}
            </p>
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
                  data={[
                    {
                      name: "Company (Service Fees)",
                      value: analytics.companyRevenue,
                    },
                    { name: "Drivers", value: analytics.driverRevenue },
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) =>
                    `${name}: ₱${value.toFixed(2)} (${(percent * 100).toFixed(
                      1
                    )}%)`
                  }
                  outerRadius={80}
                  fill="#FF9800"
                  dataKey="value"
                >
                  <Cell fill="#FF9800" />
                  <Cell fill="#F57C00" />
                </Pie>
                <Tooltip formatter={(value) => `₱${value.toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Status Distribution */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">
              Ride Status Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.statusDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#FF9800" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue by Status */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Revenue by Status</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.revenueByStatus}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value, name) => [
                    name === "revenue" ? `₱${value.toFixed(2)}` : value,
                    name === "revenue" ? "Revenue" : "Count",
                  ]}
                />
                <Bar dataKey="revenue" fill="#FF9800" name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-500 mt-2">
              * Only completed rides generate revenue
            </p>
          </div>
        </div>

        {/* Daily Revenue Trends */}
        {analytics.dailyRevenue.length > 1 && (
          <div className="bg-white border rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold mb-4">Daily Revenue Trends</h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={analytics.dailyRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString()
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
                  stroke="#FF9800"
                  name="Total Revenue"
                />
                <Line
                  type="monotone"
                  dataKey="companyRevenue"
                  stroke="#F57C00"
                  name="Company Revenue"
                />
                <Line
                  type="monotone"
                  dataKey="driverRevenue"
                  stroke="#E65100"
                  name="Driver Revenue"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top Routes by Revenue */}
        <div className="bg-white border rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">Top Routes by Revenue</h3>
          <div className="space-y-4">
            {analytics.topRoutes.map((route, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{route.route}</p>
                  <p className="text-sm text-gray-600">
                    {route.rides} rides • {route.distance.toFixed(1)} km total
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">
                    ₱{route.revenue.toFixed(2)}
                  </p>
                  <p className="text-sm text-blue-600">
                    Company: ₱{route.companyRevenue.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
            {analytics.topRoutes.length === 0 && (
              <p className="text-gray-500 text-center py-4">
                No completed rides found
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Rides Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold">Rides Overview</h2>
            <div className="text-sm text-gray-500">
              Showing {startIndex + 1}-
              {Math.min(endIndex, filteredRides.length)} of{" "}
              {filteredRides.length} rides
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Items per page selector */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Show:</label>
              <select
                value={itemsPerPage}
                onChange={(e) =>
                  handleItemsPerPageChange(Number(e.target.value))
                }
                className="border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Date Filter Dropdown */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">
                Filter by Date:
              </label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Dates</option>
                {getAvailableDates().map((date) => (
                  <option key={date} value={date}>
                    {new Date(date).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-center mt-10">Loading Active Rides...</p>
        ) : !filteredRides.length ? (
          <p className="text-center mt-10 text-gray-500">
            No rides found for the selected criteria.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left table-auto border-collapse bg-white">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Ride ID
                  </th>
                  <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Passenger
                  </th>
                  <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Route
                  </th>
                  <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Distance
                  </th>
                  <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Base Cost
                  </th>
                  <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Service Fee
                  </th>
                  <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Special Amount
                  </th>
                  <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Total Fare
                  </th>
                  <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {currentRides.map((ride) => {
                  const fareData = calculateFareComponents(ride);
                  const badgeClass =
                    statusClasses[ride.status?.toLowerCase()] ||
                    "bg-gray-100 text-gray-800";

                  const getPriorityBadgeClass = (priority) => {
                    switch (priority?.toLowerCase()) {
                      case "special":
                        return "bg-purple-100 text-purple-800 border-purple-200";
                      case "urgent":
                        return "bg-red-100 text-red-800 border-red-200";
                      case "priority":
                        return "bg-yellow-100 text-yellow-800 border-yellow-200";
                      default:
                        return "bg-gray-100 text-gray-600 border-gray-200";
                    }
                  };

                  return (
                    <tr
                      key={ride.id}
                      className="hover:bg-gray-50 transition-colors duration-150"
                    >
                      <td className="p-3">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                          {ride.id.slice(-8)}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-gray-900">
                          {ride.passenger || "—"}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-gray-700">
                          {ride.assignedRiderName}
                        </div>
                      </td>
                      <td className="p-3 max-w-xs">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            📍 {ride.pickUpAddress || "Unknown pickup"}
                          </div>
                          <div className="text-sm text-gray-500 truncate">
                            🏁 {ride.dropOffAddress || "Unknown destination"}
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityBadgeClass(
                            ride.priorityType
                          )}`}
                        >
                          {ride.priorityType === "special"}
                          {ride.priorityType === "urgent"}
                          {ride.priorityType === "priority"}
                          {!ride.priorityType ||
                            ride.priorityType === "regular"}
                          {ride.priorityType || "Regular"}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeClass}`}
                        >
                          {ride.status === "Completed"}
                          {ride.status === "Cancelled"}
                          {ride.status === "Pending"}
                          {ride.status === "Ongoing"}
                          {ride.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="text-sm font-medium text-gray-900">
                          {fareData.distanceKm} km
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-sm font-semibold text-gray-900">
                          ₱{fareData.baseRideCost}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-sm font-semibold text-blue-600">
                          ₱{fareData.serviceFee}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-sm font-semibold text-purple-600">
                          ₱{fareData.specialAmount}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-sm font-bold text-green-600">
                          ₱{fareData.totalFare}
                        </div>
                      </td>
                      <td className="p-3">
                        <Link
                          to={`/bookings/${ride.id}`}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors duration-150"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {filteredRides.length > 0 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {startIndex + 1} to{" "}
              {Math.min(endIndex, filteredRides.length)} of{" "}
              {filteredRides.length} results
            </div>

            <div className="flex items-center space-x-2">
              {/* Previous button */}
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              {/* Page numbers */}
              <div className="flex items-center space-x-1">
                {getPageNumbers().map((page, index) => (
                  <Fragment key={index}>
                    {page === "..." ? (
                      <span className="px-3 py-2 text-sm font-medium text-gray-500">
                        ...
                      </span>
                    ) : (
                      <button
                        onClick={() => handlePageChange(page)}
                        className={`px-3 py-2 text-sm font-medium rounded-md ${
                          currentPage === page
                            ? "bg-blue-600 text-white"
                            : "text-gray-500 bg-white border border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {page}
                      </button>
                    )}
                  </Fragment>
                ))}
              </div>

              {/* Next button */}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveRides;
