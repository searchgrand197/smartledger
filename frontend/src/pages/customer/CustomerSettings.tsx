import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import { PageShell, PageHeader, ContentCard, LoadingState } from "@/components/ui";
import { usePortalDashboard } from "@/hooks/usePortalDashboard";
import axios from "axios";
import { useEffect, useState } from "react";

export default function CustomerSettings() {
  const { data, isLoading, error, refetch } = usePortalDashboard();
  const [shop, setShop] = useState({ business_name: "", phone: "", address: "" });

  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_API_URL || "/api"}/business/settings/public/`)
      .then((r) =>
        setShop({
          business_name: r.data.business_name || "",
          phone: r.data.phone || "",
          address: r.data.address || "",
        })
      )
      .catch(() => {});
  }, []);

  if (isLoading) {
    return (
      <PageShell>
        <LoadingState />
      </PageShell>
    );
  }

  if (error || !data) {
    return (
      <PageShell>
        <Box textAlign="center" py={4}>
          <Button variant="contained" className="gradient-button" onClick={() => refetch()}>
            Retry
          </Button>
        </Box>
      </PageShell>
    );
  }

  const c = data.customer;

  return (
    <PageShell>
      <PageHeader title="Settings" subtitle="Your account & shop contact (view only)" />
      <Stack spacing={2} maxWidth={640}>
        <ContentCard title="My account">
          <Stack spacing={2}>
            <TextField label="Shop name" fullWidth value={c?.shop_name || ""} disabled />
            <TextField label="Owner name" fullWidth value={c?.owner_name || ""} disabled />
            <TextField label="Customer code" fullWidth value={c?.code || ""} disabled />
            <TextField label="Phone" fullWidth value={c?.phone || ""} disabled />
            <TextField label="Area" fullWidth value={c?.area || ""} disabled />
            <TextField label="Address" fullWidth multiline rows={2} value={c?.address || ""} disabled />
            <TextField label="Credit limit" fullWidth value={String(c?.credit_limit ?? "")} disabled />
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
            To change details, contact the shop. Customer portal is view-only.
          </Typography>
        </ContentCard>
        <ContentCard title="Shop contact">
          <Stack spacing={2}>
            <TextField label="Shop" fullWidth value={shop.business_name} disabled />
            <TextField label="Phone" fullWidth value={shop.phone} disabled />
            <TextField label="Address" fullWidth multiline rows={2} value={shop.address} disabled />
          </Stack>
        </ContentCard>
      </Stack>
    </PageShell>
  );
}
