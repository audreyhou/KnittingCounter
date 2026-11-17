import type { ReactNode, SVGProps } from 'react'

const paths: Record<string, ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.2 1.2" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.2-1.2" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  comment: <path d="M4 5h16v11H9l-5 4z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  pause: <path d="M8 5.5v13M16 5.5v13" />,
  mic: (
    <>
      <rect x="9" y="3.5" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" />
      <path d="M4.5 15v4.5h15V15" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" />
      <path d="M4.5 15v4.5h15V15" />
    </>
  ),
  file: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </>
  ),
  library: (
    <>
      <path d="M4 4.5h4v15H4zM10 4.5h4v15h-4z" />
      <path d="M16 5.2l3.8-1 3.2 14.7-3.8 1z" transform="translate(-2.5 0.3)" />
    </>
  ),
  projects: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M6 9.5c3 0 8 3 10 8M8.5 5.5c3 1 7.5 5 8 10M5 13c2.5 0 5 1.5 6.5 5" />
    </>
  ),
  tools: (
    <>
      <path d="M14.5 6.5a4 4 0 0 0-5.3 5.2L4 17l3 3 5.3-5.2a4 4 0 0 0 5.2-5.3L15 12l-3-3z" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  left: <path d="M15 6l-6 6 6 6" />,
  right: <path d="M9 6l6 6-6 6" />,
  up: <path d="M6 15l6-6 6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  trash: (
    <>
      <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" />
    </>
  ),
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="18.5" cy="12" r="1.2" />
    </>
  ),
  hand: (
    <path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10V5.5a1.5 1.5 0 0 1 3 0V13c0 4-2.5 7-6 7-2.5 0-4-1.2-5.3-3.3L3.8 13.5a1.4 1.4 0 0 1 2.3-1.6L8 14" />
  ),
  rowbar: (
    <>
      <path d="M4 5h16M4 19h16" />
      <rect x="3" y="9.5" width="18" height="5" rx="1.5" />
    </>
  ),
  highlight: (
    <>
      <path d="M14.5 4.5l5 5-7.5 7.5h-5v-5z" />
      <path d="M4 20.5h16" />
    </>
  ),
  marker: (
    <>
      <path d="M4 17c3-6 6-9 8-9s1 4 3 4 3-3 5-5" strokeWidth="3.2" />
    </>
  ),
  pen: <path d="M4 20l1-4.5L16.5 4a2 2 0 0 1 3 3L8 18.5zM14.5 6l3 3" />,
  note: (
    <>
      <path d="M5 4h14v11l-5 5H5z" />
      <path d="M14 20v-5h5M8.5 9h7M8.5 12.5h4" />
    </>
  ),
  text: <path d="M5 6V4.5h14V6M12 4.5v15M9 19.5h6" />,
  eraser: (
    <>
      <path d="M8.5 19.5L3.8 14.8a1.8 1.8 0 0 1 0-2.6l8.4-8.4a1.8 1.8 0 0 1 2.6 0l5 5a1.8 1.8 0 0 1 0 2.6l-8.3 8.1z" />
      <path d="M8.5 9.5l6 6M8.5 19.5h11" />
    </>
  ),
  bookmark: <path d="M6.5 3.5h11v17l-5.5-4-5.5 4z" />,
  pin: (
    <>
      <path d="M9 3.5h6l-1 5 3.5 3.5h-11L10 8.5z" />
      <path d="M12 12v8.5" />
    </>
  ),
  chart: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" />
      <path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17" />
    </>
  ),
  undo: <path d="M8.5 5L4 9.5 8.5 14M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3" />,
  zoomIn: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L20.5 20.5M10.5 7.5v6M7.5 10.5h6" />
    </>
  ),
  zoomOut: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L20.5 20.5M7.5 10.5h6" />
    </>
  ),
  fit: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />,
  sliders: (
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L20.5 20.5" />
    </>
  ),
  repeat: (
    <>
      <path d="M17 3.5l3 3-3 3" />
      <path d="M4 11.5v-1a4 4 0 0 1 4-4h12M7 20.5l-3-3 3-3" />
      <path d="M20 12.5v1a4 4 0 0 1-4 4H4" />
    </>
  ),
  reset: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.3-5.4" />
      <path d="M4.5 4.5v4h4" />
    </>
  ),
  list: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.5M4.5 12h.5M4.5 18h.5" />,
  stitch: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" />
      <rect x="9.5" y="9.5" width="5" height="5" fill="currentColor" stroke="none" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.5v.5" />
    </>
  ),
  star: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
    </>
  ),
}

export type IconName = keyof typeof paths

export function Icon({ name, size = 22, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {paths[name]}
    </svg>
  )
}
