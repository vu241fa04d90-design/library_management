import { useState } from "react";
import { api, errorMessage } from "../api";
import { useSettings } from "../SettingsContext.jsx";
import { useApi } from "../hooks.js";
import Modal from "./Modal.jsx";

// Give a book to a member. Pass `book` to lock the book (from the Books page),
// or leave it out to let the librarian pick one (from the Loans page).
export default function IssueModal({ book, onSaved, onClose }) {
  const { settings } = useSettings();
  const members = useApi("/members/");
  const books = useApi(book ? null : "/books/");
  const [bookId, setBookId] = useState(book ? String(book.id) : "");
  const [member, setMember] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const today = new Date().toLocaleDateString("en-CA");

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/issues/", {
        method: "POST",
        body: {
          book: Number(bookId),
          member: Number(member),
          ...(dueOn ? { due_on: dueOn } : {}),
        },
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  const available = (books.data || []).filter((b) => b.available_copies > 0);

  return (
    <Modal title={book ? `Issue "${book.title}"` : "Issue a book"} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {!book && (
          <label>Book
            <select value={bookId} onChange={(e) => setBookId(e.target.value)} required>
              <option value="">Choose a book</option>
              {available.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title} - {b.available_copies} in
                </option>
              ))}
            </select>
          </label>
        )}
        <label>Member
          <select value={member} onChange={(e) => setMember(e.target.value)} required>
            <option value="">Choose a member</option>
            {(members.data || []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}{m.student_id ? ` (${m.student_id})` : ""} - {m.active_loans} on loan
              </option>
            ))}
          </select>
        </label>
        <label>Due date (leave empty for {settings.loan_days} days)
          <input type="date" min={today} value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-primary" disabled={saving || !member || !bookId}>
          {saving ? "Issuing..." : "Issue book"}
        </button>
      </form>
    </Modal>
  );
}
