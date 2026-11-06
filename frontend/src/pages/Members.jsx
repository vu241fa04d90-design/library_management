import { useState } from "react";
import { api, errorMessage } from "../api";
import Modal from "../components/Modal.jsx";
import { useSettings } from "../SettingsContext.jsx";
import { useApi, useDebounced } from "../hooks.js";

function MemberForm({ member, onSaved, onClose }) {
  const editing = Boolean(member);
  const [form, setForm] = useState({
    first_name: member?.name ?? "",
    username: member?.username ?? "",
    password: "",
    student_id: member?.student_id ?? "",
    email: member?.email ?? "",
    phone: member?.phone ?? "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editing) {
        const { username, password, ...rest } = form;
        await api(`/members/${member.id}/`, {
          method: "PATCH",
          body: password ? { ...rest, password } : rest,
        });
      } else {
        await api("/members/", { method: "POST", body: form });
      }
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal title={editing ? "Edit member" : "Add a member"} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>Full name
          <input value={form.first_name} onChange={set("first_name")} required autoFocus />
        </label>
        <div className="row">
          <label>Username
            <input value={form.username} onChange={set("username")} required disabled={editing} autoComplete="off" />
          </label>
          <label>{editing ? "New password" : "Password"}
            <input
              type="password"
              value={form.password}
              onChange={set("password")}
              minLength={6}
              required={!editing}
              placeholder={editing ? "Leave empty to keep" : "6 characters or more"}
              autoComplete="new-password"
            />
          </label>
        </div>
        <div className="row">
          <label>Student ID<input value={form.student_id} onChange={set("student_id")} /></label>
          <label>Mobile number<input type="tel" value={form.phone} onChange={set("phone")} pattern="[+]?[0-9 \-]{10,16}" title="10 to 15 digits, e.g. 9876543210" required /></label>
        </div>
        <label>Email<input type="email" value={form.email} onChange={set("email")} required /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-primary" disabled={saving}>
          {saving ? "Saving..." : editing ? "Save changes" : "Add member"}
        </button>
      </form>
    </Modal>
  );
}

export default function Members() {
  const { settings } = useSettings();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // null, "new", or a member
  const [notice, setNotice] = useState("");
  const q = useDebounced(search);
  const members = useApi(`/members/?search=${encodeURIComponent(q)}`);
  const rows = members.data || [];

  async function run(action) {
    setNotice("");
    try {
      await action();
      members.reload();
    } catch (err) {
      setNotice(errorMessage(err));
    }
  }

  function clearFines(m) {
    if (window.confirm(`Mark all ${settings.currency} ${m.fines_due} in fines for ${m.name} as paid?`)) {
      run(() => api(`/members/${m.id}/clear-fines/`, { method: "POST" }));
    }
  }

  function remove(m) {
    const warn = m.fines_due > 0 ? `\n\nThey still owe ${settings.currency} ${m.fines_due} in fines.` : "";
    const ok = window.confirm(
      `Delete ${m.name} (${m.username})?${warn}\n\nTheir account and loan history will be removed. This can't be undone.`
    );
    if (ok) run(() => api(`/members/${m.id}/`, { method: "DELETE" }));
  }

  return (
    <>
      <div className="page-head">
        <h1>Members</h1>
        <button className="btn btn-primary" onClick={() => setEditing("new")}>Add a member</button>
      </div>
      <div className="toolbar">
        <input
          type="search"
          placeholder="Search by name, username or student ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search members"
        />
      </div>

      {notice && <p className="error" role="alert">{notice}</p>}
      {members.error && <p className="error" role="alert">{members.error}</p>}

      {members.loading && !members.data ? (
        <p className="muted">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="empty">
          {search ? "No members match that search." : "No members yet. Add one, or let students register themselves."}
        </p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Student ID</th>
                <th>Phone</th>
                <th>Books out</th>
                <th>Fines ({settings.currency})</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{m.username}</td>
                  <td>{m.student_id || "-"}</td>
                  <td>{m.phone || "-"}</td>
                  <td>{m.active_loans}</td>
                  <td className={m.fines_due > 0 ? "bad-text" : ""}>{m.fines_due || "-"}</td>
                  <td className="actions">
                    {m.fines_due > 0 && (
                      <button className="btn btn-small" onClick={() => clearFines(m)}>Clear fines</button>
                    )}
                    <button className="btn btn-small btn-quiet" onClick={() => setEditing(m)}>Edit</button>
                    <button className="btn btn-small btn-quiet" onClick={() => remove(m)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <MemberForm
          member={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); members.reload(); }}
        />
      )}
    </>
  );
}
