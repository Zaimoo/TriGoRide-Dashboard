import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";

const ActiveRides = () => {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);

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
      } catch (err) {
        console.error("Error fetching rides:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRides();
  }, []);

  if (loading)
    return <p className="text-center mt-10">Loading Active Rides...</p>;
  if (!rides.length)
    return <p className="text-center mt-10">No active rides found.</p>;

  const statusClasses = {
    pending: "bg-yellow-100 text-yellow-800",
    ongoing: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Active Rides</h2>
      <div className="overflow-x-auto">
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
      </div>
    </div>
  );
};

export default ActiveRides;
