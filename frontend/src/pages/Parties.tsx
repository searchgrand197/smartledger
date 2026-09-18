import { useState } from "react";
import { Box, Tab, Tabs } from "@mui/material";
import { PageShell, PageHeader } from "@/components/ui";
import Customers from "@/pages/Customers";
import Suppliers from "@/pages/Suppliers";
import ReturnsReports, { ReturnsDashboardWidget } from "@/pages/ReturnsReports";

export default function Parties() {
  const [tab, setTab] = useState(0);
  const [initialReturnsTab, setInitialReturnsTab] = useState<string | null>(null);
  const [initialDateFrom, setInitialDateFrom] = useState<string | null>(null);
  const [initialDateTo, setInitialDateTo] = useState<string | null>(null);
  const [returnsReportsKey, setReturnsReportsKey] = useState(0);

  const handleCardClick = (type: "today" | "month" | "refund") => {
    setTab(3);
    setReturnsReportsKey((k) => k + 1);

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const localToday = `${yyyy}-${mm}-${dd}`;
    const monthStart = `${yyyy}-${mm}-01`;

    if (type === "today") {
      setInitialReturnsTab("salesReturns");
      setInitialDateFrom(localToday);
      setInitialDateTo(localToday);
    } else if (type === "month") {
      setInitialReturnsTab("salesReturns");
      setInitialDateFrom(monthStart);
      setInitialDateTo("");
    } else if (type === "refund") {
      setInitialReturnsTab("refunds");
      setInitialDateFrom(monthStart);
      setInitialDateTo("");
    }
  };

  return (
    <PageShell>
      <PageHeader title="Parties" subtitle="Parties — view ledger, receive payments & closing balance" />
      <ReturnsDashboardWidget onCardClick={handleCardClick} />
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        className="parties-tabs"
        sx={{ mb: 1.5, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab label="Wholesale Parties" sx={{ fontWeight: 600, textTransform: "none" }} />
        <Tab label="Retail / Portal Customers" sx={{ fontWeight: 600, textTransform: "none" }} />
        <Tab label="Suppliers" sx={{ fontWeight: 600, textTransform: "none" }} />
        <Tab label="Returns" sx={{ fontWeight: 600, textTransform: "none" }} />
      </Tabs>
      <Box className="animate-fade-in">
        {tab === 0 ? (
          <Customers embedded type="wholesale" />
        ) : tab === 1 ? (
          <Customers embedded type="retail" />
        ) : tab === 2 ? (
          <Suppliers embedded />
        ) : (
          <ReturnsReports
            key={returnsReportsKey}
            embedded
            initialTabKey={initialReturnsTab}
            initialDateFrom={initialDateFrom}
            initialDateTo={initialDateTo}
          />
        )}
      </Box>
    </PageShell>
  );
}
