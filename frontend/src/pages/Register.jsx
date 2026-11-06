import { useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api";
import { useAuth } from "../AuthContext.jsx";
import AuthLayout from "../components/AuthLayout.jsx";
import PasswordInput from "../components/PasswordInput.jsx";

export default function Register() {
  const { login } = useAuth();
  const [form, setForm] = useState({
    first_name: "", username: "", password: "", email: "", student_id: "", phone: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/auth/register/", { method: "POST", body: form, auth: false });
      await login(form.username, form.password);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <h1>Create your account</h1>
      <p className="muted">Student accounts can browse books and see their own loans.</p>
      <form className="card form" onSubmit={submit}>
        <label>Full name<input value={form.first_name} onChange={set("first_name")} required autoFocus /></label>
        <label>Username<input value={form.username} onChange={set("username")} autoComplete="username" required /></label>
        <label>Password (6 characters or more)
          <PasswordInput value={form.password} onChange={set("password")} autoComplete="new-password" minLength={6} required />
        </label>
        <label>Student ID<input value={form.student_id} onChange={set("student_id")} /></label>
        <label>Email (overdue reminders are sent here)
          <input type="email" value={form.email} onChange={set("email")} autoComplete="email" required />
        </label>
        <label>Mobile number
          <input type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" placeholder="9876543210" pattern="[+]?[0-9 \-]{10,16}" title="10 to 15 digits, e.g. 9876543210" required />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? "Creating..." : "Create account"}</button>
      </form>
      <p className="muted">Already registered? <Link to="/login">Sign in</Link></p>
    </AuthLayout>
  );
}
