/** Read complete plain-text posts and offer ownership-rechecked confirmed deletion. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deletePost } from '../utils/posts';
import { Avatar } from '../components/Avatar';
import { authorRole, canEdit, formatDate, newestPosts } from '../utils/presentation';

/**
 * Render the requested local post with whitespace intact, or a safe missing state.
 * @param {object} props Stored posts, accounts and canonical session.
 * @returns {JSX.Element} Plain-text reader with back navigation.
 */
export default function ReadBlog({ posts, users, session, onPostsChanged }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [deleteError, setDeleteError] = useState('');
  const post = newestPosts(posts).find((record) => record.id === id);

  /** Confirm before writing; service rechecks identity and ownership after the dialog. */
  function remove() {
    setDeleteError('');
    try {
      if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return;
      deletePost(post.id);
      onPostsChanged?.();
      navigate('/blogs');
    } catch (error) {
      setDeleteError(error.message);
    }
  }
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-5 py-12 text-slate-800">
      <Link to="/blogs" className="rounded text-indigo-600 hover:underline focus-visible:ring-2">
        Back to All Posts
      </Link>
      {post ? (
        <article className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          {canEdit(session, post) && (
            <div className="mb-6 flex flex-wrap justify-end gap-3">
              <Link
                to={`/edit/${encodeURIComponent(post.id)}`}
                className="rounded-lg border border-indigo-200 px-4 py-2 font-medium text-indigo-600 hover:bg-indigo-50 focus-visible:ring-2"
              >
                Edit
              </Link>
              <button
                type="button"
                onClick={remove}
                className={'rounded-lg border border-red-200 bg-red-50 px-4 py-2 font-medium text-red-600 ' +
                  'hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2'}
              >
                Delete
              </button>
            </div>
          )}
          {deleteError && (
            <p role="alert" className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {deleteError}
            </p>
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
  onPostsChanged: PropTypes.func,
};
