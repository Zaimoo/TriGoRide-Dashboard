// src/pages/Reports.jsx

import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  format,
  subDays,
  startOfDay,
  getHours,
  startOfWeek,
  endOfWeek,
  subWeeks,
} from "date-fns";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../firebase";

const DAYS = 7;
const SERVICE_FEE_PERCENTAGE = 0.1; // 10% service fee
const WEEKS_TO_SHOW = 4; // Show last 4 weeks of individual reports

const Reports = () => {
  const [dailyCompleted, setDailyCompleted] = useState([]);
  const [dailyCancelled, setDailyCancelled] = useState([]);
  const [peakHours, setPeakHours] = useState([]);
  const [acceptanceRate, setAcceptanceRate] = useState(0);
  const [ratingsData, setRatingsData] = useState([]);
  const [userSignupsData, setUserSignupsData] = useState([]);
  const [activeUsersData, setActiveUsersData] = useState([]);
  const [driverServiceFees, setDriverServiceFees] = useState([]);
  const [weeklyDriverReports, setWeeklyDriverReports] = useState([]);
  const [weeklyTotalIncome, setWeeklyTotalIncome] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(0); // 0 = current week, 1 = last week, etc.
  const DAYS_TO_SHOW = 7;

  // Utility function to calculate service fees for drivers
  const calculateDriverServiceFees = async () => {
    try {
      // Get all completed bookings
      const bookingsQuery = query(
        collection(db, "bookings"),
        where("status", "==", "Completed")
      );
      const bookingsSnap = await getDocs(bookingsQuery);

      // Get all drivers - try both exact case and lowercase
      let driversSnap;
      try {
        const driversQuery = query(
          collection(db, "users"),
          where("userType", "==", "Driver")
        );
        driversSnap = await getDocs(driversQuery);

        // If no drivers found, try lowercase
        if (driversSnap.docs.length === 0) {
          const driversQueryLower = query(
            collection(db, "users"),
            where("userType", "==", "driver")
          );
          driversSnap = await getDocs(driversQueryLower);
        }
      } catch (error) {
        console.error("Error fetching drivers:", error);
        driversSnap = { docs: [] };
      }

      const driverMap = {};
      driversSnap.docs.forEach((doc) => {
        const driver = doc.data();

        // Use uid if available, otherwise use document id as fallback
        const driverKey = driver.uid || doc.id;

        // Map by uid (or doc id as fallback) since assignedRider should use uid
        driverMap[driverKey] = {
          id: driverKey,
          docId: doc.id, // Keep reference to document id (email)
          name: driver.username || driver.displayName || "Unknown Driver",
          email: driver.email || "",
          totalEarnings: 0,
          totalRides: 0,
          serviceFeeOwed: 0,
          weeklyData: [],
        };
      });

      // Calculate earnings and service fees
      bookingsSnap.docs.forEach((doc) => {
        const booking = doc.data();
        const driverId = booking.assignedRider || booking.driverId;
        const fare = parseFloat(booking.fare || booking.price || 0);

        if (driverId && fare > 0) {
          // If driver not found in driverMap, create a placeholder entry
          if (!driverMap[driverId]) {
            driverMap[driverId] = {
              id: driverId,
              docId: null, // No document reference for unknown drivers
              name: "Unknown Driver (UID: " + driverId.substring(0, 8) + "...)",
              email: "",
              totalEarnings: 0,
              totalRides: 0,
              serviceFeeOwed: 0,
              weeklyData: [],
            };
          }

          driverMap[driverId].totalEarnings += fare;
          driverMap[driverId].totalRides += 1;
          driverMap[driverId].serviceFeeOwed += fare * SERVICE_FEE_PERCENTAGE;
        }
      });

      return Object.values(driverMap).filter((driver) => driver.totalRides > 0);
    } catch (error) {
      console.error("Error calculating driver service fees:", error);
      return [];
    }
  };

  // Generate weekly reports for individual drivers
  const generateWeeklyDriverReports = async () => {
    try {
      const reports = [];

      // First, get all drivers to have their names available
      let driversSnap;
      try {
        const driversQuery = query(
          collection(db, "users"),
          where("userType", "==", "Driver")
        );
        driversSnap = await getDocs(driversQuery);

        // If no drivers found, try lowercase
        if (driversSnap.docs.length === 0) {
          const driversQueryLower = query(
            collection(db, "users"),
            where("userType", "==", "driver")
          );
          driversSnap = await getDocs(driversQueryLower);
        }
      } catch (error) {
        console.error("Error fetching drivers:", error);
        driversSnap = { docs: [] };
      }

      // Create driver lookup map
      const driverLookup = {};
      driversSnap.docs.forEach((doc) => {
        const driver = doc.data();
        const driverKey = driver.uid || doc.id;
        driverLookup[driverKey] = {
          name: driver.username || driver.displayName || "Unknown Driver",
          email: driver.email || "",
        };
      });

      for (let weekOffset = 0; weekOffset < WEEKS_TO_SHOW; weekOffset++) {
        const weekStart = startOfWeek(subWeeks(new Date(), weekOffset));
        const weekEnd = endOfWeek(subWeeks(new Date(), weekOffset));

        const bookingsQuery = query(
          collection(db, "bookings"),
          where("status", "==", "Completed"),
          where("dateBooked", ">=", weekStart),
          where("dateBooked", "<=", weekEnd)
        );
        const bookingsSnap = await getDocs(bookingsQuery);

        const weeklyDriverData = {};

        bookingsSnap.docs.forEach((doc) => {
          const booking = doc.data();
          const driverId = booking.assignedRider || booking.driverId;
          const fare = parseFloat(booking.fare || booking.price || 0);

          if (driverId && !weeklyDriverData[driverId]) {
            const driverInfo = driverLookup[driverId];
            weeklyDriverData[driverId] = {
              driverId,
              driverName: driverInfo
                ? driverInfo.name
                : `Unknown Driver (${driverId.substring(0, 8)}...)`,
              driverEmail: driverInfo ? driverInfo.email : "",
              weekStart: format(weekStart, "yyyy-MM-dd"),
              weekEnd: format(weekEnd, "yyyy-MM-dd"),
              weekLabel:
                format(weekStart, "MMM dd") +
                " - " +
                format(weekEnd, "MMM dd, yyyy"),
              totalEarnings: 0,
              totalRides: 0,
              serviceFeeOwed: 0,
              rides: [],
            };
          }

          if (driverId && fare > 0) {
            weeklyDriverData[driverId].totalEarnings += fare;
            weeklyDriverData[driverId].totalRides += 1;
            weeklyDriverData[driverId].serviceFeeOwed +=
              fare * SERVICE_FEE_PERCENTAGE;
            weeklyDriverData[driverId].rides.push({
              id: doc.id,
              fare,
              date: booking.dateBooked.toDate(),
              passenger:
                booking.passenger || booking.passengerName || "Unknown",
            });
          }
        });

        reports.push({
          weekOffset,
          weekLabel:
            format(weekStart, "MMM dd") +
            " - " +
            format(weekEnd, "MMM dd, yyyy"),
          drivers: Object.values(weeklyDriverData),
        });
      }

      return reports;
    } catch (error) {
      console.error("Error generating weekly driver reports:", error);
      return [];
    }
  };

  // Generate weekly total income from service fees
  const generateWeeklyTotalIncome = async () => {
    try {
      const incomeData = [];

      for (let weekOffset = 0; weekOffset < WEEKS_TO_SHOW; weekOffset++) {
        const weekStart = startOfWeek(subWeeks(new Date(), weekOffset));
        const weekEnd = endOfWeek(subWeeks(new Date(), weekOffset));

        const bookingsQuery = query(
          collection(db, "bookings"),
          where("status", "==", "Completed"),
          where("dateBooked", ">=", weekStart),
          where("dateBooked", "<=", weekEnd)
        );
        const bookingsSnap = await getDocs(bookingsQuery);

        let totalServiceFee = 0;
        let totalRides = 0;
        let totalEarnings = 0;

        bookingsSnap.docs.forEach((doc) => {
          const booking = doc.data();
          const driverId = booking.assignedRider || booking.driverId;
          const fare = parseFloat(booking.fare || booking.price || 0);

          if (driverId && fare > 0) {
            totalEarnings += fare;
            totalServiceFee += fare * SERVICE_FEE_PERCENTAGE;
            totalRides += 1;
          }
        });

        incomeData.push({
          weekOffset,
          weekStart: format(weekStart, "yyyy-MM-dd"),
          weekEnd: format(weekEnd, "yyyy-MM-dd"),
          weekLabel:
            format(weekStart, "MMM dd") +
            " - " +
            format(weekEnd, "MMM dd, yyyy"),
          totalRides,
          totalEarnings,
          totalServiceFee,
          averageServiceFeePerRide:
            totalRides > 0 ? totalServiceFee / totalRides : 0,
        });
      }

      return incomeData;
    } catch (error) {
      console.error("Error generating weekly total income:", error);
      return [];
    }
  };

  // Download weekly total income report as CSV
  const downloadWeeklyIncomeReport = () => {
    const csvContent = [
      [
        "Week",
        "Total Rides",
        "Total Earnings (₱)",
        "Total Service Fee Income (₱)",
        "Average Service Fee per Ride (₱)",
      ],
      ...weeklyTotalIncome.map((week) => [
        week.weekLabel,
        week.totalRides,
        week.totalEarnings.toFixed(2),
        week.totalServiceFee.toFixed(2),
        week.averageServiceFeePerRide.toFixed(2),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `weekly-service-fee-income-report.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download report as CSV
  const downloadWeeklyReport = (weekData) => {
    const csvContent = [
      [
        "Driver Name",
        "Total Rides",
        "Total Earnings (₱)",
        "Service Fee Owed (₱)",
        "Net Earnings (₱)",
      ],
      ...weekData.drivers.map((driver) => [
        driver.driverName || `Driver ${driver.driverId}`,
        driver.totalRides,
        driver.totalEarnings.toFixed(2),
        driver.serviceFeeOwed.toFixed(2),
        (driver.totalEarnings - driver.serviceFeeOwed).toFixed(2),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `driver-report-${weekData.weekLabel.replace(/[^a-zA-Z0-9]/g, "-")}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchDailyCounts = async (colName, dateField, days = DAYS_TO_SHOW) => {
    const today = startOfDay(new Date());
    const start = subDays(today, days - 1);

    const q = query(
      collection(db, colName),
      where("userType", "==", "Passenger"), // ← correct
      where(dateField, ">=", start),
      orderBy(dateField, "asc") // optional but recommended
    );
    const snap = await getDocs(q);

    // initialize buckets
    const buckets = {};
    for (let i = 0; i < days; i++) {
      const day = subDays(today, i).toISOString().slice(0, 10);
      buckets[day] = 0;
    }

    snap.docs.forEach((d) => {
      const raw = d.data()[dateField];
      // If it’s not a Firestore Timestamp, skip it
      if (!raw || typeof raw.toDate !== "function") return;

      const ts = raw.toDate();
      if (isNaN(ts.getTime())) return; // just in case
      const key = format(ts, "yyyy-MM-dd");
      if (buckets[key] != null) buckets[key]++;
    });

    return Object.entries(buckets)
      .sort(([a], [b]) => new Date(a) - new Date(b))
      .map(([date, count]) => ({ date, count }));
  };

  useEffect(() => {
    (async () => {
      const today = startOfDay(new Date());
      const start = subDays(today, DAYS - 1);

      // Booking metrics
      const bookingsSnap = await getDocs(
        query(
          collection(db, "bookings"),
          where("dateBooked", ">=", start),
          orderBy("dateBooked", "asc")
        )
      );
      const dailyBuckets = {};
      for (let i = 0; i < DAYS; i++)
        dailyBuckets[format(subDays(today, i), "yyyy-MM-dd")] = {
          completed: 0,
          cancelled: 0,
        };
      const hourBuckets = Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        count: 0,
      }));
      bookingsSnap.docs.forEach((doc) => {
        const { dateBooked, status } = doc.data();
        const ts = dateBooked.toDate();
        const key = format(ts, "yyyy-MM-dd");
        const st = (status || "").toLowerCase();
        if (dailyBuckets[key]) {
          if (st === "completed") dailyBuckets[key].completed++;
          if (st === "cancelled") dailyBuckets[key].cancelled++;
        }
        hourBuckets[getHours(ts)].count++;
      });
      const comp = [],
        canc = [];
      for (let i = DAYS - 1; i >= 0; i--) {
        const date = format(subDays(today, i), "yyyy-MM-dd");
        comp.push({ date, count: dailyBuckets[date].completed });
        canc.push({ date, count: dailyBuckets[date].cancelled });
      }
      setDailyCompleted(comp);
      setDailyCancelled(canc);
      setPeakHours(hourBuckets);
      const totalComp = comp.reduce((sum, d) => sum + d.count, 0);
      const totalAll = totalComp + canc.reduce((sum, d) => sum + d.count, 0);
      setAcceptanceRate(
        totalAll ? Math.round((totalComp / totalAll) * 100) : 0
      );

      // Ratings
      const ratingsSnap = await getDocs(collection(db, "ratings"));
      const byDriver = {};
      ratingsSnap.docs.forEach((d) => {
        const { driverId, rating } = d.data();
        if (!driverId || typeof rating !== "number") return;
        if (!byDriver[driverId]) byDriver[driverId] = { sum: 0, count: 0 };
        byDriver[driverId].sum += rating;
        byDriver[driverId].count += 1;
      });
      const userSnap = await getDocs(collection(db, "users"));
      const nameMap = {};
      userSnap.docs.forEach((u) => {
        const { uid, username, displayName } = u.data();
        if (uid) nameMap[uid] = username || displayName;
      });
      setRatingsData(
        Object.entries(byDriver).map(([id, { sum, count }]) => ({
          username: nameMap[id] || id,
          average: parseFloat((sum / count).toFixed(2)),
        }))
      );

      // Passenger signups

      const passengerSignups = await fetchDailyCounts("users", "createdAt");
      console.log("Passenger signups:", passengerSignups);
      setUserSignupsData(passengerSignups);

      // Active users
      setActiveUsersData(await fetchDailyCounts("bookings", "dateBooked"));

      // Load driver service fees
      const serviceFees = await calculateDriverServiceFees();
      setDriverServiceFees(serviceFees);

      // Load weekly driver reports
      const weeklyReports = await generateWeeklyDriverReports();
      setWeeklyDriverReports(weeklyReports);

      // Load weekly total income
      const weeklyIncome = await generateWeeklyTotalIncome();
      setWeeklyTotalIncome(weeklyIncome);
    })();
  }, []);
  return (
    <div className="space-y-8">
      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <p className="text-gray-500">Completed Rides (7d)</p>
          <p className="text-2xl font-bold">
            {dailyCompleted.reduce((s, d) => s + d.count, 0)}
          </p>
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          <p className="text-gray-500">Cancellations (7d)</p>
          <p className="text-2xl font-bold">
            {dailyCancelled.reduce((s, d) => s + d.count, 0)}
          </p>
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          <p className="text-gray-500">Success Rate</p>
          <p className="text-2xl font-bold">{acceptanceRate}%</p>
        </div>
      </div>

      {/* DRIVER SERVICE FEES SECTION */}
      <div className="bg-white shadow-lg rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-6" style={{ color: "#FF9800" }}>
          Driver Service Fees Overview
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-gray-700 font-medium">Driver Name</th>
                <th className="p-3 text-gray-700 font-medium">
                  Rides Completed
                </th>
                <th className="p-3 text-gray-700 font-medium">
                  Total Earnings
                </th>
                <th className="p-3 text-gray-700 font-medium">
                  Service Fee Owed (10%)
                </th>
                <th className="p-3 text-gray-700 font-medium">Net Earnings</th>
              </tr>
            </thead>
            <tbody>
              {driverServiceFees.length > 0 ? (
                driverServiceFees.map((driver, index) => (
                  <tr key={driver.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">{driver.name}</td>
                    <td className="p-3">{driver.totalRides}</td>
                    <td className="p-3">₱{driver.totalEarnings.toFixed(2)}</td>
                    <td
                      className="p-3 font-semibold"
                      style={{ color: "#FF9800" }}
                    >
                      ₱{driver.serviceFeeOwed.toFixed(2)}
                    </td>
                    <td className="p-3">
                      ₱
                      {(driver.totalEarnings - driver.serviceFeeOwed).toFixed(
                        2
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <div className="mb-2">💰</div>
                      <div className="font-medium">
                        No Driver Service Fee Data Available
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        Service fee data will appear here once rides are
                        completed
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* WEEKLY DRIVER REPORTS SECTION */}
      <div className="bg-white shadow-lg rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold" style={{ color: "#FF9800" }}>
            Weekly Driver Reports
          </h2>
          <div className="flex items-center space-x-4">
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{
                focusRingColor: "#FF9800",
              }}
              disabled={weeklyDriverReports.length === 0}
            >
              {weeklyDriverReports.length > 0 ? (
                weeklyDriverReports.map((week, index) => (
                  <option key={index} value={index}>
                    {week.weekLabel}
                  </option>
                ))
              ) : (
                <option value={0}>No data available</option>
              )}
            </select>
            {weeklyDriverReports[selectedWeek] &&
              weeklyDriverReports[selectedWeek].drivers.length > 0 && (
                <button
                  onClick={() =>
                    downloadWeeklyReport(weeklyDriverReports[selectedWeek])
                  }
                  className="inline-flex items-center px-3 py-1 text-white rounded-md transition text-sm"
                  style={{ backgroundColor: "#FF9800" }}
                  onMouseEnter={(e) =>
                    (e.target.style.backgroundColor = "#F57C00")
                  }
                  onMouseLeave={(e) =>
                    (e.target.style.backgroundColor = "#FF9800")
                  }
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Download
                </button>
              )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-gray-700 font-medium">Driver Name</th>
                <th className="p-3 text-gray-700 font-medium">
                  Rides Completed
                </th>
                <th className="p-3 text-gray-700 font-medium">
                  Total Earnings
                </th>
                <th className="p-3 text-gray-700 font-medium">
                  Service Fee Owed (10%)
                </th>
                <th className="p-3 text-gray-700 font-medium">Net Earnings</th>
              </tr>
            </thead>
            <tbody>
              {weeklyDriverReports.length > 0 &&
              weeklyDriverReports[selectedWeek] &&
              weeklyDriverReports[selectedWeek].drivers.length > 0 ? (
                weeklyDriverReports[selectedWeek].drivers.map(
                  (driver, index) => (
                    <tr
                      key={driver.driverId}
                      className="border-b hover:bg-gray-50"
                    >
                      <td className="p-3">
                        <div className="font-medium">{driver.driverName}</div>
                        {driver.driverEmail && (
                          <div className="text-sm text-gray-500">
                            {driver.driverEmail}
                          </div>
                        )}
                      </td>
                      <td className="p-3">{driver.totalRides}</td>
                      <td className="p-3">
                        ₱{driver.totalEarnings.toFixed(2)}
                      </td>
                      <td
                        className="p-3 font-semibold"
                        style={{ color: "#FF9800" }}
                      >
                        ₱{driver.serviceFeeOwed.toFixed(2)}
                      </td>
                      <td className="p-3">
                        ₱
                        {(driver.totalEarnings - driver.serviceFeeOwed).toFixed(
                          2
                        )}
                      </td>
                    </tr>
                  )
                )
              ) : (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <div className="mb-2">📅</div>
                      <div className="font-medium">
                        No Weekly Report Data Available
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        {weeklyDriverReports.length === 0
                          ? "Weekly reports will appear here once data is loaded"
                          : "No driver activity for the selected week"}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* WEEKLY TOTAL INCOME SECTION */}
      <div className="bg-white shadow-lg rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold" style={{ color: "#FF9800" }}>
            Weekly Total Income from Service Fees
          </h2>
          {weeklyTotalIncome.length > 0 && (
            <button
              onClick={downloadWeeklyIncomeReport}
              className="inline-flex items-center px-4 py-2 text-white rounded-lg transition hover:shadow-md"
              style={{ backgroundColor: "#FF9800" }}
              onMouseEnter={(e) => (e.target.style.backgroundColor = "#F57C00")}
              onMouseLeave={(e) => (e.target.style.backgroundColor = "#FF9800")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Download Report
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-gray-700 font-medium">Week</th>
                <th className="p-3 text-gray-700 font-medium">Total Rides</th>
                <th className="p-3 text-gray-700 font-medium">
                  Total Earnings
                </th>
                <th className="p-3 text-gray-700 font-medium">
                  Service Fee Income (10%)
                </th>
                <th className="p-3 text-gray-700 font-medium">
                  Avg. Service Fee per Ride
                </th>
              </tr>
            </thead>
            <tbody>
              {weeklyTotalIncome.length > 0 ? (
                weeklyTotalIncome.map((week, index) => (
                  <tr
                    key={week.weekOffset}
                    className="border-b hover:bg-gray-50"
                  >
                    <td className="p-3">
                      <div className="font-medium">{week.weekLabel}</div>
                      <div className="text-sm text-gray-500">
                        {week.weekStart} to {week.weekEnd}
                      </div>
                    </td>
                    <td className="p-3">{week.totalRides}</td>
                    <td className="p-3">₱{week.totalEarnings.toFixed(2)}</td>
                    <td
                      className="p-3 font-semibold"
                      style={{ color: "#FF9800" }}
                    >
                      ₱{week.totalServiceFee.toFixed(2)}
                    </td>
                    <td className="p-3">
                      ₱{week.averageServiceFeePerRide.toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <div className="mb-2">💰</div>
                      <div className="font-medium">
                        No Weekly Income Data Available
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        Income reports will appear here once ride data is loaded
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Cards */}
        {weeklyTotalIncome.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-green-600 font-medium">
                Total Income (All Weeks)
              </div>
              <div className="text-2xl font-bold text-green-700">
                ₱
                {weeklyTotalIncome
                  .reduce((sum, week) => sum + week.totalServiceFee, 0)
                  .toFixed(2)}
              </div>
            </div>
            <div
              style={{ backgroundColor: "#FFF3E0" }}
              className="rounded-lg p-4"
            >
              <div className="text-sm font-medium" style={{ color: "#E65100" }}>
                Average Weekly Income
              </div>
              <div className="text-2xl font-bold" style={{ color: "#FF9800" }}>
                ₱
                {(
                  weeklyTotalIncome.reduce(
                    (sum, week) => sum + week.totalServiceFee,
                    0
                  ) / weeklyTotalIncome.length
                ).toFixed(2)}
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-blue-600 font-medium">
                Total Rides (All Weeks)
              </div>
              <div className="text-2xl font-bold text-blue-700">
                {weeklyTotalIncome.reduce(
                  (sum, week) => sum + week.totalRides,
                  0
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RIDE VOLUME & USAGE */}
      <div className="bg-white shadow rounded-lg p-6 space-y-6">
        <h2 className="text-lg font-semibold">Ride Volume & Usage</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-48">
            <p className="text-gray-600 mb-2 text-sm">Completed Rides</p>
            <ResponsiveContainer width="100%" height="80%">
              <LineChart data={dailyCompleted}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line dataKey="count" stroke="#FF9800" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="h-48">
            <p className="text-gray-600 mb-2 text-sm">Cancelled Rides</p>
            <ResponsiveContainer width="100%" height="80%">
              <LineChart data={dailyCancelled}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line dataKey="count" stroke="#F57C00" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* PEAK HOURS */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Peak Booking Hours</h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={peakHours}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} />
              <YAxis allowDecimals={false} />
              <Tooltip labelFormatter={(h) => `${h}:00`} />
              <Bar dataKey="count" fill="#FF9800" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* DRIVER PERFORMANCE */}
      <div className="bg-white shadow rounded-lg p-6 space-y-6">
        <h2 className="text-lg font-semibold">Driver Performance</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-48">
            <p className="text-gray-600 mb-2 text-sm">Avg Driver Rating</p>
            {ratingsData.length ? (
              <ResponsiveContainer width="100%" height="80%">
                <BarChart data={ratingsData}>
                  <XAxis dataKey="username" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 5]} allowDecimals={false} />
                  <Tooltip formatter={(v) => v.toFixed(2)} />
                  <Bar dataKey="average" fill="#FF9800" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                No rating data.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* USER GROWTH & ENGAGEMENT */}
      <div className="bg-white shadow rounded-lg p-6 space-y-6">
        <h2 className="text-lg font-semibold">User Growth & Engagement</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-48">
            <div className="w-full h-48">
              <h3 className="font-semibold text-gray-700 mb-2">User Signups</h3>
              <ResponsiveContainer width="100%" height="80%">
                <LineChart data={userSignupsData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    labelFormatter={(label) => `Date: ${label}`}
                    formatter={(value) => [`${value}`, "Count"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#FF9800"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="h-48">
            <p className="text-gray-600 mb-2 text-sm">Active Users</p>
            <ResponsiveContainer width="100%" height="80%">
              <LineChart data={activeUsersData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line dataKey="count" stroke="#FF9800" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
