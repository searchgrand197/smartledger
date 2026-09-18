import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Button,
  Dialog,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import { customersApi } from "@/api/services";
import { useAuthStore } from "@/store/authStore";
import type { Customer } from "@/types";
import YouTubeLoader from "@/components/ui/YouTubeLoader";
import PartySearchBar from "./PartySearchBar";
import PartyFilters from "./PartyFilters";
import PartyGrid from "./PartyGrid";
import PartyCardSkeleton from "./PartyCardSkeleton";
import PartyFooterStats from "./PartyFooterStats";
import {
  PARTY_PAGE_SIZE,
  excludeWalkInCustomer,
  filterParties,
  searchParties,
  type PartyFilter,
} from "./partyPickerUtils";
import "@/styles/party-picker.css";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (customer: Customer) => void;
  selectedId?: number | null;
}

export default function PartySelectionModal({ open, onClose, onSelect, selectedId }: Props) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const organizationId = useAuthStore((s) => s.organizationId);
  const searchRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PartyFilter>("all");
  const [page, setPage] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["customers-picker", organizationId],
    queryFn: () => customersApi.listAll({ is_wholesale: "true" }),
    enabled: open,
  });

  const parties = useMemo(
    () => excludeWalkInCustomer((data as Customer[]) || []),
    [data]
  );

  const filtered = useMemo(() => {
    const searched = searchParties(parties, search);
    return filterParties(searched, filter);
  }, [parties, search, filter]);

  const stats = useMemo(() => {
    const outstanding = parties.filter((p) => Number(p.current_due ?? 0) > 0);
    return {
      total: parties.length,
      outstandingCount: outstanding.length,
      totalOutstanding: outstanding.reduce((s, p) => s + Number(p.current_due ?? 0), 0),
    };
  }, [parties]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PARTY_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * PARTY_PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PARTY_PAGE_SIZE);
  const pageEnd = Math.min(pageStart + pageRows.length, filtered.length);

  const resetState = useCallback(() => {
    setSearch("");
    setFilter("all");
    setPage(0);
    setFocusedIndex(0);
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSelect = (customer: Customer) => {
    onSelect(customer);
    resetState();
    onClose();
  };

  const handleDoubleSelect = (customer: Customer) => {
    handleSelect(customer);
  };

  const handleNewParty = () => {
    handleClose();
    navigate("/wholesale/parties");
  };

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 120);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setPage(0);
    setFocusedIndex(0);
  }, [search, filter]);

  useEffect(() => {
    if (focusedIndex >= pageRows.length) {
      setFocusedIndex(Math.max(0, pageRows.length - 1));
    }
  }, [pageRows.length, focusedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
      return;
    }

    if (e.target === searchRef.current) {
      if (e.key === "ArrowDown" && pageRows.length > 0) {
        e.preventDefault();
        setFocusedIndex(0);
      }
      return;
    }

    const cols = isMobile ? 1 : window.innerWidth >= 960 ? 5 : 3;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + cols, pageRows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - cols, 0));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, pageRows.length - 1));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && pageRows[focusedIndex]) {
      e.preventDefault();
      handleSelect(pageRows[focusedIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={false}
      fullScreen={isMobile}
      className="party-selection-modal"
      PaperProps={{
        className: isMobile ? "party-modal-paper party-modal-paper--fullscreen" : "party-modal-paper",
      }}
      aria-labelledby="party-modal-title"
      onKeyDown={handleKeyDown}
    >
      <Box className="party-modal-header">
        <Box className="party-modal-header__text">
          <Typography id="party-modal-title" className="party-modal-header__title">
            Select Party
          </Typography>
          <Typography className="party-modal-header__subtitle">
            Choose a customer to create bill or manage ledger
          </Typography>
        </Box>
        <Box className="party-modal-header__actions">
          <Button
            size="small"
            startIcon={<AddIcon />}
            className="party-modal-header__new"
            onClick={handleNewParty}
          >
            New Party
          </Button>
          <IconButton className="party-modal-header__close" onClick={handleClose} aria-label="Close">
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      {isLoading && <YouTubeLoader />}

      <Box className="party-modal-body">
        <Box className="party-modal-toolbar">
          <PartySearchBar ref={searchRef} value={search} onChange={setSearch} />
          <PartyFilters value={filter} onChange={setFilter} />
        </Box>

        <Box className="party-modal-scroll">
          {isLoading ? (
            <PartyCardSkeleton count={12} />
          ) : pageRows.length === 0 ? (
            <Box className="party-empty">
              <GroupsOutlinedIcon className="party-empty__icon" sx={{ fontSize: 48, color: "text.secondary" }} />
              <Typography className="party-empty__title">No party found</Typography>
              <Typography className="party-empty__text">
                {search || filter !== "all"
                  ? "Try another search or filter"
                  : "Create your first party to start billing"}
              </Typography>
              <Button
                variant="contained"
                className="gradient-button"
                startIcon={<AddIcon />}
                sx={{ mt: 2, fontWeight: 800, textTransform: "none", borderRadius: 2 }}
                onClick={handleNewParty}
              >
                Create Party
              </Button>
            </Box>
          ) : (
            <PartyGrid
              parties={pageRows}
              selectedId={selectedId}
              focusedIndex={focusedIndex}
              onFocusedIndexChange={setFocusedIndex}
              onSelect={handleSelect}
              onDoubleSelect={handleDoubleSelect}
            />
          )}
        </Box>

        {!isLoading && parties.length > 0 && (
          <PartyFooterStats
            totalCustomers={stats.total}
            outstandingCount={stats.outstandingCount}
            totalOutstanding={stats.totalOutstanding}
            pageStart={pageStart + 1}
            pageEnd={pageEnd}
            totalFiltered={filtered.length}
            page={safePage}
            pageCount={pageCount}
            onPageChange={setPage}
          />
        )}
      </Box>
    </Dialog>
  );
}
