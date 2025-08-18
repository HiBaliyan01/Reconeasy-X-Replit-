import SectionHeader, { HeaderGhostBtn as Ghost, HeaderSolidBtn as Solid } from "./SectionHeader";

export default function PaymentsHead() {
  return (
    <SectionHeader
      variant="payments"
      title="Payment Reconciliation"
      description="Track settlements, discrepancies, and overdue amounts"
      actions={
        <>
          <Ghost>Export Report</Ghost>
          <Solid variant="payments">Advanced Filters</Solid>
        </>
      }
    />
  );
}