/**
 * Shared masthead: RACK+ with Build or Edit on the line below (same treatment as legacy Fox subtitle).
 */
export function AppHeaderBrand({ mode }: { mode: 'build' | 'edit' }) {
  const label = mode === 'build' ? 'Build' : 'Edit';
  return (
    <div>
      <div className="text-3xl font-black tracking-tight text-white">RACK+</div>
      <p className="mt-1.5 text-base font-semibold uppercase tracking-[0.18em] text-blue-100">
        {label}
      </p>
    </div>
  );
}
