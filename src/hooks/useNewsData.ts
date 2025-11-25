import useSWR from 'swr';

const fetcher = (url: string) => 
    fetch(url)
        .then(res => {
            if (!res.ok) {
                // 서버에서 에러 응답을 보냈을 경우 (예: 4xx, 5xx)
                return res.json().then(errorData => {
                    throw new Error(errorData.error || `An error occurred: ${res.statusText}`);
                });
            }
            return res.json();
        })
        .catch(error => {
            // 네트워크 오류 또는 JSON 파싱 오류
            console.error("Fetcher Error:", error);
            throw error; // SWR이 isError 상태를 업데이트하도록 오류를 다시 던집니다.
        });

export function useNewsData(query: string = 'crypto', forceRefresh: boolean = false) {
    const apiUrl = `/api/news?query=${encodeURIComponent(query)}${forceRefresh ? '&refresh=true' : ''}`;

    const { data, error, isLoading, mutate } = useSWR(
        apiUrl,
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
