import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Collapse,
  Fade,
  Stack,
  Typography,
} from "@mui/material";
import StorefrontIcon from "@mui/icons-material/Storefront";
import PersonIcon from "@mui/icons-material/Person";
import LoginIcon from "@mui/icons-material/Login";
import axios from "axios";
import toast from "react-hot-toast";
import { APP_DEFAULTS, DEFAULT_LOGIN, SOFTWARE_NAME } from "@/config/app";
import { useAuthStore } from "@/store/authStore";
import { useCustomerPortalStore } from "@/store/customerPortalStore";
import { useModeStore } from "@/store/modeStore";
import RoleSelectButton from "@/components/ui/RoleSelectButton";
import LoginField from "@/components/auth/LoginField";

const BRAND_LOGO = "/brand/garg-logo.png";

type LoginRole = "wholesale" | "customer";

interface HomeConfig {
  business_name?: string;
  home_subtitle: string;
  wholesale_option_title: string;
  wholesale_option_desc: string;
  customer_option_title: string;
  customer_option_desc: string;
}

interface Props {
  defaultRole?: LoginRole;
}

export default function PortalLogin({ defaultRole = "wholesale" }: Props) {
  const navigate = useNavigate();
  const setMode = useModeStore((s) => s.setMode);
  const authLogin = useAuthStore((s) => s.login);
  const portalLogin = useCustomerPortalStore((s) => s.login);

  const [role, setRole] = useState<LoginRole>(defaultRole === "customer" ? "customer" : "wholesale");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [businessName, setBusinessName] = useState("Garg Sanitary Hardware & Electronics");
  const [config, setConfig] = useState<HomeConfig>({
    home_subtitle: APP_DEFAULTS.homeSubtitle,
    wholesale_option_title: APP_DEFAULTS.wholesaleTitle,
    wholesale_option_desc: APP_DEFAULTS.wholesaleDesc,
    customer_option_title: APP_DEFAULTS.customerTitle,
    customer_option_desc: APP_DEFAULTS.customerDesc,
  });

  const [username, setUsername] = useState(DEFAULT_LOGIN.username);
  const [password, setPassword] = useState("");

  useEffect(() => {
    setMounted(true);
    const apiBase = import.meta.env.VITE_API_URL || "/api";
    axios
      .get(apiBase + "/business/settings/public/")
      .then((r) => {
        setConfig(r.data);
        if (r.data.business_name) setBusinessName(r.data.business_name);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setRole(defaultRole === "customer" ? "customer" : "wholesale");
  }, [defaultRole]);

  const roleLabel = role === "wholesale" ? config.wholesale_option_title : config.customer_option_title;

  const handleWholesaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authLogin(username, password);
      setMode("wholesale");
      toast.success("Welcome!");
      navigate("/wholesale/sale");
    } catch {
      toast.error("Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error("Enter username and password");
      return;
    }
    setLoading(true);
    try {
      await portalLogin(username, password);
      setMode("customer");
      toast.success("Welcome!");
      navigate("/customer");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || "Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="login-page">
      <Fade in={mounted} timeout={600}>
        <Card className="login-shell animate-scale-in" elevation={0}>
          <Box className="login-brand-panel">
            <Box className="login-brand-inner animate-fade-in">
              <Box className="login-logo-wrap">
                <img src={BRAND_LOGO} alt={businessName} className="login-logo" />
              </Box>
              <Typography className="login-brand-title">{businessName}</Typography>
              <Typography className="login-brand-tagline">
                Sanitary | Hardware | Electronics
              </Typography>
              <Box className="login-brand-badge">Est. 1995</Box>
              <Typography className="login-brand-powered">
                Powered by {SOFTWARE_NAME}
              </Typography>
            </Box>
          </Box>

          <CardContent className="login-form-panel animate-fade-in-up animate-delay-1">
            <Typography variant="h6" fontWeight={800} color="primary.dark" gutterBottom>
              Welcome back
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
              {config.home_subtitle || APP_DEFAULTS.homeSubtitle}
            </Typography>

            <Typography variant="caption" fontWeight={700} color="text.secondary" letterSpacing={1}>
              LOGIN AS
            </Typography>
            <Box
              display="grid"
              gridTemplateColumns={{ xs: "1fr", sm: "1fr 1fr" }}
              gap={1.5}
              sx={{ mt: 1, mb: 2 }}
            >
              <RoleSelectButton
                selected={role === "wholesale"}
                icon={<StorefrontIcon />}
                label={config.wholesale_option_title}
                onClick={() => setRole("wholesale")}
              />
              <RoleSelectButton
                selected={role === "customer"}
                icon={<PersonIcon />}
                label={config.customer_option_title}
                onClick={() => setRole("customer")}
              />
            </Box>

            <Collapse in={role === "wholesale"} timeout={350} unmountOnExit>
              <Box component="form" onSubmit={handleWholesaleSubmit}>
                <Stack spacing={2}>
                  <LoginField
                    label="USERNAME"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                  />
                  <LoginField
                    label="PASSWORD"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <Button
                    type="submit"
                    fullWidth
                    size="large"
                    className="gradient-button"
                    startIcon={<LoginIcon />}
                    disabled={loading}
                  >
                    {loading ? "Signing in..." : "Sign In - " + roleLabel}
                  </Button>
                </Stack>
                <Typography variant="caption" color="text.secondary" display="block" textAlign="center" mt={2}>
                  {config.wholesale_option_desc}
                </Typography>
              </Box>
            </Collapse>

            <Collapse in={role === "customer"} timeout={350} unmountOnExit>
              <Box component="form" onSubmit={handleCustomerLogin}>
                <Stack spacing={2}>
                  <LoginField
                    label="USERNAME"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                  />
                  <LoginField
                    label="PASSWORD"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <Button
                    type="submit"
                    fullWidth
                    size="large"
                    className="gradient-button"
                    startIcon={<LoginIcon />}
                    disabled={loading}
                  >
                    {loading ? "Signing in..." : "Sign In - " + roleLabel}
                  </Button>
                </Stack>
                <Typography variant="caption" color="text.secondary" display="block" textAlign="center" mt={2}>
                  {config.customer_option_desc}
                </Typography>
              </Box>
            </Collapse>
          </CardContent>
        </Card>
      </Fade>
    </Box>
  );
}
