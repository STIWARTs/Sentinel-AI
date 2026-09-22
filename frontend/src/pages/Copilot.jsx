import { useState } from "react";
import {
  Bot,
  Send,
  ShieldAlert,
  Search,
  Activity,
  FileText,
} from "lucide-react";

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

export default function Copilot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const sendMessage = (message = input) => {
    const text = message.trim();

    if (!text) return;

    setMessages((current) => [
      ...current,
      {
        role: "user",
        content: text,
      },
      {
        role: "assistant",
        content:
          "I can analyze Sentinel events, incidents, network activity, and threat indicators. Backend intelligence will be connected here once the API is available.",
      },
    ]);

    setInput("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage();
  };

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
          Ready
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
            />

            <button
              type="submit"
              aria-label="Send message"
              disabled={!input.trim()}
            >
              <Send size={17} />
            </button>
          </form>

        </main>

        <aside className="copilot-context">

          <div className="copilot-context-header">
            <h2>Investigation Context</h2>
            <span>Live</span>
          </div>

          <div className="context-section">
            <span className="context-label">
              Active incidents
            </span>

            <strong>5</strong>

            <p>
              Incidents currently requiring analyst attention.
            </p>
          </div>

          <div className="context-section">
            <span className="context-label">
              Critical threats
            </span>

            <strong className="critical-value">2</strong>

            <p>
              High-priority threats detected recently.
            </p>
          </div>

          <div className="context-section">
            <span className="context-label">
              Network activity
            </span>

            <strong>1,284</strong>

            <p>
              Packets per second currently being monitored.
            </p>
          </div>

          <div className="context-note">
            <Bot size={15} />

            <span>
              AI responses will use live Sentinel data
              once the backend integration is connected.
            </span>
          </div>

        </aside>

      </div>
    </div>
  );
}