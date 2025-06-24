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

  useEffect(() => {
    (async () => {
      const q = query(
        collection(db, "users"),
        orderBy("createdAt", "desc"),
        limitTo(5)
      );
      const snap = await getDocs(q);
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    })();
  }, []);

  return (
    <ul className="space-y-4">
      {users.map((u) => (
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
  );
};

const Dashboard = () => {
  const [rides, setRides] = useState([]);
  const [loadingRides, setLoadingRides] = useState(true);

  const [activeRidesCount, setActiveRidesCount] = useState(0);
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const [activeDriversCount, setActiveDriversCount] = useState(0);
  const [totalBookingsCount, setTotalBookingsCount] = useState(0);

  const [signUpData, setSignUpData] = useState([]);
  const [bookingData, setBookingData] = useState([]);

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

    // fetch current rides
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

  return (
    <div className="space-y-6">
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
