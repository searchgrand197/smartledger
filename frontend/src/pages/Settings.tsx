import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  TextField,
  Button,
  Stack,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SaveIcon from "@mui/icons-material/Save";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import toast from "react-hot-toast";
import { businessApi } from "@/api/services";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useThemeStore } from "@/store/themeStore";
import { queryClient } from "@/lib/queryClient";
import { PageShell, PageHeader, ContentCard, LoadingState } from "@/components/ui";

export default function Settings() {
  const organizationId = useAuthStore((s) => s.organizationId);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const loadStore = useSettingsStore((s) => s.load);
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["settings", organizationId],
    queryFn: () => businessApi.settings().then((r) => r.data),
    enabled: organizationId != null,
  });
  const [form, setForm] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () => businessApi.updateSettings(form),
    onSuccess: async () => {
      toast.success("Settings saved");
      await refetch();
      await loadStore(organizationId);
      await refreshMe();
      queryClient.invalidateQueries({ queryKey: ["settings", organizationId] });
    },
    onError: () => toast.error("Could not save settings"),
  });

  const set = (key: string, value: string) => setForm({ ...form, [key]: value });

  const field = (key: string, label: string, multiline = false) =>
    multiline ? (
      <TextField
        key={key}
        label={label}
        multiline
        rows={3}
        fullWidth
        value={String(form[key] || "")}
        onChange={(e) => set(key, e.target.value)}
      />
    ) : (
      <TextField
        key={key}
        label={label}
        fullWidth
        value={String(form[key] || "")}
        onChange={(e) => set(key, e.target.value)}
      />
    );

  if (isLoading) {
    return (
      <PageShell>
        <LoadingState />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Settings"
        subtitle="For any shop type — prices on bills are all-inclusive"
        action={{
          label: "Save",
          onClick: () => save.mutate(),
          icon: <SaveIcon />,
        }}
      />
      <Stack spacing={2} maxWidth={720} sx={{ width: "100%" }}>
        <ContentCard title="Appearance" subtitle="Teal theme with light or dark mode">
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
            <Typography variant="body2" color="text.secondary">
              Choose how the app looks on this device. Preference is saved locally.
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={themeMode}
              onChange={(_, value) => value && setThemeMode(value)}
              aria-label="theme mode"
            >
              <ToggleButton value="light" aria-label="light mode">
                <LightModeIcon sx={{ mr: 0.75, fontSize: 18 }} />
                Light
              </ToggleButton>
              <ToggleButton value="dark" aria-label="dark mode">
                <DarkModeIcon sx={{ mr: 0.75, fontSize: 18 }} />
                Dark
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </ContentCard>

        <ContentCard title="Shop profile" subtitle="Shown on bills and reports">
          <Stack spacing={2}>
            {field("owner_name", "Name")}
            {field("business_name", "Shop")}
            {field("address", "Address", true)}
            {field("phone", "Mobile Number")}
            {field("factory_details", "Factory / Details", true)}
          </Stack>
        </ContentCard>

        <Accordion elevation={0} sx={{ border: "1px solid var(--color-border)", borderRadius: 2, "&:before": { display: "none" } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={600}>Login screen text</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              {field("home_subtitle", "Home subtitle")}
              {field("wholesale_option_title", "Wholesale option title")}
              {field("wholesale_option_desc", "Wholesale description", true)}
              {field("customer_option_title", "Customer option title")}
              {field("customer_option_desc", "Customer description", true)}
            </Stack>
          </AccordionDetails>
        </Accordion>

        <ContentCard title="Invoice footer" subtitle="Printed at bottom of bills">
          {field("invoice_footer", "Footer message", true)}
        </ContentCard>

        <Button variant="contained" className="gradient-button" startIcon={<SaveIcon />} onClick={() => save.mutate()}>
          Save settings
        </Button>
      </Stack>
    </PageShell>
  );
}
