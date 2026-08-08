import ScanViewClient from "./ScanViewClient";
import styles from "./ScanTheme.module.css";

interface ScanPageProps {
  searchParams: Promise<{ view?: string | string[] }>;
}

export default async function ScanPage({ searchParams }: ScanPageProps) {
  const params = await searchParams;
  const view = Array.isArray(params.view) ? params.view[0] : params.view;

  return (
    <div className={styles.theme} data-scan-theme>
      <ScanViewClient view={view} />
    </div>
  );
}
