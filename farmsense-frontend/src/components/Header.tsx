// import { NavLink } from "react-router-dom";
// import { Bell, ChevronDown } from "lucide-react";
// import { useState } from "react";
// import { useAuthStore } from "../../src/store/authStore";
// import { useNavigate } from "react-router-dom";

// export default function Header() {

//   const [profileOpen, setProfileOpen] = useState(false);

//   const logout = useAuthStore((state) => state.logout);
//   const navigate = useNavigate();

//   const handleLogout = () => {
//     logout();
//     navigate("/login");
//   };

//   const navClass = ({ isActive }: any) =>
//     `px-3 py-2 rounded-md text-sm font-medium transition ${
//       isActive
//         ? "bg-green-600 text-white"
//         : "text-green-900 hover:bg-green-100"
//     }`;

//   return (
//     <header className="fixed top-0 left-0 w-full h-16 bg-white border-b shadow-sm z-50">
//       <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-6">

//         {/* Logo */}
//         <div className="text-2xl font-bold text-green-700">
//           FarmSense
//         </div>

//         {/* Navigation */}
//         <nav className="hidden md:flex items-center gap-3">
//           <NavLink to="/" className={navClass}>Dashboard</NavLink>
//           <NavLink to="/fields" className={navClass}>Fields</NavLink>



//           <NavLink
//             to="/ai"
//             className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
//           >
//             AI Assistant
//           </NavLink>
//         </nav>

//         {/* Right section */}
//         <div className="flex items-center gap-4">
//           <Bell className="text-green-800 cursor-pointer" />

//           {/* Profile dropdown */}
//           <div className="relative">
//             <button
//               onClick={() => setProfileOpen(!profileOpen)}
//               className="flex items-center gap-2"
//             >
//               <img
//                 src="https://i.pravatar.cc/40"
//                 className="w-8 h-8 rounded-full"
//               />
//               <ChevronDown size={16} />
//             </button>

//             {profileOpen && (
//               <div className="absolute right-0 mt-2 w-40 bg-white shadow-lg rounded-md border">
//                 <button className="block w-full text-left px-4 py-2 hover:bg-green-50">
//                   Profile
//                 </button>
//                 <button className="block w-full text-left px-4 py-2 hover:bg-green-50">
//                   Settings
//                 </button>
//                 <button className="block w-full text-left px-4 py-2 hover:bg-red-50 text-red-600" onClick={handleLogout}>
//                   Logout
//                 </button>
//               </div>
//             )}
//           </div>
//         </div>
//       </div>
//     </header>
//   );
// }
import { NavLink } from "react-router-dom";
import { Bell, ChevronDown, User } from "lucide-react";
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
    `px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
      ? "bg-green-600 text-white shadow-sm"
      : "text-green-900 hover:bg-green-100 hover:text-green-700"
    }`;

  return (
    <header className="fixed top-0 left-0 w-full h-16 bg-white/80 backdrop-blur-md border-b border-green-100 shadow-sm z-50">
      <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-6">

        {/* Logo */}
        <div className="text-2xl font-bold text-green-700 tracking-tight">
          FarmSense
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-xl">
          <NavLink to="/" className={navClass}>Dashboard</NavLink>
          <NavLink to="/fields" className={navClass}>Fields</NavLink>

          <NavLink
            to="/ai"
            className="ml-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 shadow-sm"
          >
            AI Assistant
          </NavLink>
        </nav>

        {/* Right section */}
        <div className="flex items-center gap-4">

          {/* Notification */}
          <div className="relative cursor-pointer p-2 rounded-full hover:bg-green-100 transition">
            <Bell className="text-green-800" size={20} />
          </div>

          {/* Profile dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-green-100 transition"
            >
              {/* Avatar removed → replaced with icon */}
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-green-200">
                <User size={18} className="text-green-800" />
              </div>
              <ChevronDown size={16} className="text-green-700" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-3 w-44 bg-white shadow-lg rounded-xl border border-green-100 overflow-hidden">
                <button className="block w-full text-left px-4 py-2 text-sm hover:bg-green-50 transition">
                  Profile
                </button>
                <button className="block w-full text-left px-4 py-2 text-sm hover:bg-green-50 transition">
                  Settings
                </button>
                <button
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-600 transition"
                  onClick={handleLogout}
                >
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