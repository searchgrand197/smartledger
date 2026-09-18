import type { Customer } from "@/types";
import PartySelectionModal from "@/components/party-picker/PartySelectionModal";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (customer: Customer) => void;
  selectedId?: number | null;
}

/** Wholesale billing party picker — premium fast-selection modal. */
export default function PartyPickerDialog(props: Props) {
  return <PartySelectionModal {...props} />;
}
