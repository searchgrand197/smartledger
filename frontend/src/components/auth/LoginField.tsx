import { Box, TextField, Typography, TextFieldProps } from "@mui/material";

interface LoginFieldProps extends Omit<TextFieldProps, "label"> {
  label: string;
}

/** Login input with label always visible above the field (no floating label clip). */
export default function LoginField({ label, ...props }: LoginFieldProps) {
  return (
    <Box className="login-field">
      <Typography
        component="label"
        variant="caption"
        fontWeight={700}
        color="text.secondary"
        letterSpacing={0.6}
        sx={{ display: "block", mb: 0.75, lineHeight: 1.4 }}
      >
        {label}
      </Typography>
      <TextField
        {...props}
        fullWidth
        size="small"
        variant="outlined"
        hiddenLabel
        sx={{
          "& .MuiOutlinedInput-root": {
            bgcolor: "#ffffff",
            borderRadius: "var(--radius-sm)",
            "& input": {
              color: "#0f2420",
            },
          },
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "var(--color-field-border, #94a3b8)",
          },
          ...props.sx,
        }}
      />
    </Box>
  );
}
