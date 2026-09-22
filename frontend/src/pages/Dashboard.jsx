import SummaryCards from "../components/dashboard/SummaryCards";
import AttackTimeline from "../components/dashboard/AttackTimeline";
import AttackDistributionChart from "../components/dashboard/AttackDistributionChart";
import LiveFeed from "../components/dashboard/LiveFeed";

export default function Dashboard() {
  return (
    <div className="dashboard">

      <div className="dashboard-header">
        <div>
          <h1>Overview</h1>

          <p>
            Network and security activity
          </p>
        </div>

        <button className="time-filter">
          Last 24 hours
          <span>⌄</span>
        </button>
      </div>

      <SummaryCards />

      <div className="dashboard-analysis">
        <AttackTimeline />
        <AttackDistributionChart />
      </div>

      <LiveFeed />

    </div>
  );
}