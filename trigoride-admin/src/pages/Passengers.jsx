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
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Passengers</h2>

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
