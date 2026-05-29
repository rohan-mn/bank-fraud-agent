import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_BASE_URL = "http://127.0.0.1:8787";
const SESSION_KEY = "bank-fraud-imessage-wrapper";

const DEMO_PROMPTS = [
  {
    label: "Fraud",
    text: "My phone number is +919876543210. Someone spent 200 dollars off my credit card in Bengaluru. Please help.",
  },
  {
    label: "Stolen",
    text: "My phone number is +919876543210. Someone stole my credit card from my wallet. Please block it.",
  },
  {
    label: "PIN exposed",
    text: "My phone number is +919876543210. I posted a picture online and my card and PIN are visible. I am concerned about misuse.",
  },
  {
    label: "Lost card",
    text: "My phone number is +919876543210. I lost my debit card yesterday. Please help me protect my account.",
  },
];

function nowTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function App() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi, I am your bank card protection agent. Tell me your concern and include your registered phone number.",
      time: nowTime(),
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [proxyOnline, setProxyOnline] = useState(false);
  const [status, setStatus] = useState("Checking wrapper proxy...");
  const [health, setHealth] = useState(null);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const chatMessagesForApi = useMemo(() => {
    return messages
      .filter(
        (m) =>
          m &&
          ["user", "assistant"].includes(m.role) &&
          typeof m.content === "string" &&
          m.content.trim()
      )
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));
  }, [messages]);

  useEffect(() => {
    checkHealth();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function checkHealth() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`, {
        method: "GET",
      });

      const data = await response.json();

      console.log("Health response:", data);

      if (response.ok && data.ok === true) {
        setProxyOnline(true);
        setStatus("Connected to local wrapper");
        setHealth(data);
        return;
      }

      setProxyOnline(false);
      setStatus("Wrapper proxy is not running");
      setHealth(data);
    } catch (error) {
      console.error("Health check failed:", error);
      setProxyOnline(false);
      setStatus("Wrapper proxy is not running");
      setHealth(null);
    }
  }

  function extractAssistantText(data) {
    return (
      data?.reply ||
      data?.content ||
      data?.message ||
      data?.response ||
      data?.text ||
      data?.raw?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.message?.content ||
      "No response text returned from OpenClaw."
    );
  }

  async function sendMessage(customText = null) {
    const text = String(customText ?? input).trim();

    if (!text || loading) {
      return;
    }

    const userMessage = {
      role: "user",
      content: text,
      time: nowTime(),
    };

    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const apiMessages = nextMessages
        .filter(
          (m) =>
            m &&
            ["user", "assistant"].includes(m.role) &&
            typeof m.content === "string" &&
            m.content.trim()
        )
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionKey: SESSION_KEY,
          messages: apiMessages,
        }),
      });

      const data = await response.json();

      console.log("Chat response:", data);

      if (!response.ok) {
        const errorText =
          data?.error ||
          data?.details?.error?.message ||
          data?.details ||
          "OpenClaw request failed.";

        throw new Error(
          typeof errorText === "string"
            ? errorText
            : JSON.stringify(errorText, null, 2)
        );
      }

      const assistantText = extractAssistantText(data);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: assistantText,
          time: nowTime(),
        },
      ]);
    } catch (error) {
      console.error("Send message failed:", error);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: String(error?.message || error),
          time: nowTime(),
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage();
  }

  function handleDemoPrompt(prompt) {
    setInput(prompt.text);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }

  function clearChat() {
    setMessages([
      {
        role: "assistant",
        content:
          "Chat cleared. Tell me your card-related concern and include your registered phone number.",
        time: nowTime(),
      },
    ]);
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <div className="app-root">
      <div className="iphone-shell">
        <div className="iphone-top">
          <div className="dynamic-island" />
        </div>

        <div className="screen">
          <header className="chat-header">
            <div className="chat-header-top">
              <button
                type="button"
                className="nav-button"
                onClick={checkHealth}
                title="Recheck wrapper"
              >
                ⟳
              </button>

              <div className="chat-user">
                <div className="avatar">🏛️</div>
                <div className="chat-user-meta">
                  <div className="chat-title">Card Protection Agent</div>
                  <div className="chat-subtitle">
                    {proxyOnline ? "iMessage • Online" : "iMessage • Offline"}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="nav-button info-button"
                title="Clear chat"
                onClick={clearChat}
              >
                🗑️
              </button>
            </div>

            <div className="status-strip">
              <span
                className={`status-dot ${proxyOnline ? "online" : "offline"}`}
              />
              <span className="status-text">{status}</span>
            </div>

            <div className="quick-prompts">
              {DEMO_PROMPTS.map((prompt) => (
                <button
                  key={prompt.label}
                  type="button"
                  className="quick-prompt"
                  onClick={() => handleDemoPrompt(prompt)}
                >
                  {prompt.label}
                </button>
              ))}
            </div>
          </header>

          <div className="messages-area">
            <div className="date-separator">Today</div>

            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}-${message.time}`}
                className={`message-row ${
                  message.role === "user" ? "from-user" : "from-agent"
                }`}
              >
                <div
                  className={`message-bubble ${
                    message.role === "user"
                      ? "user-bubble"
                      : "agent-bubble"
                  } ${message.isError ? "error-bubble" : ""}`}
                >
                  {message.content}
                </div>

                <div className="bubble-time">{message.time}</div>
              </div>
            ))}

            {loading && (
              <div className="message-row from-agent">
                <div className="message-bubble agent-bubble typing-bubble">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <form className="composer-wrap" onSubmit={handleSubmit}>
            <button
              className="composer-icon"
              type="button"
              onClick={() => inputRef.current?.focus()}
            >
              ⊕
            </button>

            <div className="composer">
              <input
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="iMessage"
                disabled={loading}
              />
            </div>

            <button
              className="send-button"
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send message"
            >
              ↑
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);