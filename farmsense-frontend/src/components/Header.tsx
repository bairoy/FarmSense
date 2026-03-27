import { NavLink } from "react-router-dom";
import { Bell, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "../../src/store/authStore";
import { useNavigate } from "react-router-dom";

export default function Header() {
  
  const [profileOpen, setProfileOpen] = useState(false);

  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navClass = ({ isActive }: any) =>
    `px-3 py-2 rounded-md text-sm font-medium transition ${
      isActive
        ? "bg-green-600 text-white"
        : "text-green-900 hover:bg-green-100"
    }`;

  return (
    <header className="fixed top-0 left-0 w-full h-16 bg-white border-b shadow-sm z-50">
      <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-6">
        
        {/* Logo */}
        <div className="text-2xl font-bold text-green-700">
          FarmSense
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-3">
          <NavLink to="/" className={navClass}>Dashboard</NavLink>
          <NavLink to="/fields" className={navClass}>Fields</NavLink>
          


          <NavLink
            to="/ai"
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            AI Assistant
          </NavLink>
        </nav>

        {/* Right section */}
        <div className="flex items-center gap-4">
          <Bell className="text-green-800 cursor-pointer" />

          {/* Profile dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2"
            >
              <img
                src="https://i.pravatar.cc/40"
                className="w-8 h-8 rounded-full"
              />
              <ChevronDown size={16} />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white shadow-lg rounded-md border">
                <button className="block w-full text-left px-4 py-2 hover:bg-green-50">
                  Profile
                </button>
                <button className="block w-full text-left px-4 py-2 hover:bg-green-50">
                  Settings
                </button>
                <button className="block w-full text-left px-4 py-2 hover:bg-red-50 text-red-600" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
