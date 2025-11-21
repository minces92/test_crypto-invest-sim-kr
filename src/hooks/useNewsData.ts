import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useNewsData(query: string = 'crypto') {
    const { data, error, isLoading, mutate } = useSWR(
        `/api/news?query=${encodeURIComponent(query)}`,
        fetcher,
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
