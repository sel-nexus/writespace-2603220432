/** Browse all safe local posts without modifying persisted content. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { BlogCard } from '../components/BlogCard';
import { newestPosts } from '../utils/presentation';

/**
 * Show newest posts or an actionable empty state for either authenticated role.
 * @param {object} props Stored posts, accounts and canonical session.
 * @returns {JSX.Element} Responsive reading grid.
 */
export default function Home({ posts, users, session }) {
  const ordered = newestPosts(posts);
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-12 text-slate-800">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
        The local collection
      </p>
      <h1 className="mt-3 font-['Libre_Baskerville',serif] text-5xl">
        All Blogs
      </h1>
      <p className="mb-10 mt-4 text-slate-600">
        A little space for every perspective. Read the latest writing from this browser.
      </p>
      {ordered.length ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {ordered.map((post, index) => (
            <BlogCard key={post.id} post={post} index={index} users={users} session={session} />
          ))}
        </div>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-12">
          <h2 className="font-['Libre_Baskerville',serif] text-2xl">
            No blogs yet. Be the first to write one!
          </h2>
          <Link
            to="/write"
            className="mt-6 inline-block rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700 focus-visible:ring-2"
          >
            Write a Blog
          </Link>
        </section>
      )}
    </main>
  );
}
Home.propTypes = {
  posts: PropTypes.array.isRequired,
  users: PropTypes.array.isRequired,
  session: PropTypes.shape({ userId: PropTypes.string, role: PropTypes.string }).isRequired,
};
