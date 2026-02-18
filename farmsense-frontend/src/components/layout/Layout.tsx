import { Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

export default function Layout() {
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-green-600 text-white p-4 flex justify-between">
        <h1 className="font-bold">FarmSense</h1>
        <button
          onClick={handleLogout}
          className="bg-white text-green-600 px-3 py-1 rounded"
        >
          Logout
        </button>
      </header>

      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}