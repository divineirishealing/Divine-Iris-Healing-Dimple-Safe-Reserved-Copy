/** Default cover illustration when no cover image is uploaded. */
export default function BlogJournalCupIcon({ className = '', stroke = '#b4a8d8' }) {
  return (
    <svg
      viewBox="0 0 120 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <circle cx="52" cy="18" r="5" stroke={stroke} strokeWidth="1.5" />
      <circle cx="64" cy="10" r="4" stroke={stroke} strokeWidth="1.5" />
      <circle cx="74" cy="20" r="4.5" stroke={stroke} strokeWidth="1.5" />
      <path
        d="M38 42 L38 108 Q38 118 48 118 L72 118 Q82 118 82 108 L82 42 Z"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M82 52 C98 52 104 62 104 72 C104 82 98 92 82 92"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
