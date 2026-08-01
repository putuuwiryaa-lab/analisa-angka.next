import ScanPageClient from "./ScanPageClient";
import styles from "./ScanTheme.module.css";

export default function ScanPage() {
  return (
    <div className={styles.theme} data-scan-theme>
      <ScanPageClient />
    </div>
  );
}
