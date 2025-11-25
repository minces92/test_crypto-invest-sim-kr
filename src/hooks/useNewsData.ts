import useSWR from 'swr';
import { fetcher as safeFetcher } from '@/lib/fetcher';

export function useNewsData(query: string = 'crypto', forceRefresh: boolean = false) {
    const apiUrl = `/api/news?query=${encodeURIComponent(query)}${forceRefresh ? '&refresh=true' : ''}`;

    const { data, error, isLoading, mutate } = useSWR(
        apiUrl,
        (url: string) => safeFetcher(url, 7000, 2),
        {
            refreshInterval: 15 * 60 * 1000, // 15 minutes
            revalidateOnFocus: false,
            dedupingInterval: 60000,
        }
    );

    return {
        news: data || [],
        isLoading,
        isError: error,
        mutate,
    };
}
