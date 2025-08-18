import SectionHeader, { HeaderGhostBtn as Ghost, HeaderSolidBtn as Solid } from "./SectionHeader";

export default function SettlementsHead() {
  return (
    <SectionHeader
      variant="settlements"
      title="Settlement Management"
      description="Track marketplace settlements, tickets, and claim resolutions"
      actions={
        <>
          <Ghost>Amazon</Ghost>
          <Ghost>Flipkart</Ghost>
          <Ghost>Myntra</Ghost>
          <Solid variant="settlements">Export Report</Solid>
        </>
      }
    />
  );
}