/** Read complete plain-text posts and expose only permitted edit navigation. */
import PropTypes from 'prop-types';
import { Link, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { authorRole, canEdit, formatDate, newestPosts } from '../utils/presentation';

/**
 * Render the requested local post with whitespace intact, or a safe missing state.
 * @param {object} props Stored posts, accounts and canonical session.
 * @returns {JSX.Element} Plain-text reader with back navigation.
 */
export default function ReadBlog({ posts, users, session }) {
  const { id } = useParams();
  const post = newestPosts(posts).find((record) => record.id === id);
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-5 py-12 text-slate-800">
      <Link to="/blogs" className="rounded text-indigo-600 hover:underline focus-visible:ring-2">
        Back to All Posts
      </Link>
      {post ? (
        <article className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          {canEdit(session, post) && (
            <div className="mb-6 flex justify-end">
              <Link
                to={`/edit/${encodeURIComponent(post.id)}`}
                className="rounded-lg border border-indigo-200 px-4 py-2 font-medium text-indigo-600 hover:bg-indigo-50 focus-visible:ring-2"
              >
                Edit
              </Link>
            </div>
          )}
          <h1 className="break-words font-['Libre_Baskerville',serif] text-4xl leading-tight md:text-5xl">
            {post.title}
          </h1>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <Avatar role={authorRole(post.authorId, users)} />
            <span className="break-words">
              {post.authorName}
            </span>
            <span className="text-slate-500">
              {formatDate(post.createdAt)}
            </span>
          </div>
          <p className="mt-10 whitespace-pre-wrap break-words text-lg leading-8 text-slate-800">
            {post.content}
          </p>
        </article>
      ) : (
        <h1 className="mt-10 font-['Libre_Baskerville',serif] text-4xl">
          Post not found
        </h1>
      )}
    </main>
  );
}
ReadBlog.propTypes = {
  posts: PropTypes.array.isRequired,
  users: PropTypes.array.isRequired,
  session: PropTypes.shape({ userId: PropTypes.string, role: PropTypes.string }).isRequired,
};
