// src/pages/Verification.jsx

import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where as whereFirestore,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";

const Verification = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingIds, setUpdatingIds] = useState([]);

  useEffect(() => {
    const fetchUnverifiedDrivers = async () => {
      try {
        const q = query(
          collection(db, "users"),
          whereFirestore("userType", "==", "Driver"),
          whereFirestore("verified", "==", false)
        );
        const snap = await getDocs(q);
        setDrivers(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Error fetching drivers:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUnverifiedDrivers();
  }, []);

  const handleVerify = async (userId) => {
    setUpdatingIds((ids) => [...ids, userId]);
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { verified: true });
      setDrivers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      console.error("Error verifying user:", err);
    } finally {
      setUpdatingIds((ids) => ids.filter((id) => id !== userId));
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-primary">
            Driver Verification
          </h1>
          <p className="text-gray-600">
            Review and verify pending driver accounts below.
          </p>
        </div>
      </div>

      {/* Card Container */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading drivers…</div>
        ) : drivers.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No unverified drivers found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-primary-light">
                <tr>
                  {["Username", "Email", "Phone", "Plate Number", "Action"].map(
                    (th) => (
                      <th
                        key={th}
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider"
                      >
                        {th}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {drivers.map((u) => {
                  const isUpdating = updatingIds.includes(u.id);
                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-gray-50 transition-colors duration-150"
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <button
                          onClick={() => handleVerify(u.id)}
                          disabled={isUpdating}
                          className={`
                            flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md
                            focus:outline-none focus:ring-2 focus:ring-offset-2
                            ${
                              isUpdating
                                ? "bg-gray-300 text-gray-700 cursor-not-allowed"
                                : "bg-primary-orange text-white hover:bg-primary-orange-dark focus:ring-orange-500"
                            }
                          `}
                        >
                          {isUpdating ? "Verifying…" : "Verify"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Verification;
