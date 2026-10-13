/** Review local activity and manage recent content through shared permission-checked services. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { StatCard } from '../components/StatCard';
import { getAccountStats } from '../utils/accounts';
import { getSession } from '../utils/auth';
import { getPosts, getUsers } from '../utils/storage';
import { authorRole, canEdit, formatDate, newestPosts } from '../utils/presentation';
import { deletePost } from '../utils/posts';

const accents = ['indigo', 'violet', 'pink', 'teal'];

/**
 * Render exact dataset counts, quick actions and the five latest safe posts.
 * @param {object} props Optional callback after successful persisted content deletion.
 * @returns {JSX.Element} Admin overview, guarded by App.
 */
export default function AdminDashboard({ onPostsChanged }) {
  const [posts, setPosts] = useState(getPosts);
  const [users, setUsers] = useState(getUsers);
  const [stats, setStats] = useState(getAccountStats);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const session = getSession();

  /** Requery persisted values after storage events or successful deletion. */
  function refresh() {
    setPosts(getPosts());
    setUsers(getUsers());
    setStats(getAccountStats());
  }

  useEffect(() => {
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);

  /** Confirm a content deletion and surface service failures without false success. */
  function remove(post) {
    setError('');
    setStatus('');
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return;
    try {
      deletePost(post.id);
      refresh();
      onPostsChanged?.();
      setStatus(`Post “${post.title}” deleted.`);
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-12 text-slate-800">
      <header className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-8 text-white md:p-10">
        <p className="text-sm font-semibold uppercase tracking-widest">
          Your local writing room
        </p>
        <h1 className="mt-3 font-['Libre_Baskerville',serif] text-4xl leading-tight">
          Admin Dashboard
        </h1>
        <p className="mt-4 max-w-xl text-white">
          A clear view of the stories and people in this browser.
        </p>
      </header>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(stats).map(([label, value], index) => (
          <StatCard key={label} label={label} value={value} accent={accents[index]} />
        ))}
      </div>
      <section aria-label="Quick actions" className="mt-8 flex flex-col gap-3 md:flex-row">
        <Link
          to="/write"
          className={'rounded-lg bg-indigo-600 px-4 py-3 text-center font-medium text-white shadow-sm ' +
            'hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'}
        >
          Write New Post
        </Link>
        <Link
          to="/users"
          className={'rounded-lg border border-indigo-200 bg-white px-4 py-3 text-center font-medium text-indigo-600 ' +
            'hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'}
        >
          Manage Users
        </Link>
      </section>
      <section aria-labelledby="recent-heading" className="mt-12">
        <h2 id="recent-heading" className="text-2xl font-semibold">
          Recent Posts
        </h2>
        {error && (
          <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-red-600">
            {error}
          </p>
        )}
        <p role="status" className="mt-4 text-sm text-teal-700">
          {status}
        </p>
        {newestPosts(posts).length === 0 ? (
          <p className="mt-5 rounded-2xl border border-slate-200 bg-white p-8 text-slate-600">
            No posts yet. Write your first story.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {newestPosts(posts).slice(0, 5).map((post) => (
              <article key={post.id} className="rounded-2xl border border-slate-200 bg-white p-5 md:flex md:items-center md:gap-5">
                <div className="min-w-0 flex-1">
                  <h3 className="break-words text-xl font-semibold">
                    <Link to={`/blog/${encodeURIComponent(post.id)}`} className="rounded hover:text-indigo-600 focus-visible:ring-2">
                      {post.title}
                    </Link>
                  </h3>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                    <Avatar role={authorRole(post.authorId, users)} />
                    <span>
                      {post.authorName}
                    </span>
                    <span>
                      {formatDate(post.createdAt)}
                    </span>
                  </div>
                </div>
                {canEdit(session, post) && (
                  <div className="mt-4 flex flex-wrap gap-3 md:mt-0">
                    <Link
                      to={`/edit/${encodeURIComponent(post.id)}`}
                      aria-label={`Edit ${post.title}`}
                      className={'rounded-lg border border-indigo-200 px-4 py-2 font-medium text-indigo-600 ' +
                        'hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'}
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      aria-label={`Delete ${post.title}`}
                      onClick={() => remove(post)}
                      className={'rounded-lg border border-red-200 bg-red-50 px-4 py-2 font-medium text-red-600 ' +
                        'hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2'}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

AdminDashboard.propTypes = { onPostsChanged: PropTypes.func };
