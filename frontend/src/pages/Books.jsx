import { useState } from "react";
import { api, errorMessage } from "../api";
import { useAuth } from "../AuthContext.jsx";
import IssueModal from "../components/IssueModal.jsx";
import Modal from "../components/Modal.jsx";
import { spineColor, useApi, useDebounced } from "../hooks.js";

const EMPTY = { title: "", author: "", isbn: "", category: "", description: "", total_copies: 1 };

function BookForm({ book, onSaved, onClose }) {
  const [form, setForm] = useState(book ? { ...book } : EMPTY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const body = {
      title: form.title,
      author: form.author,
      isbn: form.isbn,
      category: form.category,
      description: form.description,
      total_copies: Number(form.total_copies),
    };
    try {
      if (book) await api(`/books/${book.id}/`, { method: "PATCH", body });
      else await api("/books/", { method: "POST", body });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal title={book ? "Edit book" : "Add a book"} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>Title<input value={form.title} onChange={set("title")} required autoFocus /></label>
        <label>Author<input value={form.author} onChange={set("author")} required /></label>
        <div className="row">
          <label>ISBN<input value={form.isbn} onChange={set("isbn")} required /></label>
          <label>Category<input value={form.category} onChange={set("category")} /></label>
        </div>
        <label>Number of copies
          <input type="number" min="1" value={form.total_copies} onChange={set("total_copies")} required />
        </label>
        <label>Description<textarea rows="3" value={form.description} onChange={set("description")} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Save book"}</button>
      </form>
    </Modal>
  );
}

export default function Books() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [editing, setEditing] = useState(null); // null, "new", or a book
  const [issuing, setIssuing] = useState(null);
  const [notice, setNotice] = useState("");

  const q = useDebounced(search);
  const params = new URLSearchParams();
  if (q) params.set("search", q);
  if (category) params.set("category", category);

  const books = useApi(`/books/?${params.toString()}`);
  const categories = useApi("/books/categories/");

  function refresh() {
    books.reload();
    categories.reload();
  }

  async function remove(book) {
    const note = book.available_copies < book.total_copies
      ? "\n\nSome copies are on loan, so this will be refused until they are returned."
      : "\n\nIts returned-loan history will be deleted too.";
    if (!window.confirm(`Delete "${book.title}"?${note}`)) return;
    setNotice("");
    try {
      await api(`/books/${book.id}/`, { method: "DELETE" });
      refresh();
    } catch (err) {
      setNotice(errorMessage(err));
    }
  }

  const rows = books.data || [];

  return (
    <>
      <div className="page-head">
        <h1>Books</h1>
        {user.is_staff && <button className="btn btn-primary" onClick={() => setEditing("new")}>Add a book</button>}
      </div>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search by title, author, ISBN or category"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search books"
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
          <option value="">All categories</option>
          {(categories.data || []).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {notice && <p className="error" role="alert">{notice}</p>}
      {books.error && <p className="error" role="alert">{books.error}</p>}

      {books.loading && !books.data ? (
        <p className="muted">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="empty">
          {search || category ? "No books match that search." : "The catalogue is empty."}
          {user.is_staff && !search && !category ? " Add the first book." : ""}
        </p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>Category</th>
                <th>Availability</th>
                {user.is_staff && <th><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td className="spine" style={{ "--spine": spineColor(b.category) }}>
                    <strong>{b.title}</strong>
                    <div className="muted small">ISBN {b.isbn}</div>
                  </td>
                  <td>{b.author}</td>
                  <td>{b.category || "-"}</td>
                  <td>
                    {b.available_copies > 0
                      ? `${b.available_copies} of ${b.total_copies} in`
                      : <span className="bad-text">All {b.total_copies} out</span>}
                  </td>
                  {user.is_staff && (
                    <td className="actions">
                      <button className="btn btn-small" disabled={b.available_copies < 1} onClick={() => setIssuing(b)}>Issue</button>
                      <button className="btn btn-small btn-quiet" onClick={() => setEditing(b)}>Edit</button>
                      <button className="btn btn-small btn-quiet" onClick={() => remove(b)}>Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <BookForm
          book={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}
      {issuing && (
        <IssueModal
          book={issuing}
          onClose={() => setIssuing(null)}
          onSaved={() => { setIssuing(null); refresh(); }}
        />
      )}
    </>
  );
}
