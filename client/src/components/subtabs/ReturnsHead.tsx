import SectionHeader, { HeaderGhostBtn as Ghost, HeaderSolidBtn as Solid } from "./SectionHeader";

export default function ReturnsHead() {
  return (
    <SectionHeader
      variant="returns"
      title="Returns Management"
      description="Upload and manage return data with comprehensive validation"
      actions={
        <>
          <Ghost>Template</Ghost>
          <Solid variant="returns">Upload CSV</Solid>
        </>
      }
    />
  );
}