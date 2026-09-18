import { useLocation } from "react-router-dom";
import PortalLogin from "@/components/auth/PortalLogin";

export default function Login() {
  const location = useLocation();
  const isCustomer = location.pathname.includes("customer");
  return <PortalLogin defaultRole={isCustomer ? "customer" : "wholesale"} />;
}
