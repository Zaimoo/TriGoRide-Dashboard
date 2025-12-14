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
import { format } from "date-fns";

const SOSDetails = () => {
  const { id } = useParams();
  const [alert, setAlert] = useState(null);
  const [booking, setBooking] = useState(null);
  const [driver, setDriver] = useState(null);
  const [passenger, setPassenger] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlertDetails = async () => {
      try {
        // Fetch SOS alert
        const alertRef = doc(db, "sos_alerts", id);
        const alertSnap = await getDoc(alertRef);

        if (!alertSnap.exists()) {
          setLoading(false);
          return;
        }

        const alertData = { id: alertSnap.id, ...alertSnap.data() };
        setAlert(alertData);

        // Fetch related booking if bookingId exists
        if (alertData.bookingId) {
          try {
            const bookingRef = doc(db, "bookings", alertData.bookingId);
            const bookingSnap = await getDoc(bookingRef);
            if (bookingSnap.exists()) {
              setBooking({ id: bookingSnap.id, ...bookingSnap.data() });
            }
          } catch (err) {
            console.error("Error fetching booking:", err);
          }
        }

        // Fetch driver details if driverUid exists
        if (alertData.driverUid) {
          try {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("uid", "==", alertData.driverUid));
            const driverSnap = await getDocs(q);
            if (!driverSnap.empty) {
              setDriver({
                id: driverSnap.docs[0].id,
                ...driverSnap.docs[0].data(),
              });
            }
          } catch (err) {
            console.error("Error fetching driver:", err);
          }
        }

        // Fetch passenger details if userId exists
        if (alertData.userId) {
          try {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("email", "==", alertData.userId));
            const passengerSnap = await getDocs(q);
            if (!passengerSnap.empty) {
              setPassenger({
                id: passengerSnap.docs[0].id,
                ...passengerSnap.docs[0].data(),
              });
            }
          } catch (err) {
            console.error("Error fetching passenger:", err);
          }
        }
      } catch (err) {
        console.error("Error fetching alert details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAlertDetails();
  }, [id]);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return format(date, "PPP 'at' p");
    } catch (error) {
      return "Invalid Date";
    }
  };

  const formatLocation = (location) => {
    if (!location) return "N/A";
    try {
      // Firebase GeoPoint can have latitude/longitude or _lat/_long properties
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

  if (loading) return <p className="text-center mt-10">Loading...</p>;
  if (!alert) return <p className="text-center mt-10">SOS alert not found.</p>;

  return (
    <div className="max-w-4xl mx-auto mt-8 bg-white rounded-2xl shadow-lg overflow-hidden">
      {/* Header */}
      <div
        className="p-6 text-white"
        style={{
          background: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
        }}
      >
        <div className="flex items-center gap-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <h1 className="text-3xl font-bold">SOS Emergency Alert</h1>
            <p className="mt-1 text-opacity-90">Alert ID: {alert.id}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Alert Information */}
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-red-500">
            Alert Information
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Alert ID</dt>
              <dd className="mt-1 text-lg text-gray-900 font-mono">
                {alert.id}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Timestamp</dt>
              <dd className="mt-1 text-lg text-gray-900">
                {formatTimestamp(alert.timestamp)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Booking ID</dt>
              <dd className="mt-1 text-lg text-gray-900 font-mono">
                {alert.bookingId || "N/A"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Location</dt>
              <dd className="mt-1">
                <button
                  onClick={() => openGoogleMaps(alert.location)}
                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                >
                  {formatLocation(alert.location)}
                </button>
              </dd>
            </div>
          </dl>
        </div>

        {/* User Information */}
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-red-500">
            User/Passenger Information
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Name</dt>
              <dd className="mt-1 text-lg text-gray-900">
                {alert.userName || passenger?.username || "Unknown"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">
                Contact Number
              </dt>
              <dd className="mt-1 text-lg text-gray-900">
                {passenger?.phone || "N/A"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">
                Email/User ID
              </dt>
              <dd className="mt-1 text-lg text-gray-900">
                {alert.userId || "N/A"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">
                Emergency Contact
              </dt>
              <dd className="mt-1 text-lg text-gray-900">
                {alert.emergencyContact || "N/A"}
              </dd>
            </div>
          </dl>
        </div>

        {/* Driver Information */}
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-red-500">
            Driver Information
          </h2>
          <div className="grid grid-cols-1 gap-6">
            {/* Profile Image */}
            {driver?.profileImage?.url && (
              <div className="flex justify-center sm:justify-start">
                <img
                  src={driver.profileImage.url}
                  alt={driver?.username || "Driver"}
                  className="w-32 h-32 rounded-full object-cover border-4 border-red-200 shadow-lg"
                />
              </div>
            )}

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Driver Name
                </dt>
                <dd className="mt-1 text-lg text-gray-900">
                  {driver?.username || "Unknown"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Driver UID
                </dt>
                <dd className="mt-1 text-lg text-gray-900 font-mono">
                  {alert.driverUid || "N/A"}
                </dd>
              </div>
              {driver?.phoneNumber && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Driver Phone
                  </dt>
                  <dd className="mt-1">
                    <a
                      href={`tel:${driver.phoneNumber}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-lg"
                    >
                      {driver.phoneNumber}
                    </a>
                  </dd>
                </div>
              )}
              {driver?.email && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Driver Email
                  </dt>
                  <dd className="mt-1 text-lg text-gray-900">{driver.email}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Booking Information (if available) */}
        {booking && (
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-red-500">
              Related Booking Information
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Route</dt>
                <dd className="mt-1 text-gray-900">
                  <span className="block">
                    <span className="font-medium">From:</span>{" "}
                    {booking.pickUpAddress || "N/A"}
                  </span>
                  <span className="block mt-1">
                    <span className="font-medium">To:</span>{" "}
                    {booking.dropOffAddress || "N/A"}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Booking Status
                </dt>
                <dd className="mt-1">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      booking.status?.toLowerCase() === "completed"
                        ? "bg-green-100 text-green-800"
                        : booking.status?.toLowerCase() === "cancelled"
                        ? "bg-red-100 text-red-800"
                        : booking.status?.toLowerCase() === "ongoing"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {booking.status || "Unknown"}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Booking Date
                </dt>
                <dd className="mt-1 text-gray-900">
                  {booking.dateBooked?.toDate
                    ? format(booking.dateBooked.toDate(), "PPP 'at' p")
                    : "N/A"}
                </dd>
              </div>
              {booking.priorityType && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Priority Type
                  </dt>
                  <dd className="mt-1 text-gray-900">
                    {booking.priorityType.charAt(0).toUpperCase() +
                      booking.priorityType.slice(1)}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Map Preview */}
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-red-500">
            Location Map
          </h2>
          {alert.location &&
          (alert.location.latitude ?? alert.location._lat) != null &&
          (alert.location.longitude ?? alert.location._long) != null &&
          (alert.location.latitude ?? alert.location._lat) !== 0 &&
          (alert.location.longitude ?? alert.location._long) !== 0 ? (
            <div className="bg-gray-100 rounded-lg overflow-hidden">
              <iframe
                title="SOS Alert Location"
                width="100%"
                height="400"
                frameBorder="0"
                style={{ border: 0 }}
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                  (alert.location.longitude ?? alert.location._long) - 0.01
                },${(alert.location.latitude ?? alert.location._lat) - 0.01},${
                  (alert.location.longitude ?? alert.location._long) + 0.01
                },${
                  (alert.location.latitude ?? alert.location._lat) + 0.01
                }&layer=mapnik&marker=${
                  alert.location.latitude ?? alert.location._lat
                },${alert.location.longitude ?? alert.location._long}`}
                allowFullScreen
              />
            </div>
          ) : (
            <div className="bg-gray-100 rounded-lg p-8 text-center text-gray-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-16 w-16 mx-auto mb-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
              <p className="font-medium">Location data unavailable</p>
              <p className="text-sm mt-1">Map cannot be displayed</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-4">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
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
            Back to SOS List
          </button>

          <button
            onClick={() => openGoogleMaps(alert.location)}
            className="inline-flex items-center px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Open in Google Maps
          </button>
        </div>
      </div>
    </div>
  );
};

export default SOSDetails;
