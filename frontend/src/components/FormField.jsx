/** Render a reusable labelled input with associated validation feedback. */
import PropTypes from 'prop-types';

/**
 * Keep required and error states visible to keyboard and screen-reader users.
 * @param {object} props Label, input identity, value and change handler.
 * @returns {JSX.Element} Accessible form field.
 */
export function FormField({ id, label, type = 'text', value, onChange, error = '', autoComplete }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        required
        aria-required="true"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={'w-full rounded-lg border bg-white px-3 py-3 text-slate-800 outline-none ' +
          'focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ' +
          (error ? 'border-red-600' : 'border-slate-300')}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

FormField.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  type: PropTypes.string,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  error: PropTypes.string,
  autoComplete: PropTypes.string,
};
