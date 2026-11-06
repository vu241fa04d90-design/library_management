import { useState } from "react";
import { api, errorMessage } from "../api";
import { useAuth } from "../AuthContext.jsx";
import IssueModal from "../components/IssueModal.jsx";
import { useSettings } from "../SettingsContext.jsx";
import { formatDate, useApi, useDebounced } from "../hooks.js";

const TABS = [
  ["", "All"],
  ["active", "On time"],
  ["overdue", "Overdue"],
  ["returned", "Returned"],
];

export default function Loans() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [issuing, setIssuing] = useState(false);
  const [tab, setTab] = useState("");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [info, setInfo] = useState("");
  const q = useDebounced(search);

  const params = new URLSearchParams();
  if (tab) params.set("status", tab);
  if (q) params.set("search", q);
  const loans = useApi(`/issues/?${params.toString()}`);
  const rows = loans.data || [];

  async function act(loan, action) {
    setNotice("");
    try {
      await api(`/issues/${loan.id}/${action}/`, { method: "POST" });
      loans.reload();
    } catch (err) {
      setNotice(errorMessage(err));
    }
  }

  async function sendReminders() {
    setNotice("");
    setInfo("");
    try {
      const r = await api("/issues/send-reminders/", { method: "POST" });
      setInfo(
        r.sent
          ? `Reminders sent to ${r.sent} overdue loan${r.sent === 1 ? "" : "s"}.`
          : r.skipped
          ? "Everyone with an overdue book was already reminded today."
          : "No overdue books, so nobody needed a reminder."
      );
    } catch (err) {
      setNotice(errorMessage(err));
    }
  }

  function clearFine(loan) {
    if (window.confirm(`Mark the ${settings.currency} ${loan.fine} fine on "${loan.book_title}" as paid?`)) {
      act(loan, "clear-fine");
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>{user.is_staff ? "Loans" : "My loans"}</h1>
        {user.is_staff && (
          <div className="actions">
            <button className="btn" onClick={sendReminders}>Send overdue reminders</button>
            <button className="btn btn-primary" onClick={() => setIssuing(true)}>Issue a book</button>
          </div>
        )}
      </div>

      <div className="toolbar">
        <div className="tabs" role="tablist">
          {TABS.map(([value, label]) => (
            <button
              key={label}
              role="tab"
              aria-selected={tab === value}
              className={tab === value ? "tab on" : "tab"}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder={user.is_staff ? "Search by book or member" : "Search by book"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search loans"
        />
      </div>

      {info && <p className="muted" role="status">{info}</p>}
      {notice && <p className="error" role="alert">{notice}</p>}
      {loans.error && <p className="error" role="alert">{loans.error}</p>}

      {loans.loading && !loans.data ? (
        <p className="muted">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="empty">
          {user.is_staff
            ? "No loans here. Issue a book from the Books page."
            : "No loans here yet."}
        </p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Book</th>
                {user.is_staff && <th>Member</th>}
                <th>Issued</th>
                <th>Due</th>
                <th>Returned</th>
                <th>Fine ({settings.currency})</th>
                {user.is_staff && <th><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td>{l.book_title}</td>
                  {user.is_staff && <td>{l.member_name}</td>}
                  <td>{formatDate(l.issued_on)}</td>
                  <td className={l.status === "overdue" ? "bad-text" : ""}>
                    {formatDate(l.due_on)}
                    {l.status === "overdue" && <div className="small">{l.days_overdue} days late</div>}
                  </td>
                  <td>{l.returned_on ? formatDate(l.returned_on) : "-"}</td>
                  <td>
                    {l.fine || "-"}
                    {l.fine_paid > 0 && <div className="muted small">{l.fine_paid} paid</div>}
                  </td>
                  {user.is_staff && (
                    <td className="actions">
                      {!l.returned_on && (
                        <button className="btn btn-small" onClick={() => act(l, "return")}>Mark returned</button>
                      )}
                      {l.fine > 0 && (
                        <button className="btn btn-small btn-quiet" onClick={() => clearFine(l)}>Clear fine</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {issuing && (
        <IssueModal
          onClose={() => setIssuing(false)}
          onSaved={() => { setIssuing(false); loans.reload(); }}
        />
      )}
    </>
  );
}
