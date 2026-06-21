export default function CountdownAction({
  label,
  countdown,
  cancelLabel = 'Cancel',
  onCancel,
  compact = false,
}) {
  return (
    <div className={`flex items-center gap-2 ${compact ? '' : 'rounded-xl bg-card-elevated/70 px-3 py-2'}`}>
      <span className="text-xs font-bold text-text-main/85 animate-pulse">
        {label} in {countdown}...
      </span>
      <button
        type="button"
        onClick={onCancel}
        className="h-8 rounded bg-card-elevated px-3 text-[11px] font-bold text-text-muted transition active:scale-95 hover:text-text-main"
      >
        {cancelLabel}
      </button>
    </div>
  );
}
