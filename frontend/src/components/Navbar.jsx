import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import { useSettings } from "../SettingsContext.jsx";
import { useTheme } from "../theme.js";

const Moon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);
const Sun = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export default function Navbar() {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const { theme, toggle } = useTheme();
  const [scrolled, setScrolled] = useState(false);

  // Adds a shadow under the top bar once the page is scrolled.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={scrolled ? "topbar scrolled" : "topbar"}>
      <div className="topbar-inner">
        <span className="brand">{settings.library_name}</span>
        <nav className="nav" aria-label="Main">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/books">Books</NavLink>
          <NavLink to="/loans">{user.is_staff ? "Loans" : "My loans"}</NavLink>
          {user.is_staff && <NavLink to="/members">Members</NavLink>}
          {user.is_staff && <NavLink to="/settings">Settings</NavLink>}
        </nav>
        <div className="who">
          <button
            className="theme-toggle"
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={theme === "dark" ? "Light theme" : "Dark theme"}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </button>
          <span>{user.name}{user.is_staff ? " (librarian)" : ""}</span>
          <button className="btn btn-quiet" onClick={logout}>Sign out</button>
        </div>
      </div>
    </header>
  );
}
