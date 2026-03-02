import { Check } from 'lucide-react';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
  labelPlacement?: 'left' | 'right';
}

function Checkbox({
  checked,
  onChange,
  label,
  className = '',
  disabled = false,
  labelPlacement = 'left',
}: CheckboxProps) {
  const labelNode = label ? (
    <span className={`${disabled ? 'text-gray-400' : 'text-gray-700'} text-sm`}>{label}</span>
  ) : null;

  return (
    <label className={`flex items-center gap-3 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${className}`}>
      {labelPlacement === 'left' && labelNode}
      <button
        type="button"
        aria-pressed={checked}
        aria-label={label}
        onClick={(e) => {
          if (disabled) {
            return;
          }
          e.preventDefault();
          onChange(!checked);
        }}
        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#7678ee]/40 ${
          disabled
            ? checked
              ? 'bg-gray-300 border-gray-300'
              : 'bg-gray-100 border-gray-200'
            :
          checked
            ? 'bg-[#7678ee] border-[#7678ee]'
            : 'bg-white border-gray-300 hover:border-gray-400'
        }`}
        disabled={disabled}
      >
        {checked && <Check size={14} className="text-white" strokeWidth={3} />}
      </button>
      {labelPlacement === 'right' && labelNode}
    </label>
  );
}

export default Checkbox;
