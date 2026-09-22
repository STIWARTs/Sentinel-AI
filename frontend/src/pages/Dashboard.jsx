import SummaryCards from "../components/dashboard/SummaryCards";
import AttackTimeline from "../components/dashboard/AttackTimeline";
import AttackDistributionChart from "../components/dashboard/AttackDistributionChart";
import LiveFeed from "../components/dashboard/LiveFeed";

export default function Dashboard() {
  return (
    <div className="dashboard">

      <SummaryCards />

      <div className="dashboard-analysis">
        <AttackTimeline />
        <AttackDistributionChart />
      </div>

      <LiveFeed />

    </div>
  );
}