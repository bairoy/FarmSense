/**
 * The FarmSense mark.
 *
 * A wheat/rice ear whose grains double as signal bars - the product reads a
 * crop the way an instrument reads a signal, and the mark says that in one
 * shape. Drawn as inline SVG so it stays crisp at any size, inherits the text
 * colour, and costs no network request on a 2G connection in a field.
 */

export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label="FarmSense"
    >
      <path
        d="M16 30V13"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.55"
      />
      {[
        { y: 4.2, w: 4.6 },
        { y: 9.4, w: 6.1 },
        { y: 14.6, w: 7.4 },
      ].map(({ y, w }) => (
        <g key={y}>
          <path
            d={`M15.1 ${y + 5.6}C15.1 ${y + 2.2} 13.4 ${y} ${16 - w} ${y - 0.4}C${
              16 - w
            } ${y + 3.4} 13.1 ${y + 5.6} 15.1 ${y + 5.6}Z`}
            fill="currentColor"
          />
          <path
            d={`M16.9 ${y + 5.6}C16.9 ${y + 2.2} 18.6 ${y} ${16 + w} ${y - 0.4}C${
              16 + w
            } ${y + 3.4} 18.9 ${y + 5.6} 16.9 ${y + 5.6}Z`}
            fill="currentColor"
          />
        </g>
      ))}
    </svg>
  );
}

export function Wordmark({
  className = "",
  markClassName = "h-7 w-7",
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className={`${markClassName} text-field-600 shrink-0`} />
      <span className="font-display text-xl font-extrabold tracking-tight text-field-900">
        Farm<span className="text-field-600">Sense</span>
      </span>
    </span>
  );
}
