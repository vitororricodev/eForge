export function Brand({
  compact = false,
  surface = "dark",
}: {
  compact?: boolean;
  surface?: "dark" | "light";
}) {
  const file = compact
    ? "eforge-simbolo-roxo.svg"
    : surface === "light"
      ? "eforge-logo-horizontal-preto.svg"
      : "eforge-logo-header.svg";

  return (
    <span className={`eforge-brand${compact ? " eforge-brand-compact" : ""}`}>
      <img
        src={`/brand/forjado/${file}`}
        alt="eForge"
        width={compact ? 360 : 1000}
        height={compact ? 360 : 260}
        decoding="async"
      />
    </span>
  );
}
