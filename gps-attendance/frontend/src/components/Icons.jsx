export function SvgIcon({ className, children }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

export function UsersIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </SvgIcon>
  )
}

export function ClipboardIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 4h6v4H9V4Z" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </SvgIcon>
  )
}

export function ChartBarIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M12 20V10" />
      <path d="M18 20V4" />
      <path d="M6 20v-6" />
      <path d="M4 20h16" />
    </SvgIcon>
  )
}

export function ChartPieIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M21.21 15.89A9 9 0 1 1 8.11 2.79" />
      <path d="M12 12V3.5" />
      <path d="M12 12h8.5" />
    </SvgIcon>
  )
}

export function CheckCircleIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M9 12l2 2 4-4" />
      <circle cx="12" cy="12" r="9" />
    </SvgIcon>
  )
}

export function XCircleIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M9.5 9.5 14.5 14.5" />
      <path d="M14.5 9.5 9.5 14.5" />
      <circle cx="12" cy="12" r="9" />
    </SvgIcon>
  )
}

export function ClockIcon(props) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </SvgIcon>
  )
}

export function RefreshIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 13a8.1 8.1 0 0 0 15.5 2" />
      <path d="M20 7v4h-4" />
      <path d="M4 17v-4h4" />
    </SvgIcon>
  )
}

export function LocationMarkerIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M12 21s7-4.35 7-10A7 7 0 0 0 5 11c0 5.65 7 10 7 10Z" />
      <circle cx="12" cy="11" r="3" />
    </SvgIcon>
  )
}

export function SignalIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M4 20h16" />
      <path d="M7 17v-4" />
      <path d="M12 17v-8" />
      <path d="M17 17v-2" />
    </SvgIcon>
  )
}

export function WarningIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </SvgIcon>
  )
}

export function CameraIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z" />
      <circle cx="12" cy="13" r="4" />
    </SvgIcon>
  )
}

export function CloseIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </SvgIcon>
  )
}

export function CalendarIcon(props) {
  return (
    <SvgIcon {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
    </SvgIcon>
  )
}

export function HandshakeIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M2 12 6 8l4 4" />
      <path d="M22 12l-4-4-4 4" />
      <path d="M8 16 12 12 16 16" />
      <path d="M12 12v8" />
    </SvgIcon>
  )
}

export function PlusIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </SvgIcon>
  )
}

export function ShieldIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </SvgIcon>
  )
}

export function DocumentIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
      <path d="M14 2v6h6" />
      <path d="M9 14h6" />
      <path d="M9 18h6" />
    </SvgIcon>
  )
}

export function TrophyIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M4 7h3" />
      <path d="M17 7h3" />
      <path d="M6 7a6 6 0 0 0 12 0" />
      <path d="M10 21h4" />
      <path d="M12 7v14" />
      <path d="M7 7v3a5 5 0 0 0 10 0V7" />
    </SvgIcon>
  )
}

export function StarIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="m12 2 2.9 6.76L22 9.24l-5 4.87L18.8 22 12 18.8 5.2 22 7 14.11 2 9.24l6.1-.48L12 2Z" />
    </SvgIcon>
  )
}
