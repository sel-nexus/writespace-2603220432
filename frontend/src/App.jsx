/** Route the identity slice and revalidate local sessions on navigation and storage events. */
import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { getSession } from './utils/auth';

/**
 * Keep public/auth routes consistent without creating future-story page stubs.
 * @returns {JSX.Element} Identity routes and temporary destination redirects.
 */
export default function App() {
  const location = useLocation();
  const [session, setSession] = useState(getSession);
  useEffect(() => {
    /** Refresh canonical identity after navigation or cross-tab changes. */
    function refresh() { setSession(getSession()); }
    refresh();
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, [location.pathname]);

  // Recheck synchronously for guards so a stale state never admits an auth route.
  const current = getSession();
  const home = current?.role === 'admin' ? '/admin' : '/blogs';
  /** Refresh state after a successful same-tab identity write. */
  function authenticated() { setSession(getSession()); }

  return (
    <Routes>
      <Route path="/" element={<LandingPage session={session} />} />
      <Route
        path="/login"
        element={current ? <Navigate to={home} replace /> : <LoginPage onAuthenticated={authenticated} />}
      />
      <Route
        path="/register"
        element={current ? <Navigate to={home} replace /> : <RegisterPage onAuthenticated={authenticated} />}
      />
      <Route path="/blogs" element={<Navigate to={current ? '/' : '/login'} replace />} />
      <Route path="/admin" element={<Navigate to={current ? '/' : '/login'} replace />} />
      <Route path="/blog/:id" element={<Navigate to={current ? '/' : '/login'} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
