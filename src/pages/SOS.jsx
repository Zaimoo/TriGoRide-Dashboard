import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { format } from "date-fns";

const SOS = () => {
  const [sosAlerts, setSosAlerts] = useState([]);
  const [filteredAlerts, setFilteredAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchSOSAlerts();
  }, []);

  useEffect(() => {
    filterAlerts();
  }, [sosAlerts, searchTerm]);

  const fetchSOSAlerts = async () => {
    try {
      setLoading(true);
      const sosQuery = query(
        collection(db, "sos_alerts"),
        orderBy("timestamp", "desc")
      );
      const querySnapshot = await getDocs(sosQuery);

      const alerts = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setSosAlerts(alerts);
      setFilteredAlerts(alerts);
    } catch (error) {
      console.error("Error fetching SOS alerts:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterAlerts = () => {
    if (!searchTerm.trim()) {
      setFilteredAlerts(sosAlerts);
      return;
    }

    const filtered = sosAlerts.filter((alert) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        alert.userName?.toLowerCase().includes(searchLower) ||
        alert.userId?.toLowerCase().includes(searchLower) ||
        alert.bookingId?.toLowerCase().includes(searchLower) ||
        alert.emergencyContact?.includes(searchTerm)
      );
    });

    setFilteredAlerts(filtered);
    setCurrentPage(1);
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return format(date, "MMM dd, yyyy hh:mm a");
    } catch (error) {
      return "Invalid Date";
    }
  };

  const formatLocation = (location) => {
    if (!location) return "N/A";
    try {
      const lat = location.latitude ?? location._lat;
      const lng = location.longitude ?? location._long;

      if (lat == null || lng == null || lat === 0 || lng === 0) {
        return "N/A";
      }

      return `${lat.toFixed(6)}°, ${lng.toFixed(6)}°`;
    } catch (error) {
      console.error("Error formatting location:", error, location);
      return "Invalid Location";
    }
  };

  const openGoogleMaps = (location) => {
    if (!location) return;
    try {
      const lat = location.latitude ?? location._lat;
      const lng = location.longitude ?? location._long;

      if (lat == null || lng == null || lat === 0 || lng === 0) {
        alert("Location data is not available");
        return;
      }

      window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
    } catch (error) {
      console.error("Error opening maps:", error);
    }
  };

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentAlerts = filteredAlerts.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredAlerts.length / itemsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl font-semibold text-gray-600">
          Loading SOS alerts...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            SOS Emergency Alerts
          </h1>
          <p className="text-gray-600">
            Monitor and respond to emergency button activations
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-6 text-white hover:shadow-xl transition-shadow">
            <h3 className="text-sm font-medium opacity-90">Total SOS Alerts</h3>
            <p className="text-3xl font-bold mt-2">{sosAlerts.length}</p>
            <p className="text-sm opacity-75 mt-1">All time emergency alerts</p>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white hover:shadow-xl transition-shadow">
            <h3 className="text-sm font-medium opacity-90">Today's Alerts</h3>
            <p className="text-3xl font-bold mt-2">
              {
                sosAlerts.filter((alert) => {
                  if (!alert.timestamp) return false;
                  const alertDate = alert.timestamp.toDate
                    ? alert.timestamp.toDate()
                    : new Date(alert.timestamp);
                  const today = new Date();
                  return alertDate.toDateString() === today.toDateString();
                }).length
              }
            </p>
            <p className="text-sm opacity-75 mt-1">Emergency alerts today</p>
          </div>

          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg shadow-lg p-6 text-white hover:shadow-xl transition-shadow">
            <h3 className="text-sm font-medium opacity-90">This Month</h3>
            <p className="text-3xl font-bold mt-2">
              {
                sosAlerts.filter((alert) => {
                  if (!alert.timestamp) return false;
                  const alertDate = alert.timestamp.toDate
                    ? alert.timestamp.toDate()
                    : new Date(alert.timestamp);
                  const now = new Date();
                  return (
                    alertDate.getMonth() === now.getMonth() &&
                    alertDate.getFullYear() === now.getFullYear()
                  );
                }).length
              }
            </p>
            <p className="text-sm opacity-75 mt-1">
              Emergency alerts this month
            </p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex-1 w-full md:w-auto">
              <input
                type="text"
                placeholder="Search by name, user ID, booking ID, or contact..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Show:</label>
              <select
                value={itemsPerPage}
                onChange={handleItemsPerPageChange}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-red-500 to-red-600 text-white">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                    User Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                    User ID
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                    Emergency Contact
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentAlerts.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      {searchTerm
                        ? "No alerts found matching your search"
                        : "No SOS alerts recorded"}
                    </td>
                  </tr>
                ) : (
                  currentAlerts.map((alert, index) => (
                    <tr
                      key={alert.id}
                      className={`hover:bg-red-50 transition-colors ${
                        index % 2 === 0 ? "bg-white" : "bg-gray-50"
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTimestamp(alert.timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {alert.userName || "Unknown"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {alert.userId || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <a
                          href={`tel:${alert.emergencyContact}`}
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {alert.emergencyContact || "N/A"}
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => openGoogleMaps(alert.location)}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {formatLocation(alert.location)}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link
                          to={`/sos/${alert.id}`}
                          className="inline-block bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors font-medium"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Showing {indexOfFirstItem + 1} to{" "}
                {Math.min(indexOfLastItem, filteredAlerts.length)} of{" "}
                {filteredAlerts.length} alerts
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`px-4 py-2 rounded-lg ${
                    currentPage === 1
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-red-500 text-white hover:bg-red-600"
                  }`}
                >
                  Previous
                </button>
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => handlePageChange(i + 1)}
                    className={`px-4 py-2 rounded-lg ${
                      currentPage === i + 1
                        ? "bg-red-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`px-4 py-2 rounded-lg ${
                    currentPage === totalPages
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-red-500 text-white hover:bg-red-600"
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SOS;
