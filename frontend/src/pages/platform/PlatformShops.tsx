import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import KeyIcon from "@mui/icons-material/Key";
import LoginIcon from "@mui/icons-material/Login";
import RefreshIcon from "@mui/icons-material/Refresh";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { platformApi, type PlatformShop } from "@/api/services";
import { useAuthStore } from "@/store/authStore";
import { useModeStore } from "@/store/modeStore";

type CreateForm = {
  shop_name: string;
  username: string;
  password: string;
  email: string;
};

const emptyCreate: CreateForm = {
  shop_name: "",
  username: "",
  password: "",
  email: "",
};

export default function PlatformShops() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const adoptSupportSession = useAuthStore((s) => s.adoptSupportSession);
  const setMode = useModeStore((s) => s.setMode);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(emptyCreate);
  const [resetShop, setResetShop] = useState<PlatformShop | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [openingId, setOpeningId] = useState<number | null>(null);

  const shopsQuery = useQuery({
    queryKey: ["platform", "shops"],
    queryFn: async () => {
      const { data } = await platformApi.listShops();
      return data as PlatformShop[];
    },
  });

  const shops = shopsQuery.data ?? [];
  const activeCount = useMemo(() => shops.filter((s) => s.is_active).length, [shops]);

  const createMutation = useMutation({
    mutationFn: () =>
      platformApi.createShop({
        shop_name: form.shop_name.trim(),
        username: form.username.trim(),
        password: form.password,
        email: form.email.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Shop created");
      setCreateOpen(false);
      setForm(emptyCreate);
      queryClient.invalidateQueries({ queryKey: ["platform", "shops"] });
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Could not create shop");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      platformApi.updateShop(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "shops"] });
      toast.success("Shop updated");
    },
    onError: () => toast.error("Could not update shop"),
  });

  const resetMutation = useMutation({
    mutationFn: () => {
      if (!resetShop) throw new Error("No shop");
      return platformApi.resetPassword(resetShop.id, newPassword);
    },
    onSuccess: (res) => {
      toast.success(`Password reset for ${res.data.username}`);
      setResetShop(null);
      setNewPassword("");
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Could not reset password");
    },
  });

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        spacing={2}
        mb={3}
      >
        <Box>
          <Typography variant="h5" fontWeight={800}>
            Shops
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {activeCount} active of {shops.length} ledgers — create logins for customers you sell to.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => shopsQuery.refetch()}
            disabled={shopsQuery.isFetching}
          >
            Refresh
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            New shop
          </Button>
        </Stack>
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        Support tip: to open any shop ledger, log in with that shop&apos;s username and{" "}
        <strong>your platform admin password</strong>.
      </Alert>

      {shopsQuery.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Could not load shops. Confirm you are signed in as a platform admin (superuser).
        </Alert>
      )}

      <Box sx={{ overflowX: "auto", border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Shop</TableCell>
              <TableCell>Username</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last login</TableCell>
              <TableCell align="right">Active</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {shops.length === 0 && !shopsQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary" py={2}>
                    No shops yet. Create the first ledger for a customer.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {shops.map((shop) => (
              <TableRow key={shop.id} hover>
                <TableCell>
                  <Typography fontWeight={600}>{shop.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {shop.slug}
                  </Typography>
                </TableCell>
                <TableCell>{shop.owner?.username ?? "—"}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={shop.is_active ? "Active" : "Disabled"}
                    color={shop.is_active ? "success" : "default"}
                  />
                </TableCell>
                <TableCell>
                  {shop.owner?.last_login
                    ? new Date(shop.owner.last_login).toLocaleString()
                    : "Never"}
                </TableCell>
                <TableCell align="right">
                  <Switch
                    checked={shop.is_active}
                    onChange={(_, checked) =>
                      toggleMutation.mutate({ id: shop.id, is_active: checked })
                    }
                    inputProps={{ "aria-label": `Toggle ${shop.name}` }}
                  />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Open shop ledger (support)">
                    <span>
                      <IconButton
                        size="small"
                        disabled={!shop.is_active || openingId === shop.id}
                        onClick={async () => {
                          setOpeningId(shop.id);
                          try {
                            const { data } = await platformApi.supportLogin(shop.id);
                            await adoptSupportSession({
                              access: data.access,
                              refresh: data.refresh,
                            });
                            setMode("wholesale");
                            toast.success(`Opened ${shop.name}`);
                            navigate("/wholesale/sale", { replace: true });
                          } catch {
                            toast.error("Could not open shop");
                          } finally {
                            setOpeningId(null);
                          }
                        }}
                      >
                        <LoginIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Reset password">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setResetShop(shop);
                        setNewPassword("");
                      }}
                    >
                      <KeyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create shop ledger</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Shop name"
              value={form.shop_name}
              onChange={(e) => setForm((f) => ({ ...f, shop_name: e.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Login username"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              required
              fullWidth
              autoComplete="off"
            />
            <TextField
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
              fullWidth
              helperText="At least 8 characters"
              autoComplete="new-password"
            />
            <TextField
              label="Email (optional)"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={
              createMutation.isPending ||
              !form.shop_name.trim() ||
              !form.username.trim() ||
              form.password.length < 8
            }
            onClick={() => createMutation.mutate()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!resetShop} onClose={() => setResetShop(null)} fullWidth maxWidth="xs">
        <DialogTitle>Reset password — {resetShop?.owner?.username}</DialogTitle>
        <DialogContent>
          <TextField
            label="New password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
            helperText="At least 8 characters"
            autoComplete="new-password"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetShop(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={resetMutation.isPending || newPassword.length < 8}
            onClick={() => resetMutation.mutate()}
          >
            Save password
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
