import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

import { api } from "../../../services/api";
import { apiErrorMessage } from "../../../services/apiError";
import { Alert, Button, TextField } from "../../../components/ui";
import { AuthLayout } from "../components/AuthLayout";

const MIN_PASSWORD = 8;

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Checked here so a too-short password is caught before a round trip on a
    // connection that may take ten seconds to answer.
    if (form.password.length < MIN_PASSWORD) {
      setError(`Choose a password of at least ${MIN_PASSWORD} characters.`);
      return;
    }

    setSubmitting(true);

    try {
      await api.post("/auth/signup", form);
      navigate("/login", {
        replace: true,
        state: { justRegistered: true },
      });
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create your account. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Add your fields once, then get water and fertilizer guidance every week."
      footer={
        <>
          Already registered?{" "}
          <Link
            to="/login"
            className="font-semibold text-field-700 underline underline-offset-2 hover:text-field-800"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error && <Alert tone="error">{error}</Alert>}

        <TextField
          label="Your name"
          name="name"
          autoComplete="name"
          placeholder="Ram Prasad Yadav"
          value={form.name}
          onChange={handleChange}
          required
        />

        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={handleChange}
          required
        />

        <div className="relative">
          <TextField
            label="Password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            hint={`At least ${MIN_PASSWORD} characters.`}
            className="pr-12"
            value={form.password}
            onChange={handleChange}
            required
          />
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
          {submitting ? "Creating account..." : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
