import useSWR from 'swr';
import { fetcher as safeFetcher } from '@/lib/fetcher';

export function useMarketData(market: string, interval: string = 'day', count: number = 200) {
    const { data, error, isLoading, mutate } = useSWR(
        market ? `/api/candles?market=${market}&interval=${interval}&count=${count}` : null,
        (url: string) => safeFetcher(url, 5000, 2),
        {
            refreshInterval: 5000, // Poll every 5 seconds
            revalidateOnFocus: false,
            dedupingInterval: 2000,
        }
    );

    return {
        candles: data || [],
        isLoading,
        isError: error,
        mutate,
    };
}
