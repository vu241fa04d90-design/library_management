import { useAuth } from "../AuthContext.jsx";
import { useSettings } from "../SettingsContext.jsx";
import { api } from "../api";
import { formatDate, useApi } from "../hooks.js";

function Figures({ items }) {
  return (
    <dl className="figures">
      {items.map(([label, value, tone]) => (
        <div key={label} className={tone ? `figure ${tone}` : "figure"}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const cur = settings.currency;
  const stats = useApi("/stats/");
  const list = useApi(user.is_staff ? "/issues/?status=overdue" : "/issues/");
  const s = stats.data;
  const alerts = useApi(user.is_staff ? null : "/notifications/");
  const unread = (alerts.data || []).filter((n) => !n.is_read);

  async function dismissAlerts() {
    try {
      await api("/notifications/mark-read/", { method: "POST" });
      alerts.reload();
    } catch {
      // not critical; the alerts simply stay visible
    }
  }

  const items = !s
    ? []
    : user.is_staff
    ? [
        ["Titles", s.titles],
        ["Copies", s.copies],
        ["On loan", s.on_loan],
        ["Overdue", s.overdue, s.overdue ? "bad" : ""],
        ["Members", s.members],
        [`Fines due (${cur})`, s.fines, s.fines ? "bad" : ""],
      ]
    : [
        ["Books on loan", s.on_loan],
        ["Overdue", s.overdue, s.overdue ? "bad" : ""],
        ["Returned so far", s.returned],
        [`Fines due (${cur})`, s.fines, s.fines ? "bad" : ""],
      ];

  // Students see every book they still hold, on time or late.
  const rows = (list.data || []).filter((r) => user.is_staff || !r.returned_on);

  return (
    <>
      <h1>Hello, {user.name}</h1>
      {unread.length > 0 && (
        <div className="card" role="alert">
          <strong>Reminder from the library</strong>
          {unread.slice(0, 3).map((n) => (
            <p key={n.id}>{n.message}</p>
          ))}
          <button className="btn btn-small" onClick={dismissAlerts}>Dismiss</button>
        </div>
      )}
      {stats.error && <p className="error">{stats.error}</p>}
      <Figures items={items} />

      <h2>{user.is_staff ? "Overdue books" : "Books you have right now"}</h2>
      {list.loading ? (
        <p className="muted">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="empty">
          {user.is_staff ? "Nothing is overdue." : "You have no books on loan. Browse the Books page to find one."}
        </p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Book</th>
                {user.is_staff && <th>Member</th>}
                <th>Due</th>
                <th>Days late</th>
                <th>Fine ({cur})</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.book_title}</td>
                  {user.is_staff && <td>{r.member_name}</td>}
                  <td>{formatDate(r.due_on)}</td>
                  <td>{r.days_overdue || "-"}</td>
                  <td>{r.fine || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
