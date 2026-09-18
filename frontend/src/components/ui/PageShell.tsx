import { Box } from "@mui/material";

interface Props {
  children: React.ReactNode;
  className?: string;
}

/** Standard page wrapper with enter animation */
export default function PageShell({ children, className = "" }: Props) {
  return <Box className={`page-shell animate-fade-in-up ${className}`.trim()}>{children}</Box>;
}
