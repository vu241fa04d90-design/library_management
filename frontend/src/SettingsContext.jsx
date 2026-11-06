import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";
import { useAuth } from "./AuthContext.jsx";

const DEFAULTS = {
  library_name: "Campus Library",
  currency: "Rs.",
  loan_days: 14,
  fine_per_day: 5,
  max_active_loans: 3,
};

const SettingsContext = createContext({ settings: DEFAULTS, setSettings: () => {} });

export function SettingsProvider({ children }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState(DEFAULTS);

  const load = useCallback(async () => {
    try {
      setSettings(await api("/settings/", { auth: Boolean(user) }));
    } catch {
      // keep whatever we have; the pages still work with the defaults
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    document.title = settings.library_name;
  }, [settings.library_name]);

  return (
    <SettingsContext.Provider value={{ settings, setSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
