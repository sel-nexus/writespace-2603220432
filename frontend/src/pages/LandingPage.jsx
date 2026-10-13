/** Introduce the local writing demo and preview its newest browser-local posts. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicNavbar } from '../components/PublicNavbar';
import { getPosts } from '../utils/storage';

const displayFont = "font-['Libre_Baskerville',serif]";
const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';
const benefits = [
  ['01', 'Write Freely', 'Plain-text writing, no distractions.', 'border-indigo-500'],
  ['02', 'Private & Local', 'All data lives in your browser.', 'border-pink-500'],
  ['03', 'Instant & Fast', 'No server, no lag.', 'border-teal-500'],
];

/**
 * Filter malformed records so local tampering cannot break public previews.
 * @returns {Array} Up to three usable posts in newest-first order.
 */
function latestPosts() {
  return getPosts().filter((post) => post && typeof post.id === 'string' &&
    typeof post.title === 'string' && typeof post.content === 'string' &&
    typeof post.createdAt === 'string' && Number.isFinite(Date.parse(post.createdAt)))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 3);
}

/**
 * Format a validated post date consistently with the future reading surface.
 * @param {string} date ISO creation date.
 * @returns {string} English month, two-digit day and year.
 */
function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

/**
 * Combine an editorial introduction, local benefits, previews and navigation.
 * @param {object} props Valid current session or null.
 * @returns {JSX.Element} Public landing surface.
 */
export default function LandingPage({ session = null }) {
  const [posts, setPosts] = useState(latestPosts);
  useEffect(() => {
    /** Refresh local previews after another tab changes storage. */
    function refresh() { setPosts(latestPosts()); }
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);

  return (
    <>
      <PublicNavbar session={session} />
      <main id="main-content">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="mb-6 text-xs font-bold uppercase tracking-[0.25em] text-indigo-600">
              A little room for big ideas
            </p>
            <h1 className={`${displayFont} text-5xl leading-tight tracking-tight md:text-6xl`}>
              WriteSpace
            </h1>
            <p className={`${displayFont} mt-6 text-2xl leading-relaxed text-slate-700`}>
              Your thoughts. Your space. Beautifully simple.
            </p>
            <p className="mt-6 max-w-md leading-7 text-slate-600">
              Give the unfinished thought a place to begin. Read, write, and keep your words in this browser.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link to="/register" className={`rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700 ${focus}`}>
                Get Started Free
              </Link>
              <Link to={session ? '/blogs' : '/login'} className={`rounded-lg px-4 py-3 font-semibold text-indigo-600 hover:bg-indigo-50 ${focus}`}>
                Start Reading
              </Link>
            </div>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-pink-500 p-6 md:p-10">
            <article aria-label="Illustrative writing card" className="rounded-xl bg-white p-7 shadow-xl motion-safe:animate-pulse">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                A page from your next chapter
              </p>
              <h2 className={`${displayFont} mt-8 text-2xl leading-snug`}>
                It starts with a sentence.
              </h2>
              <p className="mt-5 leading-7 text-slate-600">
                The quiet of a morning. An idea on the way home. Something worth remembering, in your own words.
              </p>
              <div aria-hidden="true" className="mt-8 h-1 w-16 rounded-full bg-teal-500" />
              <p className="mt-5 text-xs text-slate-500">
                An illustration, not a saved post
              </p>
            </article>
          </div>
        </section>
        <section aria-label="Why WriteSpace" className="mx-auto grid max-w-6xl gap-8 px-6 pb-16 md:grid-cols-3">
          {benefits.map(([number, title, copy, accent]) => (
            <article key={title} className={`border-t-4 ${accent} bg-white p-6`}>
              <p className="text-xs font-semibold tracking-widest text-slate-500">
                {number}
              </p>
              <h2 className={`${displayFont} mt-4 text-xl`}>
                {title}
              </h2>
              <p className="mt-3 leading-6 text-slate-600">
                {copy}
              </p>
            </article>
          ))}
        </section>
        <section aria-labelledby="latest-title" className="border-y border-slate-200 bg-white py-16">
          <div className="mx-auto max-w-6xl px-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">
              The local journal
            </p>
            <h2 id="latest-title" className={`${displayFont} mt-4 text-3xl`}>
              Latest from the Blog
            </h2>
            {posts.length ? (
              <div className="mt-8 grid gap-6 md:grid-cols-3">
                {posts.map((post) => (
                  <Link
                    key={post.id}
                    to={`/blog/${encodeURIComponent(post.id)}`}
                    className={`rounded-xl border border-slate-200 p-6 hover:border-indigo-500 ${focus}`}
                  >
                    <article>
                      <p className="text-sm text-slate-500">
                        {formatDate(post.createdAt)}
                      </p>
                      <h3 className={`${displayFont} mt-4 break-words text-xl leading-relaxed`}>
                        {post.title}
                      </h3>
                      <p className="mt-4 break-words leading-7 text-slate-600">
                        {post.content.slice(0, 120)}
                      </p>
                    </article>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-8 border-l-4 border-teal-500 py-4 pl-5 text-slate-600">
                No posts yet — check back soon!
              </p>
            )}
          </div>
        </section>
        <aside className="mx-auto max-w-6xl px-6 py-8 text-sm leading-6 text-slate-600">
          Local demo only: accounts, posts, and plaintext passwords stay in this browser, not the cloud.
          Public previews are visible to anyone using it. No encryption or secure authentication — use no real passwords or sensitive data.
        </aside>
      </main>
      <footer className="bg-slate-800 px-6 py-10 text-slate-100">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6">
          <p>
            © {new Date().getFullYear()} WriteSpace
          </p>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-5">
            {[['Home', '/'], ['All Blogs', '/blogs'], ['Login', '/login'], ['Register', '/register']].map(([label, to]) => (
              <Link key={label} to={to} className={`rounded hover:underline ${focus}`}>
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </>
  );
}
LandingPage.propTypes = { session: PublicNavbar.propTypes.session };
