/** Inline SVG icons (no emoji-as-UI). All 24-unit viewBoxes, stroke-based. */
type P = { size?: number; className?: string };

const base = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className,
  "aria-hidden": true,
});

export const PlusIcon = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const MinusIcon = ({ size = 14, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M5 12h14" />
  </svg>
);
export const CheckIcon = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
export const GearIcon = ({ size = 20, className }: P) => (
  <svg {...base(size, className)} strokeWidth={1.8}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);
export const ArrowIcon = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const BagIcon = ({ size = 28, className }: P) => (
  <svg {...base(size, className)} strokeWidth={1.6}>
    <path d="M6 8h12l1 13H5L6 8z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </svg>
);
export const ImageIcon = ({ size = 22, className }: P) => (
  <svg {...base(size, className)} strokeWidth={1.6}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <circle cx="8.5" cy="10" r="1.5" />
    <path d="M21 16l-5-5-8 8" />
  </svg>
);
export const SparkIcon = ({ size = 16, className }: P) => (
  <svg {...base(size, className)} strokeWidth={1.8}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
    <path d="M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16z" />
  </svg>
);
export const ExternalIcon = ({ size = 14, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M14 4h6v6M20 4l-9 9M18 13v6H5V6h6" />
  </svg>
);
export const Spinner = ({ size = 16, className }: P) => (
  <svg {...base(size, `animate-spin ${className ?? ""}`)} strokeWidth={2.2}>
    <path d="M12 3a9 9 0 1 0 9 9" />
  </svg>
);
