import { useAuthStore } from "../../store/authStore";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  const handleLogout = () => {
    console.log("logout clicked");
    logout();
    navigate("/login");
  };

//   return (
//     <div className="flex items-center justify-center min-h-screen bg-green-50">
//       <div className="bg-white p-8 rounded shadow w-96 text-center">
//         <h2 className="text-2xl font-bold">Dashboard</h2>
//         <p className="mt-2 text-gray-600">
//           Welcome {user?.name}
//         </p>

//         <button
//           onClick={handleLogout}
//           className="mt-4 bg-red-500 text-white px-4 py-2 rounded"
//         >
//           Logout
//         </button>
//         <Link
//   to="/fields/new"
//   className="bg-green-600 text-white px-4 py-2 rounded"
// >
//   Add Field
// </Link>
//       </div>
//     </div>
//   );
return (
  <div className="flex items-center justify-center min-h-screen bg-green-50">
    <div className="bg-white p-8 rounded shadow w-96 text-center space-y-4">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      <p className="text-gray-600">
        Welcome {user?.name}
      </p>

      <div className="flex flex-col gap-3 mt-4">
        <Link
          to="/fields"
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          View Fields
        </Link>

        <Link
          to="/fields/new"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Add Field
        </Link>
      </div>

      <button
        onClick={handleLogout}
        className="mt-4 bg-red-500 text-white px-4 py-2 rounded"
      >
        Logout
      </button>
    </div>
  </div>
);

}