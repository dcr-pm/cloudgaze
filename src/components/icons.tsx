type P = { className?: string };
const base = {
  viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true,
};

export const MicIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);
export const CameraIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);
export const SendIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M12 19V5M6 11l6-6 6 6" /></svg>
);
export const CheckIcon = ({ className }: P) => (
  <svg {...base} strokeWidth={2.6} className={className}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
export const CloseIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const PlusIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M12 5v14M5 12h14" /></svg>
);
export const BackIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M15 5l-7 7 7 7" /></svg>
);
export const PeopleIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 19c.6-3 3-4.5 6-4.5s5.400 1.500 6 4.500M16 5.200a3.200 3.200 0 0 1 0 5.800M18 14.800c1.700.600 2.700 2 3 4.200" />
  </svg>
);
export const ReceiptIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6" />
  </svg>
);
