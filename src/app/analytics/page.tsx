import PortfolioAnalytics from '@/components/PortfolioAnalytics';

export default function AnalyticsPage() {
    return (
        <div className="container-xl px-3 px-md-4 px-lg-5 py-4">
            <div className="d-flex flex-items-center flex-justify-between mb-4">
                <h1 className="h2">포트폴리오 분석</h1>
            </div>

            <PortfolioAnalytics />
        </div>
    );
}
