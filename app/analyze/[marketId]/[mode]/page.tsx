import AnalyzeModeClientLoader from "./AnalyzeModeClientLoader";

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function AnalyzeModePage({
  params,
}: {
  params: Promise<{ marketId: string; mode: string }>;
}) {
  const { marketId, mode } = await params;

  return <AnalyzeModeClientLoader marketId={safeDecode(marketId)} mode={mode} />;
}
