export default function DashboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-[#003366] mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Placeholder for dashboard widgets */}
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-[#003366] mb-2">Widget 1</h2>
          <p className="text-gray-700">Content for widget 1...</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-[#003366] mb-2">Widget 2</h2>
          <p className="text-gray-700">Content for widget 2...</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-[#003366] mb-2">Widget 3</h2>
          <p className="text-gray-700">Content for widget 3...</p>
        </div>
      </div>
    </div>
  );
} 