import SectionHeader, { HeaderGhostBtn as Ghost, HeaderSolidBtn as Solid } from "./SectionHeader";

export default function OrdersHead() {
  return (
    <SectionHeader
      variant="orders"
      title="Orders Management"
      description="Upload and manage order data from marketplaces"
      actions={
        <>
          <Ghost>Template</Ghost>
          <Solid variant="orders">Export</Solid>
        </>
      }
    />
  );
}