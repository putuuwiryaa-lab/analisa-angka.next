import { useQueryClient } from "@tanstack/react-query";
import {
  MARKETS_STALE_TIME,
  fetchMarketHistory,
  marketHistoryQueryKey,
  type MarketHistoryResponse,
} from "@/lib/markets/client";

export function useMarketHistoryData(marketId: string) {
  const queryClient = useQueryClient();

  const getMarketData = async () => {
    const history = await queryClient.fetchQuery<MarketHistoryResponse>({
      queryKey: marketHistoryQueryKey(marketId),
      queryFn: () => fetchMarketHistory(marketId),
      staleTime: MARKETS_STALE_TIME,
    });

    if (history.data.length < 17) {
      throw new Error(
        `Data ${history.market_name || history.market_id || marketId} kurang. Minimal 17 result, terbaca ${history.data.length}.`,
      );
    }

    return history.data;
  };

  return { getMarketData };
}
