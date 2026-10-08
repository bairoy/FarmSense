import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

import { api } from "../../../services/api";
import { useAuthStore } from "../../../store/authStore";
import { apiErrorMessage } from "../../../services/apiError";
import { Alert, Button, TextField } from "../../../components/ui";
import { AuthLayout } from "../components/AuthLayout";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);

  // Register sends the farmer here after a successful signup. Without this the
  // account is created and the app silently shows a fresh empty login form,
  // which reads as "it did not work" and gets the form submitted again.
  const justRegistered =
    (location.state as { justRegistered?: boolean } | null)?.justRegistered ?? false;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await api.post("/auth/login", { email, password });
      const { user, accessToken, refreshToken } = res.data;

      login(user, accessToken, refreshToken);
      navigate("/", { replace: true });
    } catch (err) {
      // Shown in the form rather than in window.alert(), which hid the fields
      // behind a browser dialog at the exact moment the farmer needed to see
      // what they had typed.
      setError(apiErrorMessage(err, "Could not sign in. Check your email and password."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to see how your crop is doing today."
      footer={
        <>
          New here?{" "}
          <Link
            to="/register"
            className="font-semibold text-field-700 underline underline-offset-2 hover:text-field-800"
          >
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {justRegistered && !error && (
          <Alert tone="success" title="Account created">
            Sign in with the email and password you just chose.
          </Alert>
        )}

        {error && <Alert tone="error">{error}</Alert>}

        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <div className="relative">
          <TextField
            label="Password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Your password"
            className="pr-12"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {/* Typing a password blind on a phone keyboard, outdoors, is the most
              common reason a sign-in fails twice in a row. */}
          <button
            type="button"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-1 top-8 flex h-11 w-11 items-center justify-center rounded-lg text-clay-500 hover:text-clay-800"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>

        <Button type="submit" size="lg" block disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
}
