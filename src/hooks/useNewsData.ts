import useSWR from 'swr';
import { fetcher as safeFetcher } from '@/lib/fetcher';

export function useNewsData(query: string = '', forceRefresh: boolean = false) {
    // If no query is provided by the caller, leave it empty so the server can apply
    // its own default query (which includes English and Korean crypto keywords).
    const apiQuery = query && query.trim().length > 0 ? `query=${encodeURIComponent(query)}` : '';
    const apiUrl = `/api/news${apiQuery ? `?${apiQuery}` : ''}${(apiQuery ? '&' : '?')}${forceRefresh ? 'refresh=true' : 'refresh=false'}`;

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
