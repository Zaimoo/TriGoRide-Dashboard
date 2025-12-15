import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { format } from "date-fns";

const VerificationDetails = () => {
  const { id } = useParams();
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const fetchDriverDetails = async () => {
      try {
        const driverRef = doc(db, "users", id);
        const driverSnap = await getDoc(driverRef);

        if (!driverSnap.exists()) {
          setLoading(false);
          return;
        }

        const driverData = { id: driverSnap.id, ...driverSnap.data() };
        setDriver(driverData);
      } catch (err) {
        console.error("Error fetching driver details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDriverDetails();
  }, [id]);

  const handleVerify = async () => {
    setUpdating(true);
    try {
      const userRef = doc(db, "users", id);
      await updateDoc(userRef, { verified: true });
      setDriver((prev) => ({ ...prev, verified: true }));
      alert("Driver verified successfully!");
      window.history.back();
    } catch (err) {
      console.error("Error verifying driver:", err);
      alert("Failed to verify driver. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const handleReject = async () => {
    if (!confirm("Are you sure you want to reject this driver?")) return;

    setUpdating(true);
    try {
      const userRef = doc(db, "users", id);
      await updateDoc(userRef, { verified: false, rejected: true });
      alert("Driver rejected.");
      window.history.back();
    } catch (err) {
      console.error("Error rejecting driver:", err);
      alert("Failed to reject driver. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return format(date, "PPP 'at' p");
    } catch (error) {
      return "Invalid Date";
    }
  };

  if (loading) return <p className="text-center mt-10">Loading...</p>;
  if (!driver) return <p className="text-center mt-10">Driver not found.</p>;

  return (
    <div className="max-w-4xl mx-auto mt-8 bg-white rounded-2xl shadow-lg overflow-hidden">
      {/* Header */}
      <div
        className="p-6 text-white"
        style={{
          background: "linear-gradient(135deg, #FF9800 0%, #F57C00 100%)",
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
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h1 className="text-3xl font-bold">Driver Verification</h1>
            <p className="mt-1 text-opacity-90">Driver ID: {driver.id}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Profile Photo */}
        {driver.profileImage?.url && (
          <div className="flex justify-center">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Profile Photo
              </h3>
              <img
                src={driver.profileImage.url}
                alt={driver.username || "Driver"}
                className="w-48 h-48 rounded-full object-cover border-4 border-orange-200 shadow-lg mx-auto"
              />
            </div>
          </div>
        )}

        {/* Personal Information */}
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-orange-500">
            Personal Information
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Username</dt>
              <dd className="mt-1 text-lg text-gray-900">
                {driver.username || "N/A"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="mt-1 text-lg text-gray-900">
                {driver.email || "N/A"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">
                Phone Number
              </dt>
              <dd className="mt-1 text-lg text-gray-900">
                {driver.phone || driver.phoneNumber || "N/A"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">User Type</dt>
              <dd className="mt-1 text-lg text-gray-900">
                {driver.userType || "N/A"}
              </dd>
            </div>
            {driver.dateJoined && (
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Date Joined
                </dt>
                <dd className="mt-1 text-lg text-gray-900">
                  {formatTimestamp(driver.dateJoined)}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-sm font-medium text-gray-500">
                Verification Status
              </dt>
              <dd className="mt-1">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    driver.verified
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {driver.verified ? "Verified" : "Pending"}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        {/* Vehicle Information */}
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-orange-500">
            Vehicle Information
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">
                Plate Number
              </dt>
              <dd className="mt-1 text-lg text-gray-900 font-mono font-semibold">
                {driver.plateNumber || "N/A"}
              </dd>
            </div>
            {driver.vehicleModel && (
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Vehicle Model
                </dt>
                <dd className="mt-1 text-lg text-gray-900">
                  {driver.vehicleModel}
                </dd>
              </div>
            )}
            {driver.vehicleColor && (
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Vehicle Color
                </dt>
                <dd className="mt-1 text-lg text-gray-900">
                  {driver.vehicleColor}
                </dd>
              </div>
            )}
            {driver.vehicleYear && (
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Vehicle Year
                </dt>
                <dd className="mt-1 text-lg text-gray-900">
                  {driver.vehicleYear}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* License Photo */}
        {driver.licenseImage?.url && (
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-orange-500">
              Driver's License Photo
            </h2>
            <div className="max-w-2xl mx-auto">
              <div className="border-2 border-gray-200 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                <a
                  href={driver.licenseImage.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src={driver.licenseImage.url}
                    alt="Driver's License"
                    className="w-full h-96 object-contain bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                  />
                </a>
              </div>
              <p className="text-sm text-gray-500 mt-3 text-center">
                Click on image to view in full size
              </p>
            </div>
          </div>
        )}

        {/* Additional Information */}
        {driver.uid && (
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-orange-500">
              Additional Information
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">User UID</dt>
                <dd className="mt-1 text-lg text-gray-900 font-mono">
                  {driver.uid}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-4 border-t">
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
            Back to Verification List
          </button>

          {!driver.verified && (
            <>
              <button
                onClick={handleVerify}
                disabled={updating}
                className={`inline-flex items-center px-6 py-3 rounded-lg transition font-medium ${
                  updating
                    ? "bg-gray-400 text-white cursor-not-allowed"
                    : "bg-green-500 text-white hover:bg-green-600"
                }`}
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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {updating ? "Verifying..." : "Verify Driver"}
              </button>

              <button
                onClick={handleReject}
                disabled={updating}
                className={`inline-flex items-center px-6 py-3 rounded-lg transition font-medium ${
                  updating
                    ? "bg-gray-400 text-white cursor-not-allowed"
                    : "bg-red-500 text-white hover:bg-red-600"
                }`}
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
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {updating ? "Rejecting..." : "Reject Driver"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerificationDetails;
