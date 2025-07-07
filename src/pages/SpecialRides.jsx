import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import {
	BarChart,
	Bar,
	LineChart,
	Line,
	PieChart,
	Pie,
	Cell,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
	AreaChart,
	Area,
} from "recharts";
import { format, startOfDay, subDays, parseISO } from "date-fns";
const SpecialRides = () => {
	const [rides, setRides] = useState([]);
	const [specialRides, setSpecialRides] = useState([]);
	const [loading, setLoading] = useState(true);
	const [dateRange, setDateRange] = useState(30); // Default to last 30 days
	const [analytics, setAnalytics] = useState({
		totalSpecialRides: 0,
		totalRevenue: 0,
		totalBaseRevenue: 0,
		totalServiceFees: 0,
		totalSpecialAmounts: 0,
		averageFare: 0,
		averageBaseRideCost: 0,
		averageServiceFee: 0,
		averageSpecialAmount: 0,
		averageDistance: 0,
		totalDistance: 0,
		revenuePerKm: 0,
		completionRate: 0,
		cancellationRate: 0,
		statusDistribution: [],
		priorityDistribution: [],
		dailyTrends: [],
		revenueComparison: [],
		fareBreakdown: [],
		topRoutes: [],
		cancellationReasons: [],
	});
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

				// Filter special rides (non-regular priority or has special amount)
				const specialRidesData = ridesWithRiders.filter(
					(ride) =>
						ride.priorityType == "special" ||
						(ride.specialAmount && ride.specialAmount > 0)
				);
				setSpecialRides(specialRidesData);

				// Calculate analytics
				calculateAnalytics(specialRidesData, ridesWithRiders);
			} catch (err) {
				console.error("Error fetching rides:", err);
			} finally {
				setLoading(false);
			}
		};
		fetchRides();
	}, [dateRange]);

	// Analytics calculation function
	const calculateAnalytics = (specialRidesData, allRides) => {
		const cutoffDate = subDays(new Date(), dateRange);

		// Filter rides within date range
		const filteredSpecialRides = specialRidesData.filter((ride) => {
			const rideDate = ride.dateBooked?.toDate
				? ride.dateBooked.toDate()
				: new Date(ride.dateBooked);
			return rideDate >= cutoffDate;
		});

		// Enhanced fare calculations with breakdown using business logic
		const ridesWithCalculations = filteredSpecialRides.map((ride) => {
			// Calculate base ride cost using business formula
			const distanceKm = ride._distanceM ? ride._distanceM / 1000 : 0; // Convert meters to km
			const raw = distanceKm / 2; // _distanceM / 2000 simplified
			const baseRideCost = raw < 1 ? 15 : 15 + raw * 1.5;

			// Calculate service fee (10% of base ride cost)
			const serviceFee = baseRideCost * 0.1;

			// Get special amount
			const specialAmount = ride.specialAmount || 0;

			// Calculate total fare
			let totalFare = baseRideCost + serviceFee;
			if (ride.priorityType === "special") {
				totalFare += specialAmount;
			}

			return {
				...ride,
				baseRideCost: parseFloat(baseRideCost.toFixed(2)),
				serviceFee: parseFloat(serviceFee.toFixed(2)),
				specialAmount: parseFloat(specialAmount.toFixed(2)),
				calculatedFare: parseFloat(totalFare.toFixed(2)),
				actualFare: ride.fare || 0,
				fareVariance: (ride.fare || 0) - totalFare,
				distanceKm: parseFloat(distanceKm.toFixed(2)),
			};
		});

		// Basic metrics
		const totalSpecialRides = ridesWithCalculations.length;
		const completedRides = ridesWithCalculations.filter(
			(r) => r.status === "Completed"
		);
		const cancelledRides = ridesWithCalculations.filter(
			(r) => r.status === "Cancelled"
		);

		const totalRevenue = completedRides.reduce(
			(sum, ride) => sum + ride.calculatedFare,
			0
		);

		// Enhanced metrics with fare breakdown
		const totalBaseRevenue = completedRides.reduce(
			(sum, ride) => sum + ride.baseRideCost,
			0
		);

		const totalServiceFees = completedRides.reduce(
			(sum, ride) => sum + ride.serviceFee,
			0
		);

		const totalSpecialAmounts = completedRides.reduce(
			(sum, ride) => sum + ride.specialAmount,
			0
		);

		const averageFare =
			completedRides.length > 0 ? totalRevenue / completedRides.length : 0;
		const averageBaseRideCost =
			completedRides.length > 0 ? totalBaseRevenue / completedRides.length : 0;
		const averageServiceFee =
			completedRides.length > 0 ? totalServiceFees / completedRides.length : 0;
		const averageSpecialAmount =
			completedRides.length > 0
				? totalSpecialAmounts / completedRides.length
				: 0;

		// Distance and efficiency metrics
		const totalDistance = ridesWithCalculations.reduce(
			(sum, ride) => sum + ride.distanceKm,
			0
		);
		const averageDistance =
			ridesWithCalculations.length > 0
				? totalDistance / ridesWithCalculations.length
				: 0;
		const revenuePerKm = totalDistance > 0 ? totalRevenue / totalDistance : 0;

		const completionRate =
			totalSpecialRides > 0
				? (completedRides.length / totalSpecialRides) * 100
				: 0;
		const cancellationRate =
			totalSpecialRides > 0
				? (cancelledRides.length / totalSpecialRides) * 100
				: 0;

		// Status distribution
		const statusCounts = ridesWithCalculations.reduce((acc, ride) => {
			acc[ride.status] = (acc[ride.status] || 0) + 1;
			return acc;
		}, {});

		const statusDistribution = Object.entries(statusCounts).map(
			([status, count]) => ({
				name: status,
				value: count,
				percentage: ((count / totalSpecialRides) * 100).toFixed(1),
			})
		);

		// Priority distribution
		const priorityCounts = ridesWithCalculations.reduce((acc, ride) => {
			acc[ride.priorityType || "regular"] =
				(acc[ride.priorityType || "regular"] || 0) + 1;
			return acc;
		}, {});

		const priorityDistribution = Object.entries(priorityCounts).map(
			([priority, count]) => ({
				name: priority,
				value: count,
				percentage: ((count / totalSpecialRides) * 100).toFixed(1),
			})
		);

		// Daily trends with fare breakdown
		const dailyData = {};
		for (let i = dateRange - 1; i >= 0; i--) {
			const date = format(subDays(new Date(), i), "yyyy-MM-dd");
			dailyData[date] = {
				date,
				specialRides: 0,
				revenue: 0,
				baseRevenue: 0,
				serviceFeeRevenue: 0,
				specialAmountRevenue: 0,
				completed: 0,
				cancelled: 0,
			};
		}

		ridesWithCalculations.forEach((ride) => {
			const rideDate = ride.dateBooked?.toDate
				? ride.dateBooked.toDate()
				: new Date(ride.dateBooked);
			const dateKey = format(rideDate, "yyyy-MM-dd");

			if (dailyData[dateKey]) {
				dailyData[dateKey].specialRides++;
				if (ride.status === "Completed") {
					dailyData[dateKey].revenue += ride.calculatedFare;
					dailyData[dateKey].baseRevenue += ride.baseRideCost;
					dailyData[dateKey].serviceFeeRevenue += ride.serviceFee;
					dailyData[dateKey].specialAmountRevenue += ride.specialAmount;
					dailyData[dateKey].completed++;
				}
				if (ride.status === "Cancelled") {
					dailyData[dateKey].cancelled++;
				}
			}
		});

		const dailyTrends = Object.values(dailyData);

		// Revenue comparison (special vs regular) with proper calculation
		const regularRidesFiltered = allRides.filter((ride) => {
			const rideDate = ride.dateBooked?.toDate
				? ride.dateBooked.toDate()
				: new Date(ride.dateBooked);
			return (
				rideDate >= cutoffDate &&
				ride.priorityType === "regular" &&
				(!ride.specialAmount || ride.specialAmount === 0)
			);
		});

		const regularRevenue = regularRidesFiltered
			.filter((r) => r.status === "Completed")
			.reduce((sum, ride) => {
				// Calculate regular ride fare using business logic
				const distanceKm = ride._distanceM ? ride._distanceM / 1000 : 0;
				const raw = distanceKm / 2;
				const baseRideCost = raw < 1 ? 15 : 15 + raw * 1.5;
				const serviceFee = baseRideCost * 0.1;
				const totalFare = baseRideCost + serviceFee; // No special amount for regular rides
				return sum + totalFare;
			}, 0);

		const revenueComparison = [
			{
				name: "Special Rides",
				value: totalRevenue,
				count: completedRides.length,
			},
			{
				name: "Regular Rides",
				value: regularRevenue,
				count: regularRidesFiltered.filter((r) => r.status === "Completed")
					.length,
			},
		];

		// Fare breakdown analysis
		const fareBreakdown = [
			{
				name: "Base Ride Cost",
				value: totalBaseRevenue,
				percentage:
					totalRevenue > 0
						? ((totalBaseRevenue / totalRevenue) * 100).toFixed(1)
						: 0,
				average: averageBaseRideCost,
			},
			{
				name: "Service Fees",
				value: totalServiceFees,
				percentage:
					totalRevenue > 0
						? ((totalServiceFees / totalRevenue) * 100).toFixed(1)
						: 0,
				average: averageServiceFee,
			},
			{
				name: "Special Amounts",
				value: totalSpecialAmounts,
				percentage:
					totalRevenue > 0
						? ((totalSpecialAmounts / totalRevenue) * 100).toFixed(1)
						: 0,
				average: averageSpecialAmount,
			},
		];

		// Top routes for special rides
		const routeCounts = {};
		ridesWithCalculations.forEach((ride) => {
			const route = `${ride.pickUpAddress || "Unknown"} → ${
				ride.dropOffAddress || "Unknown"
			}`;
			routeCounts[route] = {
				count: (routeCounts[route]?.count || 0) + 1,
				revenue:
					(routeCounts[route]?.revenue || 0) +
					(ride.status === "Completed" ? ride.calculatedFare : 0),
				baseRevenue:
					(routeCounts[route]?.baseRevenue || 0) +
					(ride.status === "Completed" ? ride.baseRideCost : 0),
				specialRevenue:
					(routeCounts[route]?.specialRevenue || 0) +
					(ride.status === "Completed" ? ride.specialAmount : 0),
				pickUp: ride.pickUpAddress || "Unknown",
				dropOff: ride.dropOffAddress || "Unknown",
			};
		});

		const topRoutes = Object.entries(routeCounts)
			.sort(([, a], [, b]) => b.count - a.count)
			.slice(0, 10)
			.map(([route, data]) => ({
				route,
				...data,
			}));

		// Cancellation reasons
		const cancellationReasons = cancelledRides.reduce((acc, ride) => {
			const reason = ride.cancelledBy || "Unknown";
			acc[reason] = (acc[reason] || 0) + 1;
			return acc;
		}, {});

		const cancellationReasonsData = Object.entries(cancellationReasons).map(
			([reason, count]) => ({
				name: reason,
				value: count,
				percentage:
					cancelledRides.length > 0
						? ((count / cancelledRides.length) * 100).toFixed(1)
						: 0,
			})
		);

		setAnalytics({
			totalSpecialRides,
			totalRevenue,
			totalBaseRevenue,
			totalServiceFees,
			totalSpecialAmounts,
			averageFare,
			averageBaseRideCost,
			averageServiceFee,
			averageSpecialAmount,
			averageDistance,
			totalDistance,
			revenuePerKm,
			completionRate,
			cancellationRate,
			statusDistribution,
			priorityDistribution,
			dailyTrends,
			revenueComparison,
			fareBreakdown,
			topRoutes,
			cancellationReasons: cancellationReasonsData,
		});
	};
	// Color schemes for charts
	const COLORS = [
		"#8884d8",
		"#82ca9d",
		"#ffc658",
		"#ff7300",
		"#8dd1e1",
		"#d084d0",
	];
	const STATUS_COLORS = {
		Completed: "#10b981",
		Cancelled: "#ef4444",
		Pending: "#f59e0b",
		Ongoing: "#3b82f6",
		Accepted: "#6366f1",
	};

	return (
		<div className='p-6'>
			{/* Header */}
			<div className='flex items-center justify-between mb-6'>
				<div>
					<h1 className='text-3xl font-bold text-gray-800'>
						Special Rides Analytics
					</h1>
					<p className='text-gray-600'>
						Comprehensive analytics for special rides with premium services and
						priority booking.
					</p>
				</div>

				{/* Date Range Filter */}
				<div className='flex items-center space-x-4'>
					<label className='text-sm font-medium text-gray-700'>
						Date Range:
					</label>
					<select
						value={dateRange}
						onChange={(e) => setDateRange(Number(e.target.value))}
						className='border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'>
						<option value={7}>Last 7 days</option>
						<option value={30}>Last 30 days</option>
						<option value={90}>Last 3 months</option>
						<option value={365}>Last year</option>
					</select>
				</div>
			</div>

			{loading ? (
				<div className='flex justify-center items-center h-64'>
					<div className='text-gray-500'>
						Loading special rides analytics...
					</div>
				</div>
			) : (
				<>
					{/* Key Metrics Cards */}
					<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8'>
						<div className='bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white'>
							<h3 className='text-sm font-medium opacity-90'>
								Total Special Rides
							</h3>
							<p className='text-3xl font-bold mt-2'>
								{analytics.totalSpecialRides}
							</p>
							<p className='text-sm opacity-75 mt-1'>
								{specialRides.length > analytics.totalSpecialRides
									? `${
											specialRides.length - analytics.totalSpecialRides
									  } more all-time`
									: "In selected period"}
							</p>
						</div>

						<div className='bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white'>
							<h3 className='text-sm font-medium opacity-90'>Total Revenue</h3>
							<p className='text-3xl font-bold mt-2'>
								₱{analytics.totalRevenue.toFixed(2)}
							</p>
							<p className='text-sm opacity-75 mt-1'>From completed rides</p>
						</div>

						<div className='bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white'>
							<h3 className='text-sm font-medium opacity-90'>Base Revenue</h3>
							<p className='text-3xl font-bold mt-2'>
								₱{analytics.totalBaseRevenue.toFixed(2)}
							</p>
							<p className='text-sm opacity-75 mt-1'>
								Avg: ₱{analytics.averageBaseRideCost.toFixed(2)}
							</p>
						</div>

						<div className='bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white'>
							<h3 className='text-sm font-medium opacity-90'>Service Fees</h3>
							<p className='text-3xl font-bold mt-2'>
								₱{analytics.totalServiceFees.toFixed(2)}
							</p>
							<p className='text-sm opacity-75 mt-1'>
								Avg: ₱{analytics.averageServiceFee.toFixed(2)}
							</p>
						</div>

						<div className='bg-gradient-to-r from-pink-500 to-pink-600 rounded-lg shadow-lg p-6 text-white'>
							<h3 className='text-sm font-medium opacity-90'>
								Special Amounts
							</h3>
							<p className='text-3xl font-bold mt-2'>
								₱{analytics.totalSpecialAmounts.toFixed(2)}
							</p>
							<p className='text-sm opacity-75 mt-1'>
								Avg: ₱{analytics.averageSpecialAmount.toFixed(2)}
							</p>
						</div>

						<div className='bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-lg shadow-lg p-6 text-white'>
							<h3 className='text-sm font-medium opacity-90'>
								Completion Rate
							</h3>
							<p className='text-3xl font-bold mt-2'>
								{analytics.completionRate.toFixed(1)}%
							</p>
							<p className='text-sm opacity-75 mt-1'>
								Cancel: {analytics.cancellationRate.toFixed(1)}%
							</p>
						</div>
					</div>

					{/* Additional Metrics Cards - Distance & Efficiency */}
					<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8'>
						<div className='bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-lg shadow-lg p-6 text-white'>
							<h3 className='text-sm font-medium opacity-90'>Total Distance</h3>
							<p className='text-3xl font-bold mt-2'>
								{analytics.totalDistance.toFixed(1)} km
							</p>
							<p className='text-sm opacity-75 mt-1'>
								Avg: {analytics.averageDistance.toFixed(1)} km per ride
							</p>
						</div>

						<div className='bg-gradient-to-r from-teal-500 to-teal-600 rounded-lg shadow-lg p-6 text-white'>
							<h3 className='text-sm font-medium opacity-90'>Revenue per KM</h3>
							<p className='text-3xl font-bold mt-2'>
								₱{analytics.revenuePerKm.toFixed(2)}
							</p>
							<p className='text-sm opacity-75 mt-1'>Revenue efficiency</p>
						</div>

						<div className='bg-gradient-to-r from-violet-500 to-violet-600 rounded-lg shadow-lg p-6 text-white'>
							<h3 className='text-sm font-medium opacity-90'>Average Fare</h3>
							<p className='text-3xl font-bold mt-2'>
								₱{analytics.averageFare.toFixed(2)}
							</p>
							<p className='text-sm opacity-75 mt-1'>Per completed ride</p>
						</div>
					</div>

					{/* Charts Section */}
					<div className='grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8'>
						{/* Daily Trends */}
						<div className='bg-white rounded-lg shadow-lg p-6'>
							<h3 className='text-lg font-semibold text-gray-800 mb-4'>
								Daily Special Rides Trend
							</h3>
							<ResponsiveContainer width='100%' height={300}>
								<AreaChart data={analytics.dailyTrends}>
									<CartesianGrid strokeDasharray='3 3' />
									<XAxis
										dataKey='date'
										tick={{ fontSize: 12 }}
										tickFormatter={(value) => format(new Date(value), "MMM dd")}
									/>
									<YAxis />
									<Tooltip
										labelFormatter={(value) =>
											format(new Date(value), "MMM dd, yyyy")
										}
										formatter={(value, name) => [
											value,
											name === "specialRides" ? "Special Rides" : name,
										]}
									/>
									<Area
										type='monotone'
										dataKey='specialRides'
										stroke='#8884d8'
										fill='#8884d8'
										fillOpacity={0.6}
									/>
								</AreaChart>
							</ResponsiveContainer>
						</div>

						{/* Status Distribution */}
						<div className='bg-white rounded-lg shadow-lg p-6'>
							<h3 className='text-lg font-semibold text-gray-800 mb-4'>
								Ride Status Distribution
							</h3>
							<ResponsiveContainer width='100%' height={300}>
								<PieChart>
									<Pie
										data={analytics.statusDistribution}
										cx='50%'
										cy='50%'
										labelLine={false}
										label={({ name, percentage }) => `${name}: ${percentage}%`}
										outerRadius={80}
										fill='#8884d8'
										dataKey='value'>
										{analytics.statusDistribution.map((entry, index) => (
											<Cell
												key={`cell-${index}`}
												fill={
													STATUS_COLORS[entry.name] ||
													COLORS[index % COLORS.length]
												}
											/>
										))}
									</Pie>
									<Tooltip />
								</PieChart>
							</ResponsiveContainer>
						</div>

						{/* Priority Type Distribution */}
						<div className='bg-white rounded-lg shadow-lg p-6'>
							<h3 className='text-lg font-semibold text-gray-800 mb-4'>
								Priority Type Distribution
							</h3>
							<ResponsiveContainer width='100%' height={300}>
								<BarChart data={analytics.priorityDistribution}>
									<CartesianGrid strokeDasharray='3 3' />
									<XAxis dataKey='name' />
									<YAxis />
									<Tooltip formatter={(value, name) => [value, "Count"]} />
									<Bar dataKey='value' fill='#82ca9d' />
								</BarChart>
							</ResponsiveContainer>
						</div>

						{/* Revenue Comparison */}
						<div className='bg-white rounded-lg shadow-lg p-6'>
							<h3 className='text-lg font-semibold text-gray-800 mb-4'>
								Revenue: Special vs Regular Rides
							</h3>
							<ResponsiveContainer width='100%' height={300}>
								<BarChart
									data={analytics.revenueComparison}
									margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
									<CartesianGrid strokeDasharray='3 3' />
									<XAxis dataKey='name' />
									<YAxis />
									<Tooltip
										formatter={(value, name) =>
											name === "value"
												? [`₱${value.toFixed(2)}`, "Revenue"]
												: [value, "Rides Count"]
										}
									/>
									<Bar dataKey='value' fill='#ffc658' />
								</BarChart>
							</ResponsiveContainer>
						</div>

						{/* Fare Breakdown */}
						<div className='bg-white rounded-lg shadow-lg p-6'>
							<h3 className='text-lg font-semibold text-gray-800 mb-4'>
								Revenue Breakdown
							</h3>
							<ResponsiveContainer width='100%' height={300}>
								<PieChart>
									<Pie
										data={analytics.fareBreakdown}
										cx='50%'
										cy='50%'
										labelLine={false}
										label={({ name, percentage }) => `${name}: ${percentage}%`}
										outerRadius={80}
										fill='#8884d8'
										dataKey='value'>
										{analytics.fareBreakdown.map((entry, index) => (
											<Cell
												key={`cell-${index}`}
												fill={COLORS[index % COLORS.length]}
											/>
										))}
									</Pie>
									<Tooltip
										formatter={(value, name) => [`₱${value.toFixed(2)}`, name]}
									/>
								</PieChart>
							</ResponsiveContainer>
							<div className='mt-4 space-y-2'>
								{analytics.fareBreakdown.map((item, index) => (
									<div
										key={index}
										className='flex justify-between items-center p-2 bg-gray-50 rounded'>
										<div className='flex items-center'>
											<div
												className='w-4 h-4 rounded mr-2'
												style={{
													backgroundColor: COLORS[index % COLORS.length],
												}}></div>
											<span className='text-sm font-medium'>{item.name}</span>
										</div>
										<div className='text-right'>
											<div className='text-sm font-bold'>
												₱{item.value.toFixed(2)}
											</div>
											<div className='text-xs text-gray-500'>
												Avg: ₱{item.average.toFixed(2)}
											</div>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>

					{/* Revenue Trends */}
					<div className='bg-white rounded-lg shadow-lg p-6 mb-8'>
						<h3 className='text-lg font-semibold text-gray-800 mb-4'>
							Daily Revenue Breakdown & Completion Trends
						</h3>
						<ResponsiveContainer width='100%' height={400}>
							<LineChart data={analytics.dailyTrends}>
								<CartesianGrid strokeDasharray='3 3' />
								<XAxis
									dataKey='date'
									tickFormatter={(value) => format(new Date(value), "MMM dd")}
								/>
								<YAxis yAxisId='left' />
								<YAxis yAxisId='right' orientation='right' />
								<Tooltip
									labelFormatter={(value) =>
										format(new Date(value), "MMM dd, yyyy")
									}
									formatter={(value, name) => {
										if (name.includes("Revenue") || name.includes("revenue"))
											return [`₱${value.toFixed(2)}`, name];
										return [
											value,
											name.charAt(0).toUpperCase() + name.slice(1),
										];
									}}
								/>
								<Legend />
								<Bar
									yAxisId='left'
									dataKey='baseRevenue'
									stackId='revenue'
									fill='#3b82f6'
									name='Base Revenue'
								/>
								<Bar
									yAxisId='left'
									dataKey='serviceFeeRevenue'
									stackId='revenue'
									fill='#10b981'
									name='Service Fee Revenue'
								/>
								<Bar
									yAxisId='left'
									dataKey='specialAmountRevenue'
									stackId='revenue'
									fill='#f59e0b'
									name='Special Amount Revenue'
								/>
								<Line
									yAxisId='right'
									type='monotone'
									dataKey='completed'
									stroke='#059669'
									strokeWidth={3}
									name='Completed Rides'
								/>
								<Line
									yAxisId='right'
									type='monotone'
									dataKey='cancelled'
									stroke='#dc2626'
									strokeWidth={3}
									name='Cancelled Rides'
								/>
							</LineChart>
						</ResponsiveContainer>
					</div>

					{/* Top Routes and Cancellation Reasons */}
					<div className='grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8'>
						{/* Top Routes */}
						<div className='bg-white rounded-lg shadow-lg p-6'>
							<h3 className='text-lg font-semibold text-gray-800 mb-4'>
								Top Special Ride Routes
							</h3>
							<div className='space-y-4 max-h-96 overflow-y-auto'>
								{analytics.topRoutes.length > 0 ? (
									analytics.topRoutes.map((route, index) => (
										<div
											key={index}
											className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'>
											<div className='flex-1'>
												<p className='font-medium text-sm text-gray-800'>
													{route.pickUp}
												</p>
												<p className='text-gray-600 text-xs'>↓</p>
												<p className='font-medium text-sm text-gray-800'>
													{route.dropOff}
												</p>
											</div>
											<div className='text-right'>
												<p className='text-lg font-bold text-blue-600'>
													{route.count}
												</p>
												<p className='text-xs text-gray-500'>rides</p>
												<p className='text-sm font-medium text-green-600'>
													₱{route.revenue.toFixed(2)}
												</p>
											</div>
										</div>
									))
								) : (
									<p className='text-gray-500 text-center py-8'>
										No route data available
									</p>
								)}
							</div>
						</div>
					</div>

					{/* Recent Special Rides Table */}
					<div className='bg-white rounded-lg shadow-lg p-6'>
						<h3 className='text-lg font-semibold text-gray-800 mb-4'>
							Recent Special Rides
						</h3>
						<div className='overflow-x-auto'>
							<table className='min-w-full divide-y divide-gray-200'>
								<thead className='bg-gray-50'>
									<tr>
										<th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
											Passenger
										</th>
										<th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
											Route & Distance
										</th>
										<th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
											Priority
										</th>
										<th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
											Status
										</th>
										<th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
											Base Cost
										</th>
										<th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
											Service Fee
										</th>
										<th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
											Special Amount
										</th>
										<th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
											Total Fare
										</th>
										<th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
											Date
										</th>
									</tr>
								</thead>
								<tbody className='bg-white divide-y divide-gray-200'>
									{specialRides.slice(0, 10).map((ride) => {
										const rideDate = ride.dateBooked?.toDate
											? ride.dateBooked.toDate()
											: new Date(ride.dateBooked);

										// Calculate fare components using business logic
										const distanceKm = ride._distanceM
											? ride._distanceM / 1000
											: 0;
										const raw = distanceKm / 2;
										const baseRideCost = raw < 1 ? 15 : 15 + raw * 1.5;
										const serviceFee = baseRideCost * 0.1;
										const specialAmount = ride.specialAmount || 0;
										let totalFare = baseRideCost + serviceFee;
										if (ride.priorityType === "special") {
											totalFare += specialAmount;
										}

										return (
											<tr key={ride.id} className='hover:bg-gray-50'>
												<td className='px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900'>
													{ride.passenger || "—"}
												</td>
												<td className='px-6 py-4 text-sm text-gray-700'>
													<div className='max-w-xs truncate'>
														{ride.pickUpAddress || "Unknown"} →{" "}
														{ride.dropOffAddress || "Unknown"}
													</div>
													<div className='text-xs text-gray-500'>
														{distanceKm.toFixed(2)} km
													</div>
												</td>
												<td className='px-6 py-4 whitespace-nowrap text-sm text-gray-700'>
													<span
														className={`px-2 py-1 text-xs font-semibold rounded-full ${
															ride.priorityType === "urgent"
																? "bg-red-100 text-red-800"
																: ride.priorityType === "priority"
																? "bg-yellow-100 text-yellow-800"
																: ride.priorityType === "special"
																? "bg-purple-100 text-purple-800"
																: "bg-gray-100 text-gray-800"
														}`}>
														{ride.priorityType || "regular"}
													</span>
												</td>
												<td className='px-6 py-4 whitespace-nowrap text-sm'>
													<span
														className={`px-2 py-1 text-xs font-semibold rounded-full ${
															STATUS_COLORS[ride.status]
																? `bg-${STATUS_COLORS[ride.status]}-100 text-${
																		STATUS_COLORS[ride.status]
																  }-800`
																: "bg-gray-100 text-gray-800"
														}`}
														style={{
															backgroundColor: STATUS_COLORS[ride.status]
																? `${STATUS_COLORS[ride.status]}20`
																: "#f3f4f6",
															color: STATUS_COLORS[ride.status] || "#374151",
														}}>
														{ride.status || "Unknown"}
													</span>
												</td>
												<td className='px-6 py-4 whitespace-nowrap text-sm text-gray-700'>
													₱{baseRideCost.toFixed(2)}
												</td>
												<td className='px-6 py-4 whitespace-nowrap text-sm text-gray-700'>
													₱{serviceFee.toFixed(2)}
												</td>
												<td className='px-6 py-4 whitespace-nowrap text-sm text-gray-700'>
													₱{specialAmount.toFixed(2)}
												</td>
												<td className='px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900'>
													₱{totalFare.toFixed(2)}
													{ride.fare &&
														Math.abs(ride.fare - totalFare) > 0.01 && (
															<div className='text-xs text-gray-500'>
																(Actual: ₱{ride.fare.toFixed(2)})
															</div>
														)}
												</td>
												<td className='px-6 py-4 whitespace-nowrap text-sm text-gray-700'>
													{format(rideDate, "MMM dd, yyyy HH:mm")}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
						{specialRides.length > 10 && (
							<div className='mt-4 text-center'>
								<p className='text-sm text-gray-600'>
									Showing 10 of {specialRides.length} special rides
								</p>
							</div>
						)}
					</div>
				</>
			)}
		</div>
	);
};

export default SpecialRides;
