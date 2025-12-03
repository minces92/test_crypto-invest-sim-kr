import StrategyBuilder from '@/components/StrategyBuilder';

export default function StrategiesPage() {
    return (
        <div className="container-xl px-3 px-md-4 px-lg-5 py-4">
            <div className="d-flex flex-items-center flex-justify-between mb-4">
                <h1 className="h2">투자 전략 빌더</h1>
            </div>

            <StrategyBuilder />
        </div>
    );
}
