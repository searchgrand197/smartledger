/** MUI v6 + native number input: step must be on htmlInput or spinners jump by 1. */
export function decimalNumberFieldProps(options?: { min?: number; max?: number; step?: string }) {
  const min = options?.min ?? 0;
  const step = options?.step ?? "0.01";
  const max = options?.max;
  const htmlInput: Record<string, string | number> = { min, step, inputMode: "decimal" };
  const inputProps: Record<string, string | number> = { min, step };
  if (max != null) {
    htmlInput.max = max;
    inputProps.max = max;
  }
  return { inputProps, slotProps: { htmlInput } };
}

export function integerNumberFieldProps(min = 0, max?: number) {
  const htmlInput: Record<string, string | number> = { min, step: 1, inputMode: "numeric" };
  const inputProps: Record<string, string | number> = { min, step: 1 };
  if (max != null) {
    htmlInput.max = max;
    inputProps.max = max;
  }
  return { inputProps, slotProps: { htmlInput } };
}

export function parseDecimalInput(raw: string): number {
  if (raw === "" || raw === "-") return 0;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}
