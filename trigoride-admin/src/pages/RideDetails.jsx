import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";

const RideDetails = () => {
  const { id } = useParams();
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRide = async () => {
      try {
        const rideRef = doc(db, "bookings", id);
        const rideSnap = await getDoc(rideRef);
        if (!rideSnap.exists()) {
          setLoading(false);
          return;
        }
        const data = { id: rideSnap.id, ...rideSnap.data() };

        // Lookup assigned rider's username
        let assignedRiderName = "Unassigned";
        if (data.assignedRider) {
          const usersRef = collection(db, "users");
          const q = query(usersRef, where("uid", "==", data.assignedRider));
          const userSnap = await getDocs(q);
          if (!userSnap.empty) {
            assignedRiderName = userSnap.docs[0].data().username;
          }
        }

        setRide({ ...data, assignedRiderName });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchRide();
  }, [id]);

  if (loading) return <p className="text-center mt-10">Loading...</p>;
  if (!ride) return <p className="text-center mt-10">Ride not found.</p>;

  // Format date
  const bookedAt = ride.dateBooked?.toDate
    ? ride.dateBooked
        .toDate()
        .toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : ride.dateBooked;

  // Status badge
  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800",
    ongoing: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };
  const badgeClass =
    statusColors[ride.status?.toLowerCase()] || "bg-gray-100 text-gray-800";

  return (
    <div className="max-w-2xl mx-auto mt-8 bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className="p-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
        <h1 className="text-3xl font-bold">Ride Details</h1>
        <p className="mt-1 text-opacity-80">Booking ID: {ride.id}</p>
      </div>
      <div className="p-6 space-y-6">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          {/* Passenger */}
          <div>
            <dt className="text-sm font-medium text-gray-500">Passenger</dt>
            <dd className="mt-1 text-lg text-gray-900">{ride.passenger}</dd>
          </div>
          {/* Status */}
          <div>
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1">
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold ${badgeClass}`}
              >
                {ride.status}
              </span>
            </dd>
          </div>
          {/* Date Booked */}
          <div>
            <dt className="text-sm font-medium text-gray-500">Date Booked</dt>
            <dd className="mt-1 text-gray-900">{bookedAt || "—"}</dd>
          </div>
          {/* Fare */}
          <div>
            <dt className="text-sm font-medium text-gray-500">Fare</dt>
            <dd className="mt-1 text-gray-900">
              {ride.fare != null
                ? ride.fare.toLocaleString(undefined, {
                    style: "currency",
                    currency: "USD",
                  })
                : "—"}
            </dd>
          </div>
          {/* Pickup Address */}
          <div className="sm:col-span-2">
            <dt className="text-sm font-medium text-gray-500">
              Pickup Address
            </dt>
            <dd className="mt-1 text-gray-900">{ride.pickUpAddress || "—"}</dd>
          </div>
          {/* Dropoff Address */}
          <div className="sm:col-span-2">
            <dt className="text-sm font-medium text-gray-500">
              Dropoff Address
            </dt>
            <dd className="mt-1 text-gray-900">{ride.dropOffAddress || "—"}</dd>
          </div>
          {/* Assigned Rider */}
          <div className="sm:col-span-2">
            <dt className="text-sm font-medium text-gray-500">
              Assigned Rider
            </dt>
            <dd className="mt-1 text-gray-900">{ride.assignedRiderName}</dd>
          </div>
        </dl>

        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back
        </button>
      </div>
    </div>
  );
};

export default RideDetails;
