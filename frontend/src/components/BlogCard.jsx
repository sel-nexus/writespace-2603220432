/** Present a plain-text post summary with separate permitted edit navigation. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Avatar } from './Avatar';
import { authorRole, canEdit, cardAccent, excerpt, formatDate } from '../utils/presentation';

/**
 * Render a card whose primary link covers its readable content, without nested links.
 * @param {object} props Valid post, sorted index, account collection and canonical session.
 * @returns {JSX.Element} Post summary and optional edit link.
 */
export function BlogCard({ post, index, users, session }) {
  return (
    <article className={`relative rounded-2xl border border-t-4 bg-white shadow-sm ${cardAccent(index)}`}>
      <Link
        to={`/blog/${encodeURIComponent(post.id)}`}
        className="block h-full rounded-xl p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <h2 className="break-words pr-12 font-['Libre_Baskerville',serif] text-2xl text-slate-800">
          {post.title}
        </h2>
        <p className="mt-4 break-words text-sm leading-7 text-slate-600">
          {excerpt(post.content)}
        </p>
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-600">
          <Avatar role={authorRole(post.authorId, users)} />
          <span className="break-words">
            {post.authorName}
          </span>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          {formatDate(post.createdAt)}
        </p>
      </Link>
      {canEdit(session, post) && (
        <Link
          to={`/edit/${encodeURIComponent(post.id)}`}
          aria-label={`Edit ${post.title}`}
          className="absolute right-4 top-5 rounded-lg border border-indigo-200 p-2 text-indigo-600 hover:bg-indigo-50 focus-visible:ring-2"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="m16 3 5 5-12 12-6 1 1-6L16 3Zm-2 2 5 5" />
          </svg>
        </Link>
      )}
    </article>
  );
}
BlogCard.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.string.isRequired, title: PropTypes.string.isRequired, content: PropTypes.string.isRequired,
    authorId: PropTypes.string.isRequired, authorName: PropTypes.string.isRequired, createdAt: PropTypes.string.isRequired,
  }).isRequired,
  index: PropTypes.number.isRequired,
  users: PropTypes.array.isRequired,
  session: PropTypes.shape({ userId: PropTypes.string, role: PropTypes.string }),
};
