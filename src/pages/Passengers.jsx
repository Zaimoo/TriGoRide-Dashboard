// src/pages/Passengers.jsx
import React, { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { format } from "date-fns";
import { db } from "../firebase";

const PAGE_SIZE = 10;

const Passengers = () => {
  const [passengers, setPassengers] = useState([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchPassengers = async () => {
      const q = query(
        collection(db, "users"),
        where("userType", "==", "Passenger")
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPassengers(list);
    };
    fetchPassengers();
  }, []);

  const pageCount = Math.ceil(passengers.length / PAGE_SIZE);
  const start = (page - 1) * PAGE_SIZE;
  const currentPage = passengers.slice(start, start + PAGE_SIZE);

  return (
    <div className="p-6">
      {/* Stat Card for Total Active Passengers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 flex items-center">
          <div className="flex-shrink-0 bg-orange-100 rounded-full p-3 mr-4">
            <svg
              className="h-6 w-6 text-orange-500"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6 5.87v-2a4 4 0 00-3-3.87m6 5.87a4 4 0 01-3-3.87m0 0a4 4 0 013-3.87m0 0V4a4 4 0 00-8 0v8a4 4 0 003 3.87"
              />
            </svg>
          </div>
          <div>
            <div className="text-sm text-gray-500">Total Active Passengers</div>
            <div className="text-2xl font-bold text-gray-900">
              {passengers.length}
            </div>
          </div>
        </div>
      </div>
      <h2 className="text-xl font-semibold mb-4" style={{ color: "#FF9800" }}>
        Passengers
      </h2>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["ID", "Name", "Email", "Phone", "Joined"].map((th) => (
                <th
                  key={th}
                  className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider"
                >
                  {th}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {currentPage.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 truncate">{u.id}</td>
                <td className="px-6 py-4">
                  {u.username || u.displayName || "-"}
                </td>
                <td className="px-6 py-4 truncate">{u.email || "-"}</td>
                <td className="px-6 py-4 truncate">{u.phone || "-"}</td>
                <td className="px-6 py-4">
                  {u.createdAt?.toDate
                    ? format(u.createdAt.toDate(), "yyyy-MM-dd")
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-4">
        <button
          onClick={() => setPage((p) => Math.max(p - 1, 1))}
          disabled={page === 1}
          className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-gray-600">
          Page {page} of {pageCount}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(p + 1, pageCount))}
          disabled={page === pageCount}
          className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default Passengers;
