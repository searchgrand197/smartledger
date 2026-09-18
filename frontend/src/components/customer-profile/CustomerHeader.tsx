import { Box, Button, IconButton, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import EditIcon from "@mui/icons-material/Edit";
import { formatCurrency, formatDate } from "@/utils/format";

interface Props {
  name: string;
  code: string;
  ownerName?: string;
  phone: string;
  currentDue: number;
  lastPurchaseDate?: string | null;
  billCount: number;
  onBack: () => void;
  onEdit?: () => void;
}

export default function CustomerHeader({
  name,
  code,
  ownerName,
  phone,
  currentDue,
  lastPurchaseDate,
  billCount,
  onBack,
  onEdit,
}: Props) {
  const dueZero = currentDue <= 0;

  return (
    <Box className="cp-header">
      <IconButton onClick={onBack} aria-label="Back to parties" size="small" sx={{ mt: 0.5 }}>
        <ArrowBackIcon />
      </IconButton>
      <Box className="cp-header__main">
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
          <Typography component="h1" className="cp-header__title">
            {name}
          </Typography>
          {onEdit && (
            <Button
              variant="outlined"
              size="small"
              color="warning"
              onClick={onEdit}
              startIcon={<EditIcon sx={{ fontSize: 16 }} />}
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: "8px" }}
            >
              Edit Party
            </Button>
          )}
        </Box>
        <Box className="cp-header__meta">
          <span className="cp-header__meta-item">
            <BadgeOutlinedIcon sx={{ fontSize: 14 }} />
            <strong>{code}</strong>
          </span>
          {ownerName && <span className="cp-header__meta-item">{ownerName}</span>}
          <span className="cp-header__meta-item">
            <PhoneOutlinedIcon sx={{ fontSize: 14 }} />
            {phone}
          </span>
          <span className="cp-header__meta-item">
            Due{" "}
            <strong className={dueZero ? "cp-header__due cp-header__due--zero" : "cp-header__due"}>
              {formatCurrency(currentDue)}
            </strong>
          </span>
          <span className="cp-header__meta-item">
            Last purchase <strong>{lastPurchaseDate ? formatDate(lastPurchaseDate) : "—"}</strong>
          </span>
          <span className="cp-header__meta-item">
            Bills <strong>{billCount}</strong>
          </span>
        </Box>
      </Box>
    </Box>
  );
}
