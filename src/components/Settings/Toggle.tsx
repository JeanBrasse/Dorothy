interface ToggleProps {
  enabled: boolean;
  onChange: () => void;
  disabled?: boolean;
}

/** Hard-cornered switch: tangerine when on, flat surface when off. */
export const Toggle = ({ enabled, onChange, disabled }: ToggleProps) => (
  <button
    role="switch"
    aria-checked={enabled}
    onClick={onChange}
    disabled={disabled}
    className={`w-10 h-5 border transition-colors relative shrink-0 ${
      enabled ? 'bg-primary border-primary' : 'bg-secondary border-border'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span
      className={`block w-3.5 h-3.5 transition-all absolute top-[2px] ${
        enabled ? 'bg-primary-foreground left-[22px]' : 'bg-muted-foreground left-[2px]'
      }`}
    />
  </button>
);
