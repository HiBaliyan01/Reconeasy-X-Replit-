import SectionHeader, { HeaderGhostBtn as Ghost, HeaderSolidBtn as Solid } from "./SectionHeader";

export default function ClaimsHead() {
  return (
    <SectionHeader
      variant="claims"
      title="Claims Tracker"
      description="Manage marketplace claims and dispute resolution"
      actions={
        <>
          <Ghost>Excel</Ghost>
          <Solid variant="claims">PDF</Solid>
        </>
      }
    />
  );
}