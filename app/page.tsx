export default function RootPage() {
  // This page should ideally not be reached directly by users if middleware is set up correctly.
  // Logged-in users are redirected to /dashboard.
  // Logged-out users are redirected to /login when trying to access /.
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#d3d3d3]">
      <div className="text-center">
        <p className="text-lg text-[#003366]">Loading...</p>
      </div>
    </div>
  );
}
