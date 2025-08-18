import SectionHeader, { HeaderGhostBtn as Ghost, HeaderSolidBtn as Solid } from "./SectionHeader";

export default function ProjectedIncomeHead() {
  return (
    <SectionHeader
      variant="projected"
      title="Projected Income"
      description="AI-powered revenue forecasting from WMS processed orders"
      actions={
        <>
          <Ghost>Config</Ghost>
          <Solid variant="projected">Export CSV</Solid>
        </>
      }
    />
  );
}