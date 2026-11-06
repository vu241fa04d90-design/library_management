import { useState } from "react";
import { api, errorMessage } from "../api";
import { useSettings } from "../SettingsContext.jsx";

export default function Settings() {
  const { settings, setSettings } = useSettings();
  const [form, setForm] = useState({ ...settings });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value });
    setSaved(false);
  };

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const data = await api("/settings/", {
        method: "PATCH",
        body: {
          library_name: form.library_name,
          currency: form.currency,
          loan_days: Number(form.loan_days),
          fine_per_day: Number(form.fine_per_day),
          max_active_loans: Number(form.max_active_loans),
        },
      });
      setSettings(data);
      setForm({ ...data });
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    }
    setSaving(false);
  }

  return (
    <>
      <h1>Settings</h1>
      <p className="muted">These rules apply to every loan from now on.</p>
      <form className="card form settings-form" onSubmit={submit}>
        <div className="row">
          <label>Library name
            <input value={form.library_name} onChange={set("library_name")} maxLength={80} required />
          </label>
          <label>Currency symbol
            <input value={form.currency} onChange={set("currency")} maxLength={10} required />
          </label>
        </div>
        <div className="row">
          <label>Loan period (days)
            <input type="number" min="1" max="365" value={form.loan_days} onChange={set("loan_days")} required />
          </label>
          <label>Fine per overdue day ({form.currency})
            <input type="number" min="0" value={form.fine_per_day} onChange={set("fine_per_day")} required />
          </label>
        </div>
        <label>Books one member can hold at a time
          <input type="number" min="1" max="100" value={form.max_active_loans} onChange={set("max_active_loans")} required />
        </label>
        <p className="muted small">
          Changing the fine per day also changes the fines shown on loans that are still unpaid.
        </p>
        {error && <p className="error" role="alert">{error}</p>}
        {saved && <p className="success" role="status">Settings saved.</p>}
        <button className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Save settings"}</button>
      </form>
    </>
  );
}
