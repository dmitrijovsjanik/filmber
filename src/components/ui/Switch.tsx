'use client';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Switch({
  checked,
  onChange,
  disabled = false,
  size = 'md',
}: SwitchProps) {
  const sizes = {
    sm: { track: 'h-5 w-9', thumb: 'h-3.5 w-3.5', translate: 'translate-x-4' },
    md: { track: 'h-6 w-11', thumb: 'h-4 w-4', translate: 'translate-x-5' },
    lg: { track: 'h-7 w-14', thumb: 'h-5 w-5', translate: 'translate-x-7' },
  };

  const { track, thumb, translate } = sizes[size];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex shrink-0 cursor-pointer items-center rounded-full
        transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2
        focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-gray-900
        ${track}
        ${checked ? 'bg-emerald-500' : 'bg-gray-600'}
        ${disabled ? 'cursor-not-allowed opacity-50' : ''}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block transform rounded-full bg-white
          shadow-lg ring-0 transition duration-200 ease-in-out
          ${thumb}
          ${checked ? translate : 'translate-x-1'}
        `}
      />
    </button>
  );
}
