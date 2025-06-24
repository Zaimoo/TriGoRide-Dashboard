function Sidebar() {
  return (
    <div className="w-64 bg-gray-800 text-white min-h-screen p-5">
      <h1 className="text-2xl font-bold mb-8">TrigoRide Admin</h1>
      <ul className="space-y-4">
        <li>Dashboard</li>
        <li>Active Rides</li>
        <li>Users</li>
        <li>Drivers</li>
        <li>Reports</li>
        <li>Settings</li>
      </ul>
    </div>
  );
}

export default Sidebar;
