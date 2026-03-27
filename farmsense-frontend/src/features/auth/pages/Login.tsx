import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../services/api"
import { useAuthStore } from "../../../store/authStore"

export default function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await api.post("/auth/login", { email, password });

      const { user, accessToken, refreshToken } = res.data;

      login(user, accessToken, refreshToken);

      navigate("/");
    } catch (error: any) {
      alert(error.response?.data?.message || "Login failed");
    }
  };


  return (
    <div className="flex items-center justify-center min-h-screen bg-green-50">
      <div className="bg-white p-8 rounded shadow w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full border p-3 rounded"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full border p-3 rounded"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button className="w-full bg-green-600 text-white p-3 rounded">
            Login
          </button>
        </form>

        <p className="mt-4 text-center text-sm">
          Don’t have an account?{" "}
          <Link to="/register" className="text-green-600">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}