import { useEffect } from "react";
import { Box, CircularProgress } from "@mui/material";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useCustomerPortalStore } from "@/store/customerPortalStore";
import WholesaleLayout from "@/components/layout/WholesaleLayout";
import CustomerPortalLayout from "@/components/layout/CustomerPortalLayout";
import Home from "@/pages/Home";
import PortalSwitch from "@/pages/PortalSwitch";
import Sale from "@/pages/Sale";
import Parties from "@/pages/Parties";
import Inventory from "@/pages/Inventory";
import StockManagement from "@/pages/StockManagement";
import CustomerProfile from "@/pages/CustomerProfile";
import Settings from "@/pages/Settings";
import SimpleBilling from "@/pages/SimpleBilling";
import WhatsAppConnect from "@/pages/WhatsAppConnect";
import QuickSaleHistory from "@/pages/QuickSaleHistory";
import QuickSaleReturns from "@/pages/QuickSaleReturns";
import SimpleReturn from "@/pages/SimpleReturn";
import PartyReturn from "@/pages/PartyReturn";
import WholesaleReturnHistory from "@/pages/WholesaleReturnHistory";
import BillingHistory from "@/pages/BillingHistory";

import CustomerInventory from "@/pages/customer/CustomerInventory";
import CustomerParties from "@/pages/customer/CustomerParties";
import CustomerPartyProfile from "@/pages/customer/CustomerPartyProfile";
import InvoicePrintPage from "@/pages/InvoicePrintPage";
import ReturnPrintPage from "@/pages/ReturnPrintPage";
import PaymentPrintPage from "@/pages/PaymentPrintPage";

function WholesalePrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authReady = useAuthStore((s) => s.authReady);
  if (!authReady) {
    return (
      <Box display="flex" height="100vh" alignItems="center" justifyContent="center">
        <CircularProgress />
      </Box>
    );
  }
  return isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
}

function RedirectLegacyCustomer() {
  const { id } = useParams();
  return <Navigate to={`/wholesale/parties/customers/${id}`} replace />;
}

function CustomerPrivateRoute({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useCustomerPortalStore((s) => s.isLoggedIn);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const restore = useCustomerPortalStore((s) => s.restore);

  useEffect(() => {
    restore();
  }, [restore]);

  if (isLoggedIn) return <>{children}</>;
  if (isAuthenticated) return <Navigate to="/switch" replace />;
  return <Navigate to="/" replace />;
}

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const organizationId = useAuthStore((s) => s.organizationId);
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const loadSettings = useSettingsStore((s) => s.load);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated && organizationId != null) {
      loadSettings(organizationId);
    }
  }, [isAuthenticated, organizationId, loadSettings]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/switch"
          element={
            <WholesalePrivateRoute>
              <PortalSwitch />
            </WholesalePrivateRoute>
          }
        />
        <Route path="/wholesale/login" element={<Navigate to="/" replace />} />
        <Route path="/customer/login" element={<Navigate to="/" replace />} />
        <Route
          path="/print/bill/:id"
          element={
            <WholesalePrivateRoute>
              <InvoicePrintPage />
            </WholesalePrivateRoute>
          }
        />
        <Route
          path="/print/return/:id"
          element={
            <WholesalePrivateRoute>
              <ReturnPrintPage />
            </WholesalePrivateRoute>
          }
        />

        <Route
          path="/print/payment/:id"
          element={
            <WholesalePrivateRoute>
              <PaymentPrintPage />
            </WholesalePrivateRoute>
          }
        />

        <Route
          path="/wholesale"
          element={
            <WholesalePrivateRoute>
              <WholesaleLayout />
            </WholesalePrivateRoute>
          }
        >
          <Route index element={<Navigate to="sale" replace />} />
          <Route path="sale" element={<Sale />} />
          <Route path="history" element={<BillingHistory />} />

          <Route path="return" element={<PartyReturn />} />
          <Route path="return-history" element={<WholesaleReturnHistory />} />
          <Route path="parties" element={<Parties />} />
          <Route path="parties/customers/:id" element={<CustomerProfile />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="stock" element={<StockManagement />} />
          <Route path="settings" element={<Settings />} />
          <Route path="whatsapp" element={<WhatsAppConnect />} />

          {/* Legacy redirects */}
          <Route path="billing" element={<Navigate to="/wholesale/sale" replace />} />
          <Route path="quick-bill" element={<Navigate to="/customer" replace />} />
          <Route path="customers" element={<Navigate to="/wholesale/parties" replace />} />
          <Route path="customers/:id" element={<RedirectLegacyCustomer />} />
          <Route path="suppliers" element={<Navigate to="/wholesale/parties" replace />} />
          <Route path="products" element={<Navigate to="/wholesale/inventory" replace />} />
          <Route path="dashboard" element={<Navigate to="/wholesale/sale" replace />} />
          <Route path="ledger" element={<Navigate to="/wholesale/parties" replace />} />
          <Route path="payments" element={<Navigate to="/wholesale/parties" replace />} />
          <Route path="reports" element={<Navigate to="/wholesale/sale" replace />} />
        </Route>

        <Route
          path="/customer/print/bill/:id"
          element={
            <CustomerPrivateRoute>
              <InvoicePrintPage portal />
            </CustomerPrivateRoute>
          }
        />
        <Route
          path="/customer/print/return/:id"
          element={
            <CustomerPrivateRoute>
              <ReturnPrintPage portal />
            </CustomerPrivateRoute>
          }
        />
        <Route
          path="/customer"
          element={
            <CustomerPrivateRoute>
              <CustomerPortalLayout />
            </CustomerPrivateRoute>
          }
        >
          <Route index element={<SimpleBilling />} />
          <Route path="return" element={<SimpleReturn />} />
          <Route path="customers" element={<CustomerParties />} />
          <Route path="customers/:id" element={<CustomerPartyProfile />} />
          <Route path="history" element={<QuickSaleHistory />} />
          <Route path="returns" element={<QuickSaleReturns />} />
          <Route path="inventory" element={<CustomerInventory />} />
          <Route path="sale" element={<Navigate to="/customer" replace />} />
          <Route path="customer" element={<Navigate to="/customer" replace />} />
          <Route path="settings" element={<Navigate to="/customer" replace />} />
        </Route>

        <Route path="/simple-billing" element={<Navigate to="/customer" replace />} />
        <Route path="/simple-billing/*" element={<Navigate to="/customer" replace />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/billing" element={<Navigate to="/wholesale/sale" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
