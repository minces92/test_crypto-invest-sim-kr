import useSWR from 'swr';
import { fetcher as safeFetcher } from '@/lib/fetcher';

export function useTickerData() {
    const { data, error, isLoading, mutate } = useSWR(
        '/api/tickers',
        (url: string) => safeFetcher(url, 5000, 2),
        {
            refreshInterval: 1000, // Poll every 1 second for real-time updates
            revalidateOnFocus: false,
            dedupingInterval: 500,
        }
    );

    return {
        tickers: data || [],
        isLoading,
        isError: error,
        mutate,
    };
}
