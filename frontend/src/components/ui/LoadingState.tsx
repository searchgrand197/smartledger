import { Box, CircularProgress, Typography } from "@mui/material";

interface Props {
  message?: string;
  minHeight?: number;
}

export default function LoadingState({ message = "Loading…", minHeight = 200 }: Props) {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight={minHeight}
      gap={2}
      className="loading-state"
    >
      <CircularProgress size={40} />
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
}
