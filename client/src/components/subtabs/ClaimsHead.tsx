import SectionHeader, { HeaderGhostBtn as Ghost, HeaderSolidBtn as Solid } from "./SectionHeader";

export default function ClaimsHead() {
  return (
    <SectionHeader
      variant="claims"
      title="Claims Tracker"
      description="Manage marketplace claims and reconciliation issues"
      actions={
        <>
          <Ghost>Excel</Ghost>
          <Solid variant="claims">PDF</Solid>
        </>
      }
    />
  );
}