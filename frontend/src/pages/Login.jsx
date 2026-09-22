import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Lock, User, AlertCircle } from "lucide-react";
import { apiPost } from "../api/client";

const DEV_AUTH =
  import.meta.env.VITE_DEV_AUTH === "true";

export default function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (!username.trim() || !password.trim()) {
      setError("Enter your username and password.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      if (DEV_AUTH) {
        // Development-only authentication.
        // This is intentionally not a real JWT.
        localStorage.setItem(
          "sentinel_token",
          "dev-token"
        );

        navigate("/", { replace: true });
        return;
      }

      const response = await apiPost("/api/auth/login", {
        username: username.trim(),
        password,
      });

      if (!response?.access_token) {
        throw new Error("Login response did not contain an access token.");
      }

      localStorage.setItem(
        "sentinel_token",
        response.access_token
      );

      navigate("/", { replace: true });
    } catch (err) {
      console.error("Login failed:", err);

      setError(
        DEV_AUTH
          ? "Development login failed."
          : "Invalid username or password."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">

        <div className="login-brand">
          <div className="login-brand-icon">
            <Shield size={24} />
          </div>

          <div>
            <h1>Sentinel AI</h1>
            <p>Security Operations</p>
          </div>
        </div>

        <div className="login-heading">
          <h2>Sign in</h2>
          <p>
            Access the Sentinel security operations console.
          </p>
        </div>

        {DEV_AUTH && (
          <div className="dev-auth-notice">
            <AlertCircle size={15} />
            <span>
              Development authentication is enabled.
            </span>
          </div>
        )}

        {error && (
          <div className="login-error">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>

          <label className="login-field">
            <span>Username</span>

            <div className="login-input-wrapper">
              <User size={16} />
              <input
                type="text"
                value={username}
                onChange={(event) =>
                  setUsername(event.target.value)
                }
                placeholder="Enter username"
                autoComplete="username"
              />
            </div>
          </label>

          <label className="login-field">
            <span>Password</span>

            <div className="login-input-wrapper">
              <Lock size={16} />
              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Enter password"
                autoComplete="current-password"
              />
            </div>
          </label>

          <button
            type="submit"
            className="login-submit"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>

        </form>

        <div className="login-footer">
          Sentinel AI · Security Operations Platform
        </div>

      </div>
    </div>
  );
}