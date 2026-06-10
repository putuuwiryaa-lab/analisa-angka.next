import { useQueryClient } from "@tanstack/react-query";
import {
  MARKETS_QUERY_KEY,
  MARKETS_STALE_TIME,
  extractHistoryData,
  fetchMarkets,
  findMarketByIdOrName,
  parseHistoryTokens,
  type Market,
} from "@/lib/markets/client";

export function useMarketHistoryData(marketId: string) {
  const queryClient = useQueryClient();

  const getMarkets = async () => {
    const cached = queryClient.getQueryData<Market[]>(MARKETS_QUERY_KEY);
    if (cached?.length) return cached;

    return queryClient.fetchQuery({
      queryKey: MARKETS_QUERY_KEY,
      queryFn: fetchMarkets,
      staleTime: MARKETS_STALE_TIME,
    });
  };

  const getMarketData = async () => {
    const markets = await getMarkets();
    const current = findMarketByIdOrName(markets, marketId);

    if (!current) throw new Error(`Data histori ${decodeURIComponent(marketId)} belum disetup oleh Admin!`);

    const data = parseHistoryTokens(extractHistoryData(current));
    if (data.length < 17) {
      throw new Error(`Data ${current.name || current.id || marketId} kurang. Minimal 17 result, terbaca ${data.length}.`);
    }

    return data;
  };

  return { getMarketData };
}
