import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Books from "./pages/Books.jsx";
import Loans from "./pages/Loans.jsx";
import Members from "./pages/Members.jsx";
import Settings from "./pages/Settings.jsx";
import { useAuth } from "./AuthContext.jsx";

export default function App() {
  const { user } = useAuth();
  return (
    <>
      {user && <Navbar />}
      <main className={user ? "page" : "page page-auth"}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/books" element={<ProtectedRoute><Books /></ProtectedRoute>} />
          <Route path="/loans" element={<ProtectedRoute><Loans /></ProtectedRoute>} />
          <Route path="/members" element={<ProtectedRoute staffOnly><Members /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute staffOnly><Settings /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
