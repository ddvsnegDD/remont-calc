import { C } from '../lib/theme';

const SectionLabel = ({ children, light }) => (
  <span className="font-golos" style={{ display: "inline-block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: light ? "rgba(255,255,255,0.5)" : C.terra, marginBottom: 12 }}>{children}</span>
);

export default SectionLabel;
