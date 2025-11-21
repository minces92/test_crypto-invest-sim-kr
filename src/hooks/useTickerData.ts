import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useTickerData() {
    const { data, error, isLoading, mutate } = useSWR(
        '/api/tickers',
        fetcher,
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
