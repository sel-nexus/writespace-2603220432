/** Create or edit plain-text local writing without transferring authorship. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { FormField } from '../components/FormField';
import { getPosts } from '../utils/storage';
import { canEdit, newestPosts } from '../utils/presentation';
import { createPost, updatePost, validatePostFields } from '../utils/posts';

/**
 * Render required fields and save through the ownership-rechecked shared service.
 * @param {object} props Canonical display session and optional successful-mutation callback.
 * @returns {JSX.Element} Editor, missing state or ownership redirect.
 * Notes: Passed session is for display only; mutation permission comes from getSession in posts.js.
 */
export default function WriteBlog({ session, onPostsChanged }) {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const editing = location.pathname.startsWith('/edit/');
  const [post, setPost] = useState(() => newestPosts(getPosts()).find((record) => record.id === id));
  const [title, setTitle] = useState(editing && post ? post.title : '');
  const [content, setContent] = useState(editing && post ? post.content : '');
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const record = newestPosts(getPosts()).find((entry) => entry.id === id);
    setPost(record);
    setTitle(editing && record ? record.title : '');
    setContent(editing && record ? record.content : '');
    setErrors({});
    setSaveError('');
  }, [id, editing]);

  /** Validate locally, then persist with freshly checked identity and stored metadata. */
  function save(event) {
    event.preventDefault();
    const fields = { title, content };
    const fieldErrors = validatePostFields(fields);
    setErrors(fieldErrors);
    setSaveError('');
    if (Object.keys(fieldErrors).length) return;
    try {
      const saved = editing ? updatePost(id, fields) : createPost(fields);
      onPostsChanged?.();
      navigate(`/blog/${encodeURIComponent(saved.id)}`);
    } catch (error) {
      setSaveError(error.message);
    }
  }

  /** Leave without writing; use router history only when an in-app predecessor exists. */
  function cancel() {
    const index = window.history.state?.idx;
    const hasPrevious = typeof index === 'number' ? index > 0 : location.key !== 'default';
    if (hasPrevious) navigate(-1);
    else navigate('/blogs', { replace: true });
  }

  if (editing && !post) {
    return (
      <main className="mx-auto min-h-screen max-w-4xl px-5 py-12 text-slate-800">
        <Link to="/blogs" className="rounded text-indigo-600 hover:underline focus-visible:ring-2">
          Back to All Posts
        </Link>
        <h1 className="mt-10 font-['Libre_Baskerville',serif] text-4xl">
          Post not found
        </h1>
      </main>
    );
  }
  if (editing && !canEdit(session, post)) {
    return (
      <Navigate to="/blogs" replace />
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-5 py-12 text-slate-800">
      <h1 className="font-['Libre_Baskerville',serif] text-4xl leading-tight">
        {editing ? 'Edit Blog' : 'Write a Blog'}
      </h1>
      <div className="mt-5 flex items-center gap-3 text-sm text-slate-600">
        <Avatar role={session.role} />
        <span>
          {session.displayName}
        </span>
        <span>
          Plain text. Saved in this browser.
        </span>
      </div>
      <form onSubmit={save} noValidate className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <FormField
          id="title"
          label="Title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          error={errors.title}
        />
        <div className="space-y-2">
          <label htmlFor="content" className="block text-sm font-semibold text-slate-800">
            Content
          </label>
          <textarea
            id="content"
            name="content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            required
            aria-required="true"
            aria-invalid={Boolean(errors.content)}
            aria-describedby={errors.content ? 'content-error content-counter' : 'content-counter'}
            className={'min-h-[256px] w-full rounded-lg border bg-white px-3 py-3 text-slate-800 outline-none ' +
              'focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ' +
              (errors.content ? 'border-red-600' : 'border-slate-300')}
          />
          {errors.content && (
            <p id="content-error" role="alert" className="text-sm text-red-600">
              {errors.content}
            </p>
          )}
          <p id="content-counter" aria-live="polite" className="text-right text-sm tabular-nums text-slate-500">
            {content.length} characters
          </p>
        </div>
        {saveError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {saveError}
          </p>
        )}
        <div className="flex flex-col gap-3 md:flex-row">
          <button
            type="submit"
            className={'rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700 ' +
              'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'}
          >
            Save
          </button>
          <button
            type="button"
            onClick={cancel}
            className={'rounded-lg px-4 py-2 font-medium text-slate-500 hover:bg-slate-100 ' +
              'focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2'}
          >
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}

WriteBlog.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.string.isRequired,
  }).isRequired,
  onPostsChanged: PropTypes.func,
};
