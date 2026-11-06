import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, clearSession, loadUser, saveSession } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser);

  const login = useCallback(async (username, password) => {
    const data = await api("/auth/login/", {
      method: "POST",
      body: { username, password },
      auth: false,
    });
    saveSession(data);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  useEffect(() => {
    window.addEventListener("lib:logout", logout);
    return () => window.removeEventListener("lib:logout", logout);
  }, [logout]);

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
