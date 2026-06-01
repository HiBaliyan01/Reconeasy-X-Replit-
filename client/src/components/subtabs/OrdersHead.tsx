import SectionHeader from "./SectionHeader";

interface OrdersHeadProps {
  onExport?: () => void;
}

export default function OrdersHead({ onExport }: OrdersHeadProps) {
  return (
    <SectionHeader
      variant="orders"
      title="Orders Management"
      description="Upload and manage order data from marketplaces"
      actions={
        onExport ? (
          <button
            onClick={onExport}
            className="h-9 rounded-xl border border-white/30 bg-white px-3 text-sm font-medium text-subheader-orders shadow-sm transition hover:bg-white/90"
          >
            Export
          </button>
        ) : undefined
      }
    />
  );
}
