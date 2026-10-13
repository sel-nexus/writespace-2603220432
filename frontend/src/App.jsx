/** Route public, identity, reading and content surfaces; revalidate local data without Context. */
import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Home from './pages/Home';
import ReadBlog from './pages/ReadBlog';
import WriteBlog from './pages/WriteBlog';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { getSession } from './utils/auth';
import { getPosts, getUsers } from './utils/storage';

/**
 * Keep canonical identity and reading data fresh after navigation and storage events.
 * @returns {JSX.Element} Reading routes and guarded redirects for future stories.
 */
export default function App() {
  const location = useLocation();
  const [session, setSession] = useState(getSession);
  const [posts, setPosts] = useState(getPosts);
  const [users, setUsers] = useState(getUsers);
  useEffect(() => {
    /** Refresh identity and collections after navigation or cross-tab changes. */
    function refresh() {
      setSession(getSession());
      setPosts(getPosts());
      setUsers(getUsers());
    }
    refresh();
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, [location.pathname, location.key]);

  // Guards recheck synchronously rather than trusting cached identity.
  const current = getSession();
  const home = current?.role === 'admin' ? '/admin' : '/blogs';
  /** Refresh state after a successful same-tab identity write or removal. */
  function authenticated() {
    setSession(getSession());
  }

  /** Refresh visible posts only after the shared service confirms a successful write. */
  function postsChanged() {
    setPosts(getPosts());
  }

  /** Wrap a reading page with canonical guards and member navigation. */
  function member(page) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-slate-50">
          {current && (
            <Navbar key={location.pathname} session={current} />
          )}
          {page}
        </div>
      </ProtectedRoute>
    );
  }

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
      <Route
        path="/blogs"
        element={member(current ? <Home posts={posts} users={users} session={current} /> : null)}
      />
      <Route
        path="/blog/:id"
        element={member(current ? (
          <ReadBlog posts={posts} users={users} session={current} onPostsChanged={postsChanged} />
        ) : null)}
      />
      {['/write', '/edit/:id'].map((path) => (
        <Route
          key={path}
          path={path}
          element={member(current ? (
            <WriteBlog key={`editor:${location.pathname}`} session={current} onPostsChanged={postsChanged} />
          ) : null)}
        />
      ))}
      {['/admin', '/users'].map((path) => (
        <Route
          key={path}
          path={path}
          element={
            <ProtectedRoute role="admin">
              <Navigate to="/" replace />
            </ProtectedRoute>
          }
        />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
