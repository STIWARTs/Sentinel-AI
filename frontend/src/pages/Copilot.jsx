import { useEffect, useState } from "react";
import {
  Bot,
  Send,
  ShieldAlert,
  Search,
  Activity,
  FileText,
} from "lucide-react";
import { apiGet, apiPost } from "../api/client";

const suggestions = [
  {
    icon: ShieldAlert,
    title: "Analyze an incident",
    prompt: "Analyze the latest critical incident and explain the likely attack pattern.",
  },
  {
    icon: Search,
    title: "Investigate an IP",
    prompt: "Investigate the source IP associated with the latest high-risk incident.",
  },
  {
    icon: Activity,
    title: "Explain network activity",
    prompt: "Explain the unusual network activity detected in the last few minutes.",
  },
  {
    icon: FileText,
    title: "Summarize threats",
    prompt: "Summarize the most important threats detected today.",
  },
];

function toIncidentContext(incident) {
  if (!incident) return {};
  return {
    id: incident.id,
    title: incident.title,
    attack_chain: incident.attack_chain,
    src_ip: incident.src_ip,
    risk_score: incident.risk_score,
    severity: incident.severity,
    status: incident.status,
    mitre_technique: incident.mitre_technique,
    ai_explanation: incident.ai_explanation,
  };
}

function incidentLabel(incident) {
  const chain = incident.attack_chain || incident.title || `Incident ${incident.id}`;
  return `#${incident.id} · ${chain}`;
}

export default function Copilot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    apiGet("/api/incidents")
      .then((rows) => {
        if (!Array.isArray(rows)) return;
        setIncidents(rows);
      })
      .catch((err) => {
        console.error("Failed to fetch incidents for copilot:", err);
      });

    apiGet("/api/dashboard/summary")
      .then(setSummary)
      .catch((err) => {
        console.error("Failed to fetch dashboard summary for copilot:", err);
      });
  }, []);

  const selectedIncident = incidents.find(
    (incident) => String(incident.id) === String(selectedId)
  );

  const sendMessage = async (message = input) => {
    const text = message.trim();
    if (!text || pending) return;

    setMessages((current) => [
      ...current,
      { role: "user", content: text },
    ]);
    setInput("");
    setPending(true);

    try {
      const data = await apiPost("/api/copilot/ask", {
        question: text,
        incident_context: toIncidentContext(selectedIncident),
      });
      const answer = data?.answer?.trim()
        || "The copilot returned an empty answer.";
      setMessages((current) => [
        ...current,
        { role: "assistant", content: answer },
      ]);
    } catch (err) {
      console.error("Copilot ask failed:", err);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            "Copilot is unavailable right now. Confirm you are signed in as an analyst and that GEMINI_API_KEY is configured.",
        },
      ]);
    } finally {
      setPending(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage();
  };

  const openIncidents = incidents.filter(
    (incident) => incident.status && incident.status !== "Resolved"
  ).length;

  return (
    <div className="copilot-page">

      <div className="page-heading">
        <div>
          <h1>AI Copilot</h1>
          <p>
            Security analysis and investigation assistant
          </p>
        </div>

        <div className="copilot-status">
          <span />
          {pending ? "Thinking…" : "Ready"}
        </div>
      </div>

      <div className="copilot-workspace">

        <main className="copilot-chat">

          {messages.length === 0 ? (
            <div className="copilot-empty">

              <div className="copilot-icon">
                <Bot size={24} />
              </div>

              <h2>How can I help with your investigation?</h2>

              <p>
                Ask about incidents, network activity, threats,
                or security events detected by Sentinel.
              </p>

              <div className="copilot-suggestions">
                {suggestions.map((suggestion) => {
                  const Icon = suggestion.icon;

                  return (
                    <button
                      key={suggestion.title}
                      className="copilot-suggestion"
                      type="button"
                      disabled={pending}
                      onClick={() => sendMessage(suggestion.prompt)}
                    >
                      <Icon size={17} />

                      <span>
                        <strong>{suggestion.title}</strong>
                        <small>{suggestion.prompt}</small>
                      </span>
                    </button>
                  );
                })}
              </div>

            </div>
          ) : (
            <div className="copilot-messages">

              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`copilot-message ${message.role}`}
                >
                  <div className="message-avatar">
                    {message.role === "assistant" ? (
                      <Bot size={15} />
                    ) : (
                      "A"
                    )}
                  </div>

                  <div className="message-content">
                    <span className="message-label">
                      {message.role === "assistant"
                        ? "Sentinel AI"
                        : "Analyst"}
                    </span>

                    <p>{message.content}</p>
                  </div>
                </div>
              ))}

              {pending && (
                <div className="copilot-message assistant">
                  <div className="message-avatar">
                    <Bot size={15} />
                  </div>
                  <div className="message-content">
                    <span className="message-label">Sentinel AI</span>
                    <p>Analyzing…</p>
                  </div>
                </div>
              )}

            </div>
          )}

          <form
            className="copilot-input-area"
            onSubmit={handleSubmit}
          >
            <input
              type="text"
              placeholder="Ask Sentinel AI about a threat, incident, or network event..."
              value={input}
              onChange={(event) =>
                setInput(event.target.value)
              }
              disabled={pending}
            />

            <button
              type="submit"
              aria-label="Send message"
              disabled={pending || !input.trim()}
            >
              <Send size={17} />
            </button>
          </form>

        </main>

        <aside className="copilot-context">

          <div className="copilot-context-header">
            <h2>Investigation Context</h2>
            <span>{selectedIncident ? "Incident" : "General"}</span>
          </div>

          <div className="context-section">
            <span className="context-label">
              Selected incident
            </span>
            <select
              className="filter-select copilot-incident-select"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              <option value="">None (general question)</option>
              {incidents.map((incident) => (
                <option key={incident.id} value={incident.id}>
                  {incidentLabel(incident)}
                </option>
              ))}
            </select>
            <p>
              {selectedIncident
                ? `${selectedIncident.src_ip ?? "Unknown IP"} · risk ${selectedIncident.risk_score ?? "—"}`
                : "Questions will be asked without a specific incident."}
            </p>
          </div>

          <div className="context-section">
            <span className="context-label">
              Active incidents
            </span>

            <strong>{openIncidents || incidents.length}</strong>

            <p>
              Incidents currently requiring analyst attention.
            </p>
          </div>

          <div className="context-section">
            <span className="context-label">
              Critical threats
            </span>

            <strong className="critical-value">
              {summary?.critical_threats ?? "—"}
            </strong>

            <p>
              High-priority threats detected recently.
            </p>
          </div>

          <div className="context-note">
            <Bot size={15} />

            <span>
              Answers use the selected incident as context, or a general
              question when none is selected.
            </span>
          </div>

        </aside>

      </div>
    </div>
  );
}
