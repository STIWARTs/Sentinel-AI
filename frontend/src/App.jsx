// export default function App() {
//   return (
//     <main className="app-shell">
//       <h1>Sentinel AI</h1>
//       <p>Security dashboard scaffold.</p>
//     </main>
//   );
// }

import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";

function App() {
  return (
    <div className="app-shell">

      <Sidebar />

      <div className="app-main">

        <Topbar />

        <main className="page-container">
          <h1>Security Overview</h1>

          <p className="text-secondary">
            Sentinel AI Security Operations Center
          </p>
        </main>

      </div>

    </div>
  );
}

export default App;