import { useState } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "../api";
import { useAuth } from "../AuthContext.jsx";
import AuthLayout from "../components/AuthLayout.jsx";
import PasswordInput from "../components/PasswordInput.jsx";
import { useSettings } from "../SettingsContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const { settings } = useSettings();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.status === 401 ? "Wrong username or password." : errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <h1>{settings.library_name}</h1>
      <p className="muted">Sign in to browse books and manage your loans.</p>
      <form className="card form" onSubmit={submit}>
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required autoFocus />
        </label>
        <label>
          Password
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
      </form>
      <p className="muted">New student? <Link to="/register">Create an account</Link></p>
    </AuthLayout>
  );
}
