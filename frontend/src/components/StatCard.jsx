/** Present a local-dataset statistic with a restrained colorful icon accent. */
import PropTypes from 'prop-types';

const accents = {
  indigo: 'bg-indigo-100 text-indigo-700',
  violet: 'bg-violet-100 text-violet-700',
  pink: 'bg-pink-100 text-pink-700',
  teal: 'bg-teal-100 text-teal-700',
};

/**
 * Render an exact label and tabular count as an accessible statistic.
 * @param {object} props Statistic label, value and optional accent.
 * @returns {JSX.Element} Labelled statistic card.
 */
export function StatCard({ label, value, accent = 'indigo' }) {
  return (
    <section aria-label={label} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <span aria-hidden="true" className={`rounded-xl p-3 ${accents[accent] || accents.indigo}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
          <path d="M5 19V9m7 10V5m7 14v-7" strokeLinecap="round" />
        </svg>
      </span>
      <div>
        <p className="text-sm font-medium text-slate-600">
          {label}
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-slate-800">
          {value}
        </p>
      </div>
    </section>
  );
}

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  accent: PropTypes.oneOf(['indigo', 'violet', 'pink', 'teal']),
};
