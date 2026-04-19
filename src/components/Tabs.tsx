interface TabsProps<T extends string> {
  tabs: Array<{ id: T; label: string; disabled?: boolean; hint?: string }>;
  active: T;
  onChange: (id: T) => void;
}

export function Tabs<T extends string>({ tabs, active, onChange }: TabsProps<T>) {
  return (
    <div
      role="tablist"
      className="mb-6 flex flex-wrap gap-1 border-b border-neutral-200 dark:border-neutral-800"
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={active === t.id}
          aria-disabled={t.disabled}
          disabled={t.disabled}
          onClick={() => onChange(t.id)}
          className={[
            '-mb-px border-b-2 px-3 py-2 text-sm transition',
            active === t.id
              ? 'border-accent font-medium text-accent'
              : 'border-transparent text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100',
            t.disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
          ].join(' ')}
          title={t.hint}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
