import { useSettings } from "../SettingsContext.jsx";

// Picture on the left, sign-in / register form on the right.
// To use your own photo, put it in frontend/public/img/ and change the url() of
// `.auth-hero` in styles.css.
export default function AuthLayout({ children }) {
  const { settings } = useSettings();
  return (
    <div className="auth-shell">
      <aside className="auth-hero">
        <span className="brand">{settings.library_name}</span>
        <div>
          <h2>A quiet place to find your next book.</h2>
          <p>Search the catalogue, keep track of what you have borrowed and never miss a due date.</p>
          <ul className="auth-points">
            <li>Browse every book in the library</li>
            <li>See your loans and fines in one place</li>
            <li>Get a reminder when a book is overdue</li>
          </ul>
        </div>
      </aside>
      <section className="auth-panel">
        <div className="auth-box">{children}</div>
      </section>
    </div>
  );
}
