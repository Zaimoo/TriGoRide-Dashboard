// src/pages/Drivers.jsx

import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where as whereFirestore,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";

const Drivers = () => {
  const [drivers, setDrivers] = useState([]);
  const [filteredDrivers, setFilteredDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState([]);
  const [dateFilter, setDateFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("username");
  const [sortOrder, setSortOrder] = useState("asc");

  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const q = query(
          collection(db, "users"),
          whereFirestore("userType", "==", "Driver")
        );
        const snap = await getDocs(q);
        setDrivers(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setFilteredDrivers(
          snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      } catch (err) {
        console.error("Error fetching drivers:", err);
      }
    };

    const fetchRatings = async () => {
      try {
        const q = query(collection(db, "ratings"));
        const snap = await getDocs(q);
        const ratingsData = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setRatings(ratingsData);
      } catch (err) {
        console.error("Error fetching ratings:", err);
      }
    };

    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchDrivers(), fetchRatings()]);
      setLoading(false);
    };

    fetchData();
  }, []);

  // Filter and sort drivers based on all criteria
  useEffect(() => {
    let filtered = [...drivers];

    // Apply date filter
    if (dateFilter) {
      filtered = filtered.filter((driver) => {
        if (!driver.createdAt) return false;

        let driverDate;
        if (driver.createdAt.toDate) {
          driverDate = driver.createdAt.toDate().toISOString().split("T")[0];
        } else if (driver.createdAt instanceof Date) {
          driverDate = driver.createdAt.toISOString().split("T")[0];
        } else if (typeof driver.createdAt === "string") {
          driverDate = new Date(driver.createdAt).toISOString().split("T")[0];
        } else {
          return false;
        }

        return driverDate === dateFilter;
      });
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((driver) => {
        const searchFields = [
          driver.username,
          driver.email,
          driver.phone,
          driver.plateNumber,
        ];

        return searchFields.some(
          (field) =>
            field && field.toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case "username":
          aValue = a.username || "";
          bValue = b.username || "";
          break;
        case "email":
          aValue = a.email || "";
          bValue = b.email || "";
          break;
        case "phone":
          aValue = a.phone || "";
          bValue = b.phone || "";
          break;
        case "plateNumber":
          aValue = a.plateNumber || "";
          bValue = b.plateNumber || "";
          break;
        case "rating":
          const aRatings = ratings.filter(
            (r) => r.driverId === (a.uid || a.id)
          );
          const bRatings = ratings.filter(
            (r) => r.driverId === (b.uid || b.id)
          );

          aValue =
            aRatings.length > 0
              ? aRatings.reduce((sum, r) => sum + r.rating, 0) / aRatings.length
              : 0;
          bValue =
            bRatings.length > 0
              ? bRatings.reduce((sum, r) => sum + r.rating, 0) / bRatings.length
              : 0;
          break;
        case "verified":
          aValue = a.verified ? 1 : 0;
          bValue = b.verified ? 1 : 0;
          break;
        case "createdAt":
          aValue = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          bValue = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          break;
        default:
          aValue = "";
          bValue = "";
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortOrder === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
      }
    });

    setFilteredDrivers(filtered);
  }, [drivers, dateFilter, searchTerm, sortBy, sortOrder, ratings]);

  // Get unique dates for the dropdown
  const getAvailableDates = () => {
    const dates = drivers
      .map((driver) => {
        if (!driver.createdAt) return null;

        let dateStr;
        if (driver.createdAt.toDate) {
          dateStr = driver.createdAt.toDate().toISOString().split("T")[0];
        } else if (driver.createdAt instanceof Date) {
          dateStr = driver.createdAt.toISOString().split("T")[0];
        } else if (typeof driver.createdAt === "string") {
          dateStr = new Date(driver.createdAt).toISOString().split("T")[0];
        }
        return dateStr;
      })
      .filter(Boolean);

    return [...new Set(dates)].sort((a, b) => new Date(b) - new Date(a));
  };

  // Calculate average rating for a driver
  const getDriverRating = (driverId) => {
    const driverRatings = ratings.filter(
      (rating) => rating.driverId === driverId
    );
    if (driverRatings.length === 0) return "No ratings";

    const totalRating = driverRatings.reduce(
      (sum, rating) => sum + rating.rating,
      0
    );
    const averageRating = totalRating / driverRatings.length;
    return `${averageRating.toFixed(1)} (${driverRatings.length})`;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "#FF9800" }}>
            Drivers
          </h1>
          <p className="text-gray-600">Manage all registered drivers here.</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Drivers:
            </label>
            <input
              type="text"
              placeholder="Search by name, email, phone, or plate..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Registration Date:
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
            >
              <option value="">All Dates</option>
              {getAvailableDates().map((date) => (
                <option key={date} value={date}>
                  {new Date(date).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sort By:
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
            >
              <option value="username">Username</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="plateNumber">Plate Number</option>
              <option value="rating">Rating</option>
              <option value="verified">Verification Status</option>
              <option value="createdAt">Registration Date</option>
            </select>
          </div>

          {/* Sort Order */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sort Order:
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredDrivers.length} of {drivers.length} drivers
          {(searchTerm || dateFilter) && (
            <button
              onClick={() => {
                setSearchTerm("");
                setDateFilter("");
              }}
              className="ml-2 text-blue-600 hover:text-blue-800 underline"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading drivers…</div>
        ) : filteredDrivers.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            {dateFilter
              ? "No drivers found for the selected date."
              : "No drivers found."}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => {
                    if (sortBy === "username") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("username");
                      setSortOrder("asc");
                    }
                  }}
                >
                  <div className="flex items-center">
                    Username
                    {sortBy === "username" && (
                      <span className="ml-1">
                        {sortOrder === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => {
                    if (sortBy === "email") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("email");
                      setSortOrder("asc");
                    }
                  }}
                >
                  <div className="flex items-center">
                    Email
                    {sortBy === "email" && (
                      <span className="ml-1">
                        {sortOrder === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => {
                    if (sortBy === "phone") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("phone");
                      setSortOrder("asc");
                    }
                  }}
                >
                  <div className="flex items-center">
                    Phone
                    {sortBy === "phone" && (
                      <span className="ml-1">
                        {sortOrder === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => {
                    if (sortBy === "plateNumber") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("plateNumber");
                      setSortOrder("asc");
                    }
                  }}
                >
                  <div className="flex items-center">
                    Plate Number
                    {sortBy === "plateNumber" && (
                      <span className="ml-1">
                        {sortOrder === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => {
                    if (sortBy === "rating") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("rating");
                      setSortOrder("desc"); // Default to highest rating first
                    }
                  }}
                >
                  <div className="flex items-center justify-center">
                    Rating
                    {sortBy === "rating" && (
                      <span className="ml-1">
                        {sortOrder === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => {
                    if (sortBy === "verified") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("verified");
                      setSortOrder("desc"); // Default to verified first
                    }
                  }}
                >
                  <div className="flex items-center justify-center">
                    Verified
                    {sortBy === "verified" && (
                      <span className="ml-1">
                        {sortOrder === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDrivers.map((u) => (
                <tr
                  key={u.id}
                  className="hover:bg-gray-100 transition-colors duration-150"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {u.username || "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {u.email || "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {u.phone || "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {u.plateNumber || "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="text-sm text-gray-700">
                      {getDriverRating(u.uid || u.id)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {u.verified ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Yes
                      </span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        No
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Drivers;
