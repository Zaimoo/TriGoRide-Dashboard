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
  startOfMonth,
  endOfMonth,
  parseISO,
  isSameMonth,
  isSameWeek,
  isWithinInterval,
} from "date-fns";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

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
  const [allTimeDriverServiceFees, setAllTimeDriverServiceFees] = useState([]); // All-time data
  const [weeklyDriverReports, setWeeklyDriverReports] = useState([]);
  const [weeklyTotalIncome, setWeeklyTotalIncome] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(0);

  // Date range state for filtering all data
  const [dateRange, setDateRange] = useState([
    subDays(new Date(), 6), // Default to last 7 days
    new Date(),
  ]);
  const [allBookingsData, setAllBookingsData] = useState([]);
  const [allRatingsData, setAllRatingsData] = useState([]);
  const [allUsersData, setAllUsersData] = useState([]);

  const DAYS_TO_SHOW = 7;

  // Calculate days in selected range
  const getDaysInRange = () => {
    if (!dateRange || !dateRange[0] || !dateRange[1]) return 7;
    return Math.ceil((dateRange[1] - dateRange[0]) / (1000 * 60 * 60 * 24)) + 1;
  };

  // Get period label
  const getPeriodLabel = () => {
    const days = getDaysInRange();
    if (days === 1) return "Today";
    if (days === 7) return "Last 7 Days";
    if (days === 30 || days === 31) return "Last 30 Days";
    return `${days} Days`;
  };

  // Helper function to filter data by date range
  const filterByDateRange = (data, dateField) => {
    if (!dateRange || dateRange.length !== 2) return data;
    const [start, end] = dateRange;
    const startDate = startOfDay(start);
    const endDate = startOfDay(new Date(end.getTime() + 86400000)); // Add 1 day to include end date

    return data.filter((item) => {
      const itemDate = item[dateField];
      if (!itemDate) return false;
      const date = itemDate instanceof Date ? itemDate : itemDate.toDate();
      return date >= startDate && date < endDate;
    });
  };

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

  // Load all data on mount
  useEffect(() => {
    (async () => {
      try {
        // Load all bookings
        const allBookingsSnap = await getDocs(
          query(collection(db, "bookings"), orderBy("dateBooked", "desc"))
        );
        const bookings = allBookingsSnap.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
          dateBooked: doc.data().dateBooked?.toDate() || new Date(),
        }));
        setAllBookingsData(bookings);

        // Calculate ALL-TIME driver service fees (not affected by date range)
        const allTimeDriverMap = {};
        const driversSnap = await getDocs(
          query(
            collection(db, "users"),
            where("userType", "in", ["Driver", "driver"])
          )
        );

        driversSnap.docs.forEach((doc) => {
          const driver = doc.data();
          const driverKey = driver.uid || doc.id;
          allTimeDriverMap[driverKey] = {
            id: driverKey,
            name: driver.username || driver.displayName || "Unknown Driver",
            email: driver.email || "",
            totalEarnings: 0,
            totalRides: 0,
            serviceFeeOwed: 0,
          };
        });

        // Calculate all-time earnings from ALL completed bookings
        const allCompletedBookings = bookings.filter(
          (b) => b.status === "Completed"
        );
        allCompletedBookings.forEach((booking) => {
          const driverId = booking.assignedRider || booking.driverId;
          const fare = parseFloat(booking.fare || booking.price || 0);

          if (driverId && fare > 0) {
            if (!allTimeDriverMap[driverId]) {
              allTimeDriverMap[driverId] = {
                id: driverId,
                name: "Unknown Driver",
                email: "",
                totalEarnings: 0,
                totalRides: 0,
                serviceFeeOwed: 0,
              };
            }
            allTimeDriverMap[driverId].totalEarnings += fare;
            allTimeDriverMap[driverId].totalRides += 1;
            allTimeDriverMap[driverId].serviceFeeOwed +=
              fare * SERVICE_FEE_PERCENTAGE;
          }
        });

        setAllTimeDriverServiceFees(
          Object.values(allTimeDriverMap).filter((d) => d.totalRides > 0)
        );

        // Load all ratings
        const ratingsSnap = await getDocs(collection(db, "ratings"));
        setAllRatingsData(
          ratingsSnap.docs.map((doc) => ({ ...doc.data(), id: doc.id }))
        );

        // Load all users
        const usersSnap = await getDocs(collection(db, "users"));
        setAllUsersData(
          usersSnap.docs.map((doc) => ({ ...doc.data(), id: doc.id }))
        );
      } catch (error) {
        console.error("Error loading data:", error);
      }
    })();
  }, []);

  // Filter and process data when date range changes
  useEffect(() => {
    if (!allBookingsData.length) return;

    (async () => {
      const today = startOfDay(new Date());
      const [startDate, endDate] = dateRange;

      // Filter bookings by date range
      const filteredBookings = filterByDateRange(allBookingsData, "dateBooked");
      const completedBookings = filteredBookings.filter(
        (b) => b.status === "Completed"
      );

      // Calculate daily metrics
      const dailyBuckets = {};
      const daysDiff =
        Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

      for (let i = 0; i < daysDiff; i++) {
        const day = format(subDays(endDate, i), "yyyy-MM-dd");
        dailyBuckets[day] = { completed: 0, cancelled: 0 };
      }

      const hourBuckets = Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        count: 0,
      }));

      filteredBookings.forEach((booking) => {
        const ts = booking.dateBooked;
        const key = format(ts, "yyyy-MM-dd");
        const st = (booking.status || "").toLowerCase();

        if (dailyBuckets[key]) {
          if (st === "completed") dailyBuckets[key].completed++;
          if (st === "cancelled") dailyBuckets[key].cancelled++;
        }
        hourBuckets[getHours(ts)].count++;
      });

      const comp = [],
        canc = [];
      for (let i = daysDiff - 1; i >= 0; i--) {
        const date = format(subDays(endDate, i), "yyyy-MM-dd");
        comp.push({ date, count: dailyBuckets[date]?.completed || 0 });
        canc.push({ date, count: dailyBuckets[date]?.cancelled || 0 });
      }

      setDailyCompleted(comp);
      setDailyCancelled(canc);
      setPeakHours(hourBuckets);

      const totalComp = comp.reduce((sum, d) => sum + d.count, 0);
      const totalAll = totalComp + canc.reduce((sum, d) => sum + d.count, 0);
      setAcceptanceRate(
        totalAll ? Math.round((totalComp / totalAll) * 100) : 0
      );

      // Calculate driver service fees
      const driverMap = {};
      const driversSnap = await getDocs(
        query(
          collection(db, "users"),
          where("userType", "in", ["Driver", "driver"])
        )
      );

      driversSnap.docs.forEach((doc) => {
        const driver = doc.data();
        const driverKey = driver.uid || doc.id;
        driverMap[driverKey] = {
          id: driverKey,
          name: driver.username || driver.displayName || "Unknown Driver",
          email: driver.email || "",
          totalEarnings: 0,
          totalRides: 0,
          serviceFeeOwed: 0,
        };
      });

      completedBookings.forEach((booking) => {
        const driverId = booking.assignedRider || booking.driverId;
        const fare = parseFloat(booking.fare || booking.price || 0);

        if (driverId && fare > 0) {
          if (!driverMap[driverId]) {
            driverMap[driverId] = {
              id: driverId,
              name: "Unknown Driver",
              email: "",
              totalEarnings: 0,
              totalRides: 0,
              serviceFeeOwed: 0,
            };
          }
          driverMap[driverId].totalEarnings += fare;
          driverMap[driverId].totalRides += 1;
          driverMap[driverId].serviceFeeOwed += fare * SERVICE_FEE_PERCENTAGE;
        }
      });

      setDriverServiceFees(
        Object.values(driverMap).filter((d) => d.totalRides > 0)
      );

      // Calculate ratings
      const byDriver = {};
      allRatingsData.forEach((rating) => {
        const { driverId, rating: ratingValue } = rating;
        if (!driverId || typeof ratingValue !== "number") return;
        if (!byDriver[driverId]) byDriver[driverId] = { sum: 0, count: 0 };
        byDriver[driverId].sum += ratingValue;
        byDriver[driverId].count += 1;
      });

      const nameMap = {};
      allUsersData.forEach((user) => {
        if (user.uid) nameMap[user.uid] = user.username || user.displayName;
      });

      setRatingsData(
        Object.entries(byDriver).map(([id, { sum, count }]) => ({
          username: nameMap[id] || id,
          average: parseFloat((sum / count).toFixed(2)),
        }))
      );

      // User signups - filter users by date range
      const filteredUsers = filterByDateRange(
        allUsersData.filter((u) => u.userType === "Passenger" && u.createdAt),
        "createdAt"
      );

      const signupBuckets = {};
      for (let i = 0; i < daysDiff; i++) {
        const day = format(subDays(endDate, i), "yyyy-MM-dd");
        signupBuckets[day] = 0;
      }

      filteredUsers.forEach((user) => {
        const date = user.createdAt?.toDate?.() || user.createdAt;
        if (date) {
          const key = format(date, "yyyy-MM-dd");
          if (signupBuckets[key] != null) signupBuckets[key]++;
        }
      });

      const signups = Object.entries(signupBuckets)
        .sort(([a], [b]) => new Date(a) - new Date(b))
        .map(([date, count]) => ({ date, count }));

      setUserSignupsData(signups);
      setActiveUsersData(comp); // Use completed rides as proxy for active users

      // Weekly reports for the selected range
      const periodLabel = `${format(startDate, "MMM dd")} - ${format(
        endDate,
        "MMM dd, yyyy"
      )}`;
      const driverReports = {};

      completedBookings.forEach((booking) => {
        const driverId = booking.assignedRider || booking.driverId;
        const fare = parseFloat(booking.fare || booking.price || 0);

        if (driverId && fare > 0) {
          if (!driverReports[driverId]) {
            driverReports[driverId] = {
              driverId,
              driverName: driverMap[driverId]?.name || "Unknown Driver",
              driverEmail: driverMap[driverId]?.email || "",
              totalEarnings: 0,
              totalRides: 0,
              serviceFeeOwed: 0,
            };
          }
          driverReports[driverId].totalEarnings += fare;
          driverReports[driverId].totalRides += 1;
          driverReports[driverId].serviceFeeOwed +=
            fare * SERVICE_FEE_PERCENTAGE;
        }
      });

      setWeeklyDriverReports([
        {
          weekLabel: periodLabel,
          drivers: Object.values(driverReports),
        },
      ]);

      // Total income
      const totalEarnings = completedBookings.reduce(
        (sum, b) => sum + parseFloat(b.fare || b.price || 0),
        0
      );
      const totalServiceFee = totalEarnings * SERVICE_FEE_PERCENTAGE;

      setWeeklyTotalIncome([
        {
          weekLabel: periodLabel,
          weekStart: format(startDate, "yyyy-MM-dd"),
          weekEnd: format(endDate, "yyyy-MM-dd"),
          totalRides: completedBookings.length,
          totalEarnings,
          totalServiceFee,
          averageServiceFeePerRide:
            completedBookings.length > 0
              ? totalServiceFee / completedBookings.length
              : 0,
        },
      ]);
    })();
  }, [dateRange, allBookingsData, allRatingsData, allUsersData]);

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
      {/* DATE RANGE PICKER */}
      <div className="bg-gradient-to-br from-orange-50 to-white shadow-xl rounded-xl p-6 border border-orange-100">
        <div className="flex flex-col space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2
                className="text-2xl font-bold mb-1"
                style={{ color: "#FF9800" }}
              >
                📊 Filter Reports by Date Range
              </h2>
              <p className="text-sm text-gray-600">
                Select a custom date range to view specific period analytics
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() =>
                  setDateRange([subDays(new Date(), 6), new Date()])
                }
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  getDaysInRange() === 7
                    ? "bg-orange-500 text-white shadow-md transform scale-105"
                    : "bg-white text-gray-700 hover:bg-orange-50 border border-gray-200"
                }`}
              >
                📅 Last 7 Days
              </button>
              <button
                onClick={() =>
                  setDateRange([subDays(new Date(), 29), new Date()])
                }
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  getDaysInRange() === 30
                    ? "bg-orange-500 text-white shadow-md transform scale-105"
                    : "bg-white text-gray-700 hover:bg-orange-50 border border-gray-200"
                }`}
              >
                📆 Last 30 Days
              </button>
              <button
                onClick={() =>
                  setDateRange([startOfMonth(new Date()), new Date()])
                }
                className="px-4 py-2 text-sm font-medium bg-white text-gray-700 hover:bg-orange-50 border border-gray-200 rounded-lg transition-all duration-200"
              >
                🗓️ This Month
              </button>
              <button
                onClick={() =>
                  setDateRange([
                    startOfMonth(subDays(new Date(), 30)),
                    endOfMonth(subDays(new Date(), 30)),
                  ])
                }
                className="px-4 py-2 text-sm font-medium bg-white text-gray-700 hover:bg-orange-50 border border-gray-200 rounded-lg transition-all duration-200"
              >
                ⏮️ Last Month
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row items-center justify-center gap-6">
            <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
              <Calendar
                onChange={setDateRange}
                value={dateRange}
                selectRange={true}
                className="border-0 rounded-lg"
                tileClassName={({ date }) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  date.setHours(0, 0, 0, 0);

                  if (date.getTime() === today.getTime()) {
                    return "bg-blue-100 font-bold";
                  }
                  return "hover:bg-orange-50";
                }}
              />
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border border-orange-100 min-w-[280px]">
              <div className="text-center space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Selected Range
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <span
                        className="text-lg font-bold"
                        style={{ color: "#FF9800" }}
                      >
                        📅{" "}
                        {dateRange && dateRange[0]
                          ? format(dateRange[0], "MMM dd, yyyy")
                          : "Start"}
                      </span>
                    </div>
                    <div className="flex items-center justify-center">
                      <span className="text-gray-400">→</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <span
                        className="text-lg font-bold"
                        style={{ color: "#FF9800" }}
                      >
                        📅{" "}
                        {dateRange && dateRange[1]
                          ? format(dateRange[1], "MMM dd, yyyy")
                          : "End"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-3">
                    <p className="text-sm text-gray-600 mb-1">Total Duration</p>
                    <p
                      className="text-3xl font-bold"
                      style={{ color: "#FF9800" }}
                    >
                      {getDaysInRange()}
                    </p>
                    <p className="text-sm text-gray-600">
                      {getDaysInRange() === 1 ? "Day" : "Days"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-50 to-white shadow-lg rounded-xl p-6 border-l-4 border-green-500 hover:shadow-xl transition-shadow duration-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
              Completed Rides
            </p>
            <span className="text-2xl">✅</span>
          </div>
          <p className="text-4xl font-bold text-green-600 mb-1">
            {dailyCompleted.reduce((s, d) => s + d.count, 0)}
          </p>
          <p className="text-xs text-gray-500">{getPeriodLabel()}</p>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-white shadow-lg rounded-xl p-6 border-l-4 border-red-500 hover:shadow-xl transition-shadow duration-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
              Cancellations
            </p>
            <span className="text-2xl">❌</span>
          </div>
          <p className="text-4xl font-bold text-red-600 mb-1">
            {dailyCancelled.reduce((s, d) => s + d.count, 0)}
          </p>
          <p className="text-xs text-gray-500">{getPeriodLabel()}</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-white shadow-lg rounded-xl p-6 border-l-4 border-blue-500 hover:shadow-xl transition-shadow duration-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
              Success Rate
            </p>
            <span className="text-2xl">📈</span>
          </div>
          <p className="text-4xl font-bold text-blue-600 mb-1">
            {acceptanceRate}%
          </p>
          <p className="text-xs text-gray-500">{getPeriodLabel()}</p>
        </div>
      </div>

      {/* DRIVER SERVICE FEES SECTION */}
      <div className="bg-white shadow-xl rounded-xl p-6 border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">💰</span>
          <div>
            <h2 className="text-xl font-bold" style={{ color: "#FF9800" }}>
              Driver Service Fees Overview
            </h2>
            <p className="text-sm text-gray-500">
              All-time earnings and fees across all drivers
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Driver Name
                </th>
                <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Rides Completed
                </th>
                <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Total Earnings
                </th>
                <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Service Fee Owed (10%)
                </th>
                <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Net Earnings
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {allTimeDriverServiceFees.length > 0 ? (
                allTimeDriverServiceFees.map((driver, index) => (
                  <tr
                    key={driver.id}
                    className="hover:bg-orange-50 transition-colors"
                  >
                    <td className="p-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">
                        {driver.name}
                      </div>
                      {driver.email && (
                        <div className="text-sm text-gray-500">
                          {driver.email}
                        </div>
                      )}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {driver.totalRides} rides
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      ₱{driver.totalEarnings.toFixed(2)}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span
                        className="text-sm font-bold"
                        style={{ color: "#FF9800" }}
                      >
                        ₱{driver.serviceFeeOwed.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap text-sm font-semibold text-green-600">
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

      {/* DRIVER REPORTS SECTION */}
      <div className="bg-white shadow-xl rounded-xl p-6 border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">👨‍✈️</span>
            <div>
              <h2 className="text-xl font-bold" style={{ color: "#FF9800" }}>
                Driver Income Reports
              </h2>
              <p className="text-sm text-gray-500">
                {getPeriodLabel()} - Individual driver performance
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {weeklyDriverReports.length > 0 &&
              weeklyDriverReports[0].drivers.length > 0 && (
                <button
                  onClick={() => downloadWeeklyReport(weeklyDriverReports[0])}
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
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Driver Name
                </th>
                <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Rides Completed
                </th>
                <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Total Earnings
                </th>
                <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Service Fee Owed (10%)
                </th>
                <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Net Earnings
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {weeklyDriverReports.length > 0 &&
              weeklyDriverReports[0].drivers.length > 0 ? (
                weeklyDriverReports[0].drivers.map((driver, index) => (
                  <tr
                    key={driver.driverId}
                    className="hover:bg-orange-50 transition-colors"
                  >
                    <td className="p-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">
                        {driver.driverName}
                      </div>
                      {driver.driverEmail && (
                        <div className="text-sm text-gray-500">
                          {driver.driverEmail}
                        </div>
                      )}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {driver.totalRides} rides
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      ₱{driver.totalEarnings.toFixed(2)}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span
                        className="text-sm font-bold"
                        style={{ color: "#FF9800" }}
                      >
                        ₱{driver.serviceFeeOwed.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap text-sm font-semibold text-green-600">
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

      {/* TOTAL INCOME SECTION */}
      <div className="bg-white shadow-xl rounded-xl p-6 border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">💵</span>
            <div>
              <h2 className="text-xl font-bold" style={{ color: "#FF9800" }}>
                Platform Income from Service Fees
              </h2>
              <p className="text-sm text-gray-500">
                {getPeriodLabel()} - Total platform revenue
              </p>
            </div>
          </div>
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
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Period
                </th>
                <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Total Rides
                </th>
                <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Total Earnings
                </th>
                <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Service Fee Income (10%)
                </th>
                <th className="p-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Avg. Service Fee per Ride
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {weeklyTotalIncome.length > 0 ? (
                weeklyTotalIncome.map((week, index) => (
                  <tr
                    key={week.weekOffset || index}
                    className="hover:bg-orange-50 transition-colors"
                  >
                    <td className="p-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">
                        {week.weekLabel}
                      </div>
                      <div className="text-sm text-gray-500">
                        {week.weekStart} to {week.weekEnd}
                      </div>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {week.totalRides} rides
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      ₱{week.totalEarnings.toFixed(2)}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span
                        className="text-sm font-bold"
                        style={{ color: "#FF9800" }}
                      >
                        ₱{week.totalServiceFee.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap text-sm font-semibold text-green-600">
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
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 border-l-4 border-green-500 shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-green-700 font-semibold uppercase tracking-wide">
                  Total Income
                </div>
                <span className="text-2xl">💰</span>
              </div>
              <div className="text-3xl font-bold text-green-700">
                ₱
                {weeklyTotalIncome
                  .reduce((sum, week) => sum + week.totalServiceFee, 0)
                  .toFixed(2)}
              </div>
              <p className="text-xs text-green-600 mt-1">{getPeriodLabel()}</p>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-5 border-l-4 border-orange-500 shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-orange-700 font-semibold uppercase tracking-wide">
                  Average per Ride
                </div>
                <span className="text-2xl">📊</span>
              </div>
              <div className="text-3xl font-bold text-orange-700">
                ₱
                {(
                  weeklyTotalIncome.reduce(
                    (sum, week) => sum + week.totalServiceFee,
                    0
                  ) /
                    weeklyTotalIncome.reduce(
                      (sum, week) => sum + week.totalRides,
                      0
                    ) || 0
                ).toFixed(2)}
              </div>
              <p className="text-xs text-orange-600 mt-1">Per completed ride</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border-l-4 border-blue-500 shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-blue-700 font-semibold uppercase tracking-wide">
                  Total Rides
                </div>
                <span className="text-2xl">🚗</span>
              </div>
              <div className="text-3xl font-bold text-blue-700">
                {weeklyTotalIncome.reduce(
                  (sum, week) => sum + week.totalRides,
                  0
                )}
              </div>
              <p className="text-xs text-blue-600 mt-1">{getPeriodLabel()}</p>
            </div>
          </div>
        )}
      </div>

      {/* RIDE VOLUME & USAGE */}
      <div className="bg-white shadow-xl rounded-xl p-6 space-y-6 border border-gray-100">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🚗</span>
          <div>
            <h2 className="text-xl font-bold">Ride Volume & Usage</h2>
            <p className="text-sm text-gray-500">
              {getPeriodLabel()} - Daily ride trends
            </p>
          </div>
        </div>
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
      <div className="bg-white shadow-xl rounded-xl p-6 border border-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">⏰</span>
          <div>
            <h2 className="text-xl font-bold">Peak Booking Hours</h2>
            <p className="text-sm text-gray-500">
              {getPeriodLabel()} - Hourly distribution
            </p>
          </div>
        </div>
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
      <div className="bg-white shadow-xl rounded-xl p-6 space-y-6 border border-gray-100">
        <div className="flex items-center gap-3">
          <span className="text-3xl">⭐</span>
          <div>
            <h2 className="text-xl font-bold">Driver Performance</h2>
            <p className="text-sm text-gray-500">
              Average ratings and performance metrics
            </p>
          </div>
        </div>
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
      <div className="bg-white shadow-xl rounded-xl p-6 space-y-6 border border-gray-100">
        <div className="flex items-center gap-3">
          <span className="text-3xl">👥</span>
          <div>
            <h2 className="text-xl font-bold">User Growth & Engagement</h2>
            <p className="text-sm text-gray-500">
              {getPeriodLabel()} - User activity trends
            </p>
          </div>
        </div>
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
