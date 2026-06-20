import { useState } from "react";
import ActionTable from "./ActionTable";
import EmailCard from "./EmailCard";

export default function ResultPanel({ data }) {
  const [activeTab, setActiveTab] = useState("summary"); // 'summary' | 'actions' | 'emails' | 'transcript'
  const [copiedText, setCopiedText] = useState("");

  if (!data) return null;

  const handleCopySection = (type, content) => {
    navigator.clipboard.writeText(content);
    setCopiedText(type);
    setTimeout(() => setCopiedText(""), 2000);
  };

  const getFullCopyableContent = () => {
    let text = `MEETING ANALYSIS REPORT: ${data.title || "Meeting Report"}\n\n`;
    text += `SUMMARY:\n${data.summary}\n\n`;
    
    if (data.action_items && data.action_items.length > 0) {
      text += `ACTION ITEMS:\n`;
      data.action_items.forEach((item) => {
        text += `- Owner: ${item.owner} | Task: ${item.task} | Deadline: ${item.deadline}\n`;
      });
      text += `\n`;
    }

    if (data.draft_emails && data.draft_emails.length > 0) {
      text += `FOLLOW-UP EMAILS:\n`;
      data.draft_emails.forEach((email) => {
        text += `To: ${email.to}\nSubject: ${email.subject}\nBody:\n${email.body}\n---------------------\n`;
      });
    }

    return text;
  };

  return (
    <div className="result-panel" id="result-panel">
      {/* Result Tabs Navigation */}
      <div className="result-tabs-header">
        <div className="result-tabs">
          <button
            className={`result-tab-btn ${activeTab === "summary" ? "active" : ""}`}
            onClick={() => setActiveTab("summary")}
          >
            <span className="tab-icon">📊</span>
            Summary
          </button>
          <button
            className={`result-tab-btn ${activeTab === "actions" ? "active" : ""}`}
            onClick={() => setActiveTab("actions")}
          >
            <span className="tab-icon">✅</span>
            Action Items
            {data.action_items && data.action_items.length > 0 && (
              <span className="tab-count-badge">{data.action_items.length}</span>
            )}
          </button>
          <button
            className={`result-tab-btn ${activeTab === "emails" ? "active" : ""}`}
            onClick={() => setActiveTab("emails")}
          >
            <span className="tab-icon">✉️</span>
            Follow-up Emails
            {data.draft_emails && data.draft_emails.length > 0 && (
              <span className="tab-count-badge">{data.draft_emails.length}</span>
            )}
          </button>
          {data.transcript && (
            <button
              className={`result-tab-btn ${activeTab === "transcript" ? "active" : ""}`}
              onClick={() => setActiveTab("transcript")}
            >
              <span className="tab-icon">🎙️</span>
              Transcript
            </button>
          )}
        </div>

        <div className="result-copy-options">
          <button
            className="copy-section-btn"
            onClick={() => handleCopySection("all", getFullCopyableContent())}
          >
            {copiedText === "all" ? "Copied Report ✓" : "📋 Copy Full Report"}
          </button>
        </div>
      </div>

      {/* Result Tabs Content */}
      <div className="result-tab-content">
        {activeTab === "summary" && (
          <div className="result-card summary-card fade-in">
            <div className="card-top-actions">
              <span className="section-title-icon">📊 Executive Summary</span>
              <button
                className="card-copy-btn"
                onClick={() => handleCopySection("summary", data.summary)}
              >
                {copiedText === "summary" ? "Copied!" : "Copy Text"}
              </button>
            </div>
            <div className="summary-content">
              {data.summary.split("\n").map((paragraph, i) =>
                paragraph.trim() ? <p key={i}>{paragraph}</p> : null
              )}
            </div>
          </div>
        )}

        {activeTab === "actions" && (
          <div className="fade-in">
            {data.action_items && data.action_items.length > 0 ? (
              <ActionTable items={data.action_items} />
            ) : (
              <div className="no-items-card">
                <span>✓</span>
                <p>No action items detected in this transcript.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "emails" && (
          <div className="emails-section fade-in">
            {data.draft_emails && data.draft_emails.length > 0 ? (
              <div className="emails-list">
                {data.draft_emails.map((email, index) => (
                  <EmailCard key={index} email={email} index={index} />
                ))}
              </div>
            ) : (
              <div className="no-items-card">
                <span>✉️</span>
                <p>No draft follow-up emails created.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "transcript" && data.transcript && (
          <div className="result-card transcript-card fade-in">
            <div className="card-top-actions">
              <span className="section-title-icon">🎙️ Decoded Transcript</span>
              <button
                className="card-copy-btn"
                onClick={() => handleCopySection("transcript", data.transcript)}
              >
                {copiedText === "transcript" ? "Copied!" : "Copy Transcript"}
              </button>
            </div>
            <div className="transcript-content">
              <pre>{data.transcript}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
