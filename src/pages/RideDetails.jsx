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
import jsPDF from "jspdf";

const RideDetails = () => {
  const { id } = useParams();
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [distanceKm, setDistanceKm] = useState(null);
  // Haversine formula to calculate distance between two lat/lng points
  function haversineDistance(lat1, lon1, lat2, lon2) {
    const toRad = (x) => (x * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Geocode an address using OpenStreetMap Nominatim
  async function geocodeAddress(address) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      address
    )}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
      };
    }
    return null;
  }

  // Function to generate and download PDF receipt
  const downloadReceipt = () => {
    if (!ride || ride.status?.toLowerCase() !== "completed") return;

    const serviceFeeRate = 0.1; // 10% service fee
    const subtotal = parseFloat(ride.fare || 0);
    const serviceFee = subtotal * serviceFeeRate;
    const total = subtotal;
    const driverEarnings = subtotal - serviceFee;
    const currentDate = new Date();

    // Create new PDF document
    const doc = new jsPDF();

    // Set font
    doc.setFont("helvetica");

    // Header
    doc.setFontSize(20);
    doc.setTextColor("#FF9800");
    doc.text("TriGoRide", 105, 20, { align: "center" });
    doc.setFontSize(14);
    doc.setTextColor("#000000");
    doc.text("Official Receipt", 105, 30, { align: "center" });

    let yPosition = 45;

    // Booking Information
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("BOOKING INFORMATION", 20, yPosition);
    yPosition += 5;
    doc.line(20, yPosition, 120, yPosition);
    yPosition += 10;

    doc.setFont("helvetica", "normal");
    doc.text(`Booking ID: ${ride.id}`, 20, yPosition);
    yPosition += 6;
    doc.text(
      `Booking Date: ${
        ride.dateBooked?.toDate
          ? format(ride.dateBooked.toDate(), "PPP 'at' p")
          : ride.dateBooked || "N/A"
      }`,
      20,
      yPosition
    );
    yPosition += 6;
    doc.text(
      `Completion Date: ${format(currentDate, "PPP 'at' p")}`,
      20,
      yPosition
    );
    yPosition += 6;
    doc.text(
      `Status: ${ride.status?.toUpperCase() || "UNKNOWN"}`,
      20,
      yPosition
    );
    yPosition += 10;

    // Trip Details
    doc.setFont("helvetica", "bold");
    doc.text("TRIP DETAILS", 20, yPosition);
    yPosition += 5;
    doc.line(20, yPosition, 120, yPosition);
    yPosition += 10;

    doc.setFont("helvetica", "normal");
    doc.text(`Passenger Name: ${ride.passenger || "N/A"}`, 20, yPosition);
    yPosition += 6;
    doc.text(
      `Driver Name: ${ride.assignedRiderName || "Unassigned"}`,
      20,
      yPosition
    );
    yPosition += 8;

    doc.text("From:", 20, yPosition);
    yPosition += 5;
    const pickupLines = doc.splitTextToSize(ride.pickUpAddress || "N/A", 150);
    doc.text(pickupLines, 20, yPosition);
    yPosition += pickupLines.length * 5 + 3;

    doc.text("To:", 20, yPosition);
    yPosition += 5;
    const dropoffLines = doc.splitTextToSize(ride.dropOffAddress || "N/A", 150);
    doc.text(dropoffLines, 20, yPosition);
    yPosition += dropoffLines.length * 5 + 8;

    // Payment Summary
    doc.setFont("helvetica", "bold");
    doc.text("PAYMENT SUMMARY", 20, yPosition);
    yPosition += 5;
    doc.line(20, yPosition, 120, yPosition);
    yPosition += 10;

    doc.setFont("helvetica", "normal");
    doc.text("Base Ride Fare:", 20, yPosition);
    doc.text("PHP " + subtotal.toFixed(2), 140, yPosition);
    yPosition += 6;
    doc.text("Platform Service Fee (10%):", 20, yPosition);
    doc.text("PHP " + serviceFee.toFixed(2), 140, yPosition);
    yPosition += 6;

    doc.line(20, yPosition, 170, yPosition);
    yPosition += 6;

    doc.setFont("helvetica", "bold");
    doc.text("TOTAL AMOUNT PAID:", 20, yPosition);
    doc.text("PHP " + total.toFixed(2), 140, yPosition);
    yPosition += 8;

    doc.setFont("helvetica", "normal");
    doc.text("Driver Net Earnings:", 20, yPosition);
    doc.text("PHP " + driverEarnings.toFixed(2), 140, yPosition);
    yPosition += 8;

    // Payment Method
    doc.setFont("helvetica", "bold");
    doc.text("PAYMENT METHOD", 20, yPosition);
    yPosition += 4;
    doc.line(20, yPosition, 120, yPosition);
    yPosition += 6;

    doc.setFont("helvetica", "normal");
    doc.text("Payment Status: Completed", 20, yPosition);
    yPosition += 5;
    doc.text(
      "Transaction ID: TGR-" + ride.id.substring(0, 8).toUpperCase(),
      20,
      yPosition
    );
    yPosition += 8;

    // Company Information
    doc.setFont("helvetica", "bold");
    doc.text("COMPANY INFORMATION", 20, yPosition);
    yPosition += 4;
    doc.line(20, yPosition, 120, yPosition);
    yPosition += 6;

    doc.setFont("helvetica", "normal");
    doc.text("TriGoRide Transportation Services", 20, yPosition);
    yPosition += 5;
    doc.text("Email: support@trigoride.com", 20, yPosition);
    yPosition += 5;
    doc.text("Website: www.trigoride.com", 20, yPosition);
    yPosition += 8;

    // Footer
    doc.setFontSize(8);
    doc.setTextColor("#666666");
    doc.text(
      "Thank you for choosing TriGoRide! We appreciate your business.",
      105,
      yPosition,
      { align: "center" }
    );
    yPosition += 4;
    doc.text(
      "Receipt Generated: " + format(currentDate, "PPP 'at' p"),
      105,
      yPosition,
      { align: "center" }
    );
    yPosition += 5;

    // Split the disclaimer text to fit better
    const disclaimerText = doc.splitTextToSize(
      "This is an official receipt for your records. Please keep this receipt for tax and reimbursement purposes.",
      160
    );
    doc.text(disclaimerText, 105, yPosition, { align: "center" });

    // Save the PDF
    doc.save(`TriGoRide-Receipt-${ride.id}.pdf`);
  };

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

        // If distance is not present, calculate it using geopoints or geocoding
        if (!data._distanceM && (data.pickUp || data.dropOff)) {
          // Use GeoPoint fields if available (pickUp, dropOff)
          const pickupGeo = data.pickUp;
          const dropoffGeo = data.dropOff;
          if (
            pickupGeo &&
            dropoffGeo &&
            pickupGeo.latitude != null &&
            pickupGeo.longitude != null &&
            dropoffGeo.latitude != null &&
            dropoffGeo.longitude != null
          ) {
            const dist = haversineDistance(
              pickupGeo.latitude,
              pickupGeo.longitude,
              dropoffGeo.latitude,
              dropoffGeo.longitude
            );
            setDistanceKm(dist);
          } else if (data.pickUpAddress && data.dropOffAddress) {
            // Fallback to geocoding if geopoints are not valid
            try {
              const [pickup, dropoff] = await Promise.all([
                geocodeAddress(data.pickUpAddress),
                geocodeAddress(data.dropOffAddress),
              ]);
              if (pickup && dropoff) {
                const dist = haversineDistance(
                  pickup.lat,
                  pickup.lon,
                  dropoff.lat,
                  dropoff.lon
                );
                setDistanceKm(dist);
              } else {
                setDistanceKm(null);
              }
            } catch (geoErr) {
              setDistanceKm(null);
            }
          } else {
            setDistanceKm(null);
          }
        } else if (data._distanceM) {
          setDistanceKm(data._distanceM / 1000);
        } else {
          setDistanceKm(null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchRide();
    // eslint-disable-next-line
  }, [id]);

  if (loading) return <p className="text-center mt-10">Loading...</p>;
  if (!ride) return <p className="text-center mt-10">Ride not found.</p>;

  // Format date
  const bookedAt = ride.dateBooked?.toDate
    ? ride.dateBooked
        .toDate()
        .toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : ride.dateBooked;
  const completedAt = ride.dateCompleted?.toDate
    ? ride.dateCompleted
        .toDate()
        .toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : ride.dateCompleted;

  // Calculate fare breakdown
  const dist = distanceKm != null ? distanceKm : 0;
  const raw = dist / 2;
  const baseFare = raw < 1 ? 15 : 15 + raw * 1.5;
  const serviceFee = baseFare * 0.1;
  const specialAmount = ride.specialAmount || 0;
  let totalFare = baseFare + serviceFee;
  if (ride.priorityType === "special") totalFare += specialAmount;

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
      <div
        className="p-6 text-white"
        style={{
          background: "linear-gradient(135deg, #FF9800 0%, #F57C00 100%)",
        }}
      >
        <h1 className="text-3xl font-bold">Ride Details</h1>
        <p className="mt-1 text-opacity-90">Ride ID: {ride.id}</p>
      </div>
      <div className="p-6 space-y-6">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          {/* Passenger */}
          <div>
            <dt className="text-sm font-medium text-gray-500">Passenger</dt>
            <dd className="mt-1 text-lg text-gray-900">{ride.passenger}</dd>
          </div>
          {/* Driver */}
          <div>
            <dt className="text-sm font-medium text-gray-500">Driver</dt>
            <dd className="mt-1 text-lg text-gray-900">
              {ride.assignedRiderName}
            </dd>
          </div>
          {/* Route */}
          <div className="sm:col-span-2">
            <dt className="text-sm font-medium text-gray-500">Route</dt>
            <dd className="mt-1 text-gray-900">
              <span className="block">From: {ride.pickUpAddress || "—"}</span>
              <span className="block">To: {ride.dropOffAddress || "—"}</span>
            </dd>
          </div>
          {/* Priority */}
          <div>
            <dt className="text-sm font-medium text-gray-500">Priority</dt>
            <dd className="mt-1 text-gray-900">
              {ride.priorityType
                ? ride.priorityType.charAt(0).toUpperCase() +
                  ride.priorityType.slice(1)
                : "Regular"}
            </dd>
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
          {/* Distance */}
          <div>
            <dt className="text-sm font-medium text-gray-500">Distance</dt>
            <dd className="mt-1 text-gray-900">
              {distanceKm == null
                ? "Calculating..."
                : `${distanceKm.toFixed(2)} km`}
            </dd>
          </div>
          {/* Date/Time */}
          <div>
            <dt className="text-sm font-medium text-gray-500">
              Date/Time Booked
            </dt>
            <dd className="mt-1 text-gray-900">{bookedAt || "—"}</dd>
          </div>
          {/* Completion Date/Time */}
          <div>
            <dt className="text-sm font-medium text-gray-500">
              Completion Date/Time
            </dt>
            <dd className="mt-1 text-gray-900">{completedAt || "—"}</dd>
          </div>
          {/* Base Fare */}
          <div>
            <dt className="text-sm font-medium text-gray-500">Base Fare</dt>
            <dd className="mt-1 text-gray-900">₱{baseFare.toFixed(2)}</dd>
          </div>
          {/* Service Fee */}
          <div>
            <dt className="text-sm font-medium text-gray-500">Service Fee</dt>
            <dd className="mt-1 text-gray-900">₱{serviceFee.toFixed(2)}</dd>
          </div>
          {/* Special Amount (if any) */}
          {specialAmount > 0 && (
            <div>
              <dt className="text-sm font-medium text-gray-500">
                Special Amount
              </dt>
              <dd className="mt-1 text-gray-900">
                ₱{specialAmount.toFixed(2)}
              </dd>
            </div>
          )}
          {/* Total Fare */}
          <div>
            <dt className="text-sm font-medium text-gray-500">Total Fare</dt>
            <dd className="mt-1 text-gray-900">₱{totalFare.toFixed(2)}</dd>
          </div>
        </dl>

        {/* Actions */}
        <div className="flex gap-3">
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

          {ride.status?.toLowerCase() === "completed" && (
            <button
              onClick={downloadReceipt}
              className="inline-flex items-center px-4 py-2 text-white rounded-lg transition"
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
              Download PDF Receipt
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RideDetails;
