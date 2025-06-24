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
import { format, subDays, startOfDay, getHours } from "date-fns";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../firebase";

const DAYS = 7;

const Reports = () => {
  const [dailyCompleted, setDailyCompleted] = useState([]);
  const [dailyCancelled, setDailyCancelled] = useState([]);
  const [peakHours, setPeakHours] = useState([]);
  const [acceptanceRate, setAcceptanceRate] = useState(0);
  const [ratingsData, setRatingsData] = useState([]);
  const [userSignupsData, setUserSignupsData] = useState([]);
  const [activeUsersData, setActiveUsersData] = useState([]);
  const DAYS_TO_SHOW = 7;

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
                <Line dataKey="count" stroke="#4F46E5" />
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
                <Line dataKey="count" stroke="#DC2626" />
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
              <Bar dataKey="count" fill="#2563EB" />
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
                  <Bar dataKey="average" fill="#D97706" />
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
                    stroke="#4F46E5"
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
                <Line dataKey="count" stroke="#10B981" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
