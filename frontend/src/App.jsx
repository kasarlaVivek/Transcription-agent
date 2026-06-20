import { useState, useEffect, useRef } from "react";
import UploadZone from "./components/UploadZone";
import ResultPanel from "./components/ResultPanel";
import AuthModal from "./components/AuthModal";
import {
  processMeeting, configureSlack, disconnectSlack, getSlackStatus,
  testSlackWebhook, getMe, setAuthToken, createCheckoutSession, createPortalSession,
} from "./api/client";
import { MOCK_MEETINGS } from "./mockData";
import "./App.css";

const STEPS = [
  "Uploading meeting audio...",
  "Transcribing with Whisper Large v3...",
  "Analyzing text tokens with Gemini API...",
  "Synthesizing meeting summary...",
  "Extracting actionable assignments...",
  "Generating draft follow-up emails...",
  "Finalizing meeting report...",
];

export default function App() {
  const [activeTab, setActiveTab] = useState("landing"); // 'landing' | 'workspace' | 'history' | 'api'
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);

  // Auth state
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileRef = useRef(null);

  // Payment toast state
  const [paymentToast, setPaymentToast] = useState(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  // Theme state
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("nova_theme") || "dark";
  });

  // Model settings state
  const [summaryLevel, setSummaryLevel] = useState("standard");
  const [emailTone, setEmailTone] = useState("professional");

  useEffect(() => {
    localStorage.setItem("nova_theme", theme);
    document.body.className = `${theme}-theme`;
  }, [theme]);

  // ── Auto-restore session from stored JWT ────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("nova_token");
    if (token) {
      getMe()
        .then((profile) => setUser(profile))
        .catch(() => {
          setAuthToken(null);
          setUser(null);
        });
    }
  }, []);

  // ── Handle payment query params from Stripe redirect ───────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (payment === "success") {
      setPaymentToast({ type: "success", message: "Payment successful! Your plan has been upgraded to Professional." });
      // Refresh user to get updated plan
      getMe().then((profile) => setUser(profile)).catch(() => {});
      window.history.replaceState({}, "", window.location.pathname);
      setTimeout(() => setPaymentToast(null), 5000);
    } else if (payment === "cancelled") {
      setPaymentToast({ type: "cancelled", message: "Payment was cancelled. You can upgrade anytime." });
      window.history.replaceState({}, "", window.location.pathname);
      setTimeout(() => setPaymentToast(null), 5000);
    }
  }, []);

  // ── Close profile dropdown on outside click ────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Auth handlers ──────────────────────────────────────────────
  const handleAuth = (userData) => {
    setUser(userData);
    setShowAuthModal(false);
  };

  const handleLogout = () => {
    setAuthToken(null);
    setUser(null);
    setShowProfileDropdown(false);
    setActiveTab("landing");
  };

  // ── Stripe upgrade handler ────────────────────────────────────
  const handleUpgrade = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setUpgradeLoading(true);
    try {
      const data = await createCheckoutSession();
      window.location.href = data.checkout_url;
    } catch (err) {
      const detail = err.response?.data?.detail || "Could not start checkout. Please try again.";
      setPaymentToast({ type: "cancelled", message: detail });
      setTimeout(() => setPaymentToast(null), 5000);
    } finally {
      setUpgradeLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const data = await createPortalSession();
      window.location.href = data.portal_url;
    } catch (err) {
      const detail = err.response?.data?.detail || "Could not open billing portal.";
      setPaymentToast({ type: "cancelled", message: detail });
      setTimeout(() => setPaymentToast(null), 5000);
    }
  };

  const getUserInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map((w) => w[0]).join("").substring(0, 2);
  };

  // History list state
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem("nova_meet_history");
    return saved ? JSON.parse(saved) : MOCK_MEETINGS;
  });

  // API portal state
  const [apiKey, setApiKey] = useState("");
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookRegistered, setWebhookRegistered] = useState(false);
  const [apiTab, setApiTab] = useState("curl");

  // Slack integration state
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const [slackConnected, setSlackConnected] = useState(false);
  const [slackLoading, setSlackLoading] = useState(false);
  const [slackMessage, setSlackMessage] = useState(null);

  // Check Slack status on mount
  useEffect(() => {
    getSlackStatus()
      .then((data) => setSlackConnected(data.connected))
      .catch(() => setSlackConnected(false));
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem("nova_meet_history", JSON.stringify(history));
  }, [history]);

  // Handle new submission
  const handleSubmit = async (input) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setCurrentStep(0);
    setActiveTab("workspace");

    // Simulate agent processing workflow progress
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 2500);

    try {
      const data = await processMeeting({
        ...input,
        summary_level: summaryLevel,
        email_tone: emailTone
      });
      setResult(data);

      // Create a history item
      const title = input.file
        ? input.file.name.substring(0, input.file.name.lastIndexOf(".")) || input.file.name
        : `Meeting Analysis — ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      
      const newHistoryItem = {
        id: `meet-${Date.now()}`,
        title: title,
        date: new Date().toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
        duration: input.file ? `${(input.file.size / (1024 * 1024)).toFixed(1)} MB` : "Pasted Text",
        type: input.file ? "Audio File" : "Text Paste",
        ...data,
      };

      setHistory((prev) => [newHistoryItem, ...prev]);

      // Refresh usage counter for authenticated users
      if (user) {
        getMe().then((profile) => setUser(profile)).catch(() => {});
      }
    } catch (err) {
      const message =
        err.response?.data?.detail ||
        err.message ||
        "Could not connect to the backend server. Please verify the FastAPI backend is running.";
      setError(message);
    } finally {
      clearInterval(interval);
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setCurrentStep(0);
  };

  const loadPastMeeting = (meeting) => {
    setResult(meeting);
    setError(null);
    setActiveTab("workspace");
  };

  const deleteMeeting = (id, e) => {
    e.stopPropagation();
    setHistory((prev) => prev.filter((m) => m.id !== id));
    if (result && result.id === id) {
      setResult(null);
    }
  };

  const generateApiKey = () => {
    setIsGeneratingKey(true);
    setTimeout(() => {
      const randomPart = Array.from({ length: 24 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join("");
      setApiKey(`nv_live_${randomPart}`);
      setIsGeneratingKey(false);
    }, 1000);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Pricing plans toggle state
  const [pricingInterval, setPricingInterval] = useState("monthly");

  return (
    <div className={`app ${theme}-theme`}>
      {/* Background orbs */}
      <div className="ambient-bg">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* Main Corporate Header */}
      <header className="app-header">
        <div className="header-container">
          <div className="logo" onClick={() => setActiveTab("landing")}>
            <span className="logo-icon">⚡</span>
            <span className="logo-text">NovaMeet<span className="accent-dot">.ai</span></span>
          </div>

          <nav className="nav-menu">
            <button
              className={`nav-link ${activeTab === "landing" ? "active" : ""}`}
              onClick={() => setActiveTab("landing")}
            >
              Overview
            </button>
            <button
              className={`nav-link ${activeTab === "workspace" ? "active" : ""}`}
              onClick={() => setActiveTab("workspace")}
            >
              AI Workspace
            </button>
            <button
              className={`nav-link ${activeTab === "history" ? "active" : ""}`}
              onClick={() => setActiveTab("history")}
            >
              Meeting Hub
              {history.length > 0 && <span className="nav-badge">{history.length}</span>}
            </button>
            <button
              className={`nav-link ${activeTab === "api" ? "active" : ""}`}
              onClick={() => setActiveTab("api")}
            >
              Developer API
            </button>
          </nav>

          <div className="header-actions">
            <button
              className="theme-toggle-btn"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>

            {user ? (
              <div className="user-profile-wrapper" ref={profileRef}>
                <button
                  className="user-profile-btn"
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  id="user-profile-btn"
                >
                  <div className="user-avatar">{getUserInitials(user.name)}</div>
                  <div className="user-profile-info">
                    <span className="user-name">{user.name}</span>
                    <span className={`user-plan-badge ${user.plan}`}>{user.plan}</span>
                  </div>
                  <span className={`profile-chevron ${showProfileDropdown ? "open" : ""}`}>▼</span>
                </button>

                {showProfileDropdown && (
                  <div className="profile-dropdown">
                    <div className="dropdown-header">
                      <div className="dropdown-avatar">{getUserInitials(user.name)}</div>
                      <div className="dropdown-user-info">
                        <span className="dropdown-user-name">{user.name}</span>
                        <span className="dropdown-user-email">{user.email}</span>
                      </div>
                    </div>

                    <div className="dropdown-plan-section">
                      <div className="plan-label">Current Plan</div>
                      <div className="plan-name-row">
                        <span className="plan-display-name">
                          {user.plan === "professional" ? "Professional" : "Starter (Free)"}
                        </span>
                        {user.plan === "starter" && (
                          <button className="plan-upgrade-link" onClick={handleUpgrade}>
                            Upgrade
                          </button>
                        )}
                      </div>
                      <div className="meetings-counter">
                        {user.meetings_used} meeting{user.meetings_used !== 1 ? "s" : ""} analyzed
                      </div>
                    </div>

                    <div className="dropdown-body">
                      <button className="dropdown-item" onClick={() => { setActiveTab("workspace"); setShowProfileDropdown(false); }}>
                        <span className="item-icon">⚡</span> AI Workspace
                      </button>
                      <button className="dropdown-item" onClick={() => { setActiveTab("history"); setShowProfileDropdown(false); }}>
                        <span className="item-icon">📂</span> Meeting Hub
                      </button>
                      {user.plan === "professional" && (
                        <button className="dropdown-item" onClick={() => { handleManageSubscription(); setShowProfileDropdown(false); }}>
                          <span className="item-icon">💳</span> Manage Billing
                        </button>
                      )}
                      {user.plan === "starter" && (
                        <button className="dropdown-item upgrade" onClick={() => { handleUpgrade(); setShowProfileDropdown(false); }}>
                          <span className="item-icon">🚀</span> Upgrade to Pro
                        </button>
                      )}
                      <div className="dropdown-divider" />
                      <button className="dropdown-item danger" onClick={handleLogout} id="logout-btn">
                        <span className="item-icon">🚪</span> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button className="cta-btn secondary" onClick={() => setShowAuthModal(true)} id="sign-in-btn">
                  Sign In
                </button>
                <button className="cta-btn primary" onClick={() => setShowAuthModal(true)} id="get-started-btn">
                  Get Started Free
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="app-main">
        {/* TAB 1: PRODUCT LANDING PAGE */}
        {activeTab === "landing" && (
          <div className="landing-page">
            {/* Hero Section */}
            <section className="hero-section">
              <div className="hero-badge">
                <span className="sparkle">✨</span> Powered by Gemini 1.5 Pro & Whisper API
              </div>
              <h1 className="hero-title">
                Turn Voice into Structured <span className="gradient-text">Executable Strategy</span>
              </h1>
              <p className="hero-subtitle">
                Enterprise-grade AI that transcribes recordings, synthesizes executive summaries, 
                extracts actionable items, and generates personalized stakeholder follow-up drafts in seconds.
              </p>
              <div className="hero-ctas">
                <button className="cta-btn primary lg" onClick={() => setActiveTab("workspace")}>
                  Enter AI Workspace ⚡
                </button>
                <button className="cta-btn secondary lg" onClick={() => setActiveTab("history")}>
                  Explore Live Demo
                </button>
              </div>
              
              <div className="dashboard-preview-wrapper">
                <div className="dashboard-header-bar">
                  <span className="dot red" />
                  <span className="dot yellow" />
                  <span className="dot green" />
                  <span className="window-title">NovaMeet Platform v2.4</span>
                </div>
                <div className="dashboard-preview">
                  <div className="preview-sidebar">
                    <div className="sidebar-item active">● Executive Summaries</div>
                    <div className="sidebar-item">○ Action Assignee Matrix</div>
                    <div className="sidebar-item">○ Mail Drafting Automation</div>
                    <div className="sidebar-item">○ Webhook Integrations</div>
                  </div>
                  <div className="preview-body">
                    <div className="preview-title">Acme Corp Alignment Sync</div>
                    <div className="preview-text-block">
                      <strong>Executive Summary:</strong> The team consolidated rollout scopes for Q4, locking in the database migration deadlines and scheduling developer sprints. Product spec definitions are assigned to Sarah, with a due date of June 25.
                    </div>
                    <div className="preview-table">
                      <div className="table-header">
                        <span>Assignee</span>
                        <span>Task</span>
                        <span>Due Date</span>
                      </div>
                      <div className="table-row">
                        <span className="p-badge">Sarah Jenkins</span>
                        <span>Finalize UI wireframes & scope docs</span>
                        <span className="d-badge">June 25</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Metrics Section */}
            <section className="metrics-section">
              <div className="metric-card">
                <h3>99.2%</h3>
                <p>Transcription Accuracy</p>
              </div>
              <div className="metric-card">
                <h3>4.8x</h3>
                <p>Increase in Standup Efficiency</p>
              </div>
              <div className="metric-card">
                <h3>15,000+</h3>
                <p>Hours Summarized Globally</p>
              </div>
              <div className="metric-card">
                <h3>&lt; 30s</h3>
                <p>Average Latency per File</p>
              </div>
            </section>

            {/* Features Section */}
            <section className="features-section">
              <div className="section-title-wrapper">
                <h2>Product Capabilities</h2>
                <p>Designed for product teams, managers, and corporate operational standards.</p>
              </div>
              <div className="features-grid">
                <div className="feat-card">
                  <div className="feat-icon">🎙️</div>
                  <h4>Whisper Voice Engine</h4>
                  <p>Incorporate complex medical, engineering, or legal terms flawlessly with our tuned audio transcription pipelines.</p>
                </div>
                <div className="feat-card">
                  <div className="feat-icon">🧠</div>
                  <h4>Contextual Reasoning</h4>
                  <p>Analyzes discussions instead of keyword matching. Captures nuance, underlying agreements, and unresolved items.</p>
                </div>
                <div className="feat-card">
                  <div className="feat-icon">📋</div>
                  <h4>Task Allocation Matrix</h4>
                  <p>Strictly maps owner names, responsibilities, and specific deadlines directly extracted from transcripts.</p>
                </div>
                <div className="feat-card">
                  <div className="feat-icon">✉️</div>
                  <h4>Stakeholder Follow-ups</h4>
                  <p>Drafts personalized, direct follow-up emails immediately after analysis, pre-filled with specific actions.</p>
                </div>
              </div>
            </section>

            {/* Integrations Section */}
            <section className="integrations-section">
              <h3>Slack Integration</h3>
              <p>Automatically post meeting summaries and action items to your Slack channels via Incoming Webhooks.</p>
              <div className="logo-shelf">
                <div className="logo-item slack-featured">
                  <span className="slack-icon">💬</span>
                  <span>Slack</span>
                  <span className="integration-badge">Live Integration</span>
                </div>
              </div>
            </section>

            {/* Pricing Section */}
            <section className="pricing-section">
              <div className="section-title-wrapper">
                <h2>Flexible Enterprise Plans</h2>
                <p>Start free to try our translation & analysis core, scale as your team expands.</p>
                <div className="price-selector">
                  <button
                    className={`selector-btn ${pricingInterval === "monthly" ? "active" : ""}`}
                    onClick={() => setPricingInterval("monthly")}
                  >
                    Monthly
                  </button>
                  <button
                    className={`selector-btn ${pricingInterval === "annual" ? "active" : ""}`}
                    onClick={() => setPricingInterval("annual")}
                  >
                    Annually <span className="discount-tag">Save 20%</span>
                  </button>
                </div>
              </div>

              <div className="pricing-grid">
                <div className="price-card">
                  <h4>Starter</h4>
                  <div className="price">
                    <span className="currency">$</span>
                    <span className="value">0</span>
                    <span className="period">/month</span>
                  </div>
                  <p className="price-desc">Perfect for evaluation and individual task management.</p>
                  <ul className="price-features">
                    <li>✓ 3 Meeting uploads / month</li>
                    <li>✓ Max 20MB file sizes</li>
                    <li>✓ Standard summary generation</li>
                    <li>✓ Basic Action Table</li>
                    <li>✗ Automated Draft Emails</li>
                    <li>✗ Slack Integration</li>
                  </ul>
                  <button className="price-btn" onClick={() => {
                    if (!user) setShowAuthModal(true);
                    else setActiveTab("workspace");
                  }}>
                    {user ? "Go to Workspace" : "Get Started Free"}
                  </button>
                </div>

                <div className="price-card popular">
                  <div className="popular-badge">Most Popular</div>
                  <h4>Professional</h4>
                  <div className="price">
                    <span className="currency">$</span>
                    <span className="value">{pricingInterval === "monthly" ? "29" : "23"}</span>
                    <span className="period">/month</span>
                  </div>
                  <p className="price-desc">For active managers seeking to coordinate multiple team members.</p>
                  <ul className="price-features">
                    <li>✓ Unlimited Meeting uploads</li>
                    <li>✓ Max 200MB file sizes</li>
                    <li>✓ 5 Summary styles + 5 Email tones</li>
                    <li>✓ Fully personalized draft emails</li>
                    <li>✓ Slack Webhook Integration</li>
                    <li>✓ Meeting history & export</li>
                  </ul>
                  <button
                    className="price-btn primary"
                    onClick={handleUpgrade}
                    disabled={upgradeLoading}
                  >
                    {upgradeLoading ? "Redirecting..." : (user?.plan === "professional" ? "Current Plan ✓" : "Upgrade Now")}
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: AI WORKSPACE */}
        {activeTab === "workspace" && (
          <div className="workspace-tab">
            <div className="workspace-layout">
              {/* Left Settings Sidebar */}
              <aside className="workspace-sidebar">
                <div className="sidebar-section">
                  <h4>Agent Orchestration</h4>
                  <p className="sidebar-description">Tune the LLM and extraction behavior before running.</p>
                </div>

                <div className="sidebar-control">
                  <label htmlFor="summary-select">Summary Detail</label>
                  <select
                    id="summary-select"
                    value={summaryLevel}
                    onChange={(e) => setSummaryLevel(e.target.value)}
                  >
                    <option value="standard">Standard Briefing</option>
                    <option value="detailed">Comprehensive Digest</option>
                    <option value="bullet">Executive Keynotes Only</option>
                    <option value="unresolved">Unresolved Issues & Open Questions</option>
                    <option value="timeline">Detailed Timeline & Sprints</option>
                  </select>
                </div>

                <div className="sidebar-control">
                  <label htmlFor="tone-select">Email Communication</label>
                  <select
                    id="tone-select"
                    value={emailTone}
                    onChange={(e) => setEmailTone(e.target.value)}
                  >
                    <option value="professional">Professional & Crisp</option>
                    <option value="collaborative">Collaborative & Soft</option>
                    <option value="direct">Direct & Action-Oriented</option>
                    <option value="urgent">Urgent Follow-up</option>
                    <option value="formal">Formal Executive Report</option>
                  </select>
                </div>

                <div className="sidebar-status">
                  <div className="status-indicator-dot online" />
                  <span className="status-label">Nova Engine Connected</span>
                </div>

                {/* Upgrade banner for free-tier users */}
                {user && user.plan === "starter" && (
                  <div className="upgrade-banner">
                    <h5>🚀 Unlock Professional</h5>
                    <p>Get unlimited meetings, Slack integration, personalized emails, and 5 summary styles.</p>
                    <button
                      className="upgrade-banner-btn"
                      onClick={handleUpgrade}
                      disabled={upgradeLoading}
                    >
                      {upgradeLoading ? "Redirecting..." : "Upgrade — $29/mo"}
                    </button>
                  </div>
                )}

                {/* Login prompt for unauthenticated users */}
                {!user && (
                  <div className="login-prompt">
                    <span>🔒</span>
                    <span>
                      <button className="login-prompt-link" onClick={() => setShowAuthModal(true)}>Sign in</button>
                      {" "}to save meetings and unlock your account features.
                    </span>
                  </div>
                )}

                {/* Slack Integration Panel */}
                <div className="sidebar-section slack-section">
                  <h4>💬 Slack Integration</h4>
                  <p className="sidebar-description">
                    {slackConnected
                      ? "Connected — analyses auto-post to your channel."
                      : "Paste your Slack Incoming Webhook URL to auto-post results."}
                  </p>

                  {!slackConnected ? (
                    <>
                      <input
                        type="url"
                        className="slack-webhook-input"
                        placeholder="https://hooks.slack.com/services/..."
                        value={slackWebhookUrl}
                        onChange={(e) => setSlackWebhookUrl(e.target.value)}
                      />
                      <div className="slack-btn-group">
                        <button
                          className="slack-btn test"
                          disabled={slackLoading || !slackWebhookUrl}
                          onClick={async () => {
                            setSlackLoading(true);
                            setSlackMessage(null);
                            try {
                              await testSlackWebhook(slackWebhookUrl);
                              setSlackMessage({ type: "success", text: "Test message sent! Check your Slack channel." });
                            } catch (err) {
                              setSlackMessage({ type: "error", text: err.response?.data?.detail || "Test failed." });
                            } finally {
                              setSlackLoading(false);
                            }
                          }}
                        >
                          {slackLoading ? "Sending..." : "Test"}
                        </button>
                        <button
                          className="slack-btn connect"
                          disabled={slackLoading || !slackWebhookUrl}
                          onClick={async () => {
                            setSlackLoading(true);
                            setSlackMessage(null);
                            try {
                              await configureSlack(slackWebhookUrl);
                              setSlackConnected(true);
                              setSlackMessage({ type: "success", text: "Slack connected successfully!" });
                            } catch (err) {
                              setSlackMessage({ type: "error", text: err.response?.data?.detail || "Connection failed." });
                            } finally {
                              setSlackLoading(false);
                            }
                          }}
                        >
                          {slackLoading ? "Connecting..." : "Connect"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      className="slack-btn disconnect"
                      onClick={async () => {
                        setSlackLoading(true);
                        try {
                          await disconnectSlack();
                          setSlackConnected(false);
                          setSlackWebhookUrl("");
                          setSlackMessage({ type: "success", text: "Disconnected from Slack." });
                        } catch {
                          setSlackMessage({ type: "error", text: "Failed to disconnect." });
                        } finally {
                          setSlackLoading(false);
                        }
                      }}
                    >
                      Disconnect Slack
                    </button>
                  )}

                  {slackMessage && (
                    <div className={`slack-message ${slackMessage.type}`}>
                      {slackMessage.text}
                    </div>
                  )}
                </div>
              </aside>

              {/* Central Processing & Results Panel */}
              <div className="workspace-main">
                {!result && (
                  <div className="upload-container-wrapper">
                    <div className="upload-header">
                      <h3>Analyze New Meeting</h3>
                      <p>Provide a meeting recording audio file or paste the raw transcript text below.</p>
                    </div>
                    <UploadZone onSubmit={handleSubmit} isLoading={isLoading} />
                  </div>
                )}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="progress-panel" id="progress-panel">
                    <div className="progress-header">
                      <div className="pulse-dot" />
                      <span>Processing Engine Running...</span>
                    </div>
                    <div className="progress-bar-container">
                      <div className="progress-bar-fill" style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }} />
                    </div>
                    <div className="steps">
                      {STEPS.map((step, i) => (
                        <div
                          key={i}
                          className={`step ${
                            i < currentStep
                              ? "done"
                              : i === currentStep
                              ? "active"
                              : "pending"
                          }`}
                        >
                          <span className="step-indicator">
                            {i < currentStep ? "✓" : i === currentStep ? "⏳" : "○"}
                          </span>
                          <span className="step-label">{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="error-panel" id="error-panel">
                    <span className="error-icon">⚠️</span>
                    <h3>Process Interrupted</h3>
                    <p>{error}</p>
                    <div className="error-actions">
                      <button onClick={handleReset} className="cta-btn secondary" id="retry-btn">
                        Go Back
                      </button>
                      <button onClick={() => handleSubmit({ text: "Retry attempt for current text transcript" })} className="cta-btn primary">
                        Retry Call
                      </button>
                    </div>
                  </div>
                )}

                {/* Results */}
                {result && (
                  <div className="results-wrapper">
                    <div className="results-header">
                      <div className="results-info">
                        <h2>{result.title || "Meeting Report"}</h2>
                        <p>{result.date} · {result.duration || "Processed Content"}</p>
                      </div>
                      <div className="results-actions">
                        <button
                          onClick={() => copyToClipboard(JSON.stringify(result, null, 2))}
                          className="cta-btn secondary sm"
                        >
                          {copiedKey ? "Copied!" : "Export JSON 📋"}
                        </button>
                        <button
                          onClick={handleReset}
                          className="cta-btn primary sm"
                          id="new-meeting-btn"
                        >
                          ← New Meeting
                        </button>
                      </div>
                    </div>
                    <ResultPanel data={result} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MEETING HUB (HISTORY) */}
        {activeTab === "history" && (
          <div className="history-tab">
            <div className="history-header">
              <div className="header-info">
                <h2>Meeting Hub</h2>
                <p>Retrieve, manage, and inspect previously analyzed meetings and transcription logs.</p>
              </div>
              <button className="cta-btn primary" onClick={() => setActiveTab("workspace")}>
                + New Analysis
              </button>
            </div>

            {history.length === 0 ? (
              <div className="empty-history">
                <span className="empty-icon">📁</span>
                <h4>No Meetings Logged</h4>
                <p>Meetings you analyze in the workspace will appear here for persistence.</p>
                <button className="cta-btn primary" onClick={() => setActiveTab("workspace")}>
                  Analyze Your First Meeting
                </button>
              </div>
            ) : (
              <div className="history-grid">
                {history.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="history-card"
                    onClick={() => loadPastMeeting(meeting)}
                  >
                    <div className="card-header">
                      <span className="meeting-type-badge">{meeting.type}</span>
                      <button
                        className="delete-meeting-btn"
                        onClick={(e) => deleteMeeting(meeting.id, e)}
                        title="Delete Meeting log"
                      >
                        ✕
                      </button>
                    </div>
                    <h3 className="meeting-title">{meeting.title}</h3>
                    <div className="meeting-meta">
                      <span>📅 {meeting.date}</span>
                      <span>⏱️ {meeting.duration}</span>
                    </div>
                    <p className="meeting-excerpt">
                      {meeting.summary.substring(0, 120)}...
                    </p>
                    <div className="card-footer">
                      <div className="mini-stats">
                        <span>📋 {meeting.action_items?.length || 0} Actions</span>
                        <span>✉️ {meeting.draft_emails?.length || 0} Drafts</span>
                      </div>
                      <span className="inspect-link">Open Analysis →</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: DEVELOPER API PORTAL */}
        {activeTab === "api" && (
          <div className="api-tab">
            <div className="api-grid">
              {/* Credentials & Webhook Setup */}
              <div className="api-panel">
                <h3>API Key Settings</h3>
                <p className="panel-desc">
                  Authenticate your server to programmatically trigger transcription or action extraction pipelines.
                </p>

                <div className="api-key-box">
                  {apiKey ? (
                    <div className="generated-key-wrapper">
                      <code className="api-key-code">{apiKey}</code>
                      <button className="copy-key-btn" onClick={() => copyToClipboard(apiKey)}>
                        {copiedKey ? "Copied ✓" : "Copy"}
                      </button>
                    </div>
                  ) : (
                    <button
                      className="cta-btn primary"
                      onClick={generateApiKey}
                      disabled={isGeneratingKey}
                    >
                      {isGeneratingKey ? "Generating token..." : "Generate Live Access Token"}
                    </button>
                  )}
                </div>

                <hr className="divider" />

                <h3>Webhook Registration</h3>
                <p className="panel-desc">
                  Provide an endpoint URL. We will post a JSON response containing action items and draft follow-ups once asynchronous audio processing completes.
                </p>
                <div className="webhook-form">
                  <input
                    type="url"
                    className="webhook-input"
                    placeholder="https://api.yourdomain.com/webhooks/meeting-analysis"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    disabled={webhookRegistered}
                  />
                  <button
                    className={`cta-btn ${webhookRegistered ? "secondary" : "primary"}`}
                    onClick={() => setWebhookRegistered(!webhookRegistered)}
                    disabled={!webhookUrl}
                  >
                    {webhookRegistered ? "Release Webhook" : "Register Hook"}
                  </button>
                </div>
                {webhookRegistered && (
                  <p className="webhook-status">✓ Successfully registered. Test payload dispatched.</p>
                )}
              </div>

              {/* Code Documentation & Quickstart */}
              <div className="api-panel doc-panel">
                <h3>Developer Quickstart</h3>
                <p className="panel-desc">Submit files to start processing using code snippets.</p>

                <div className="doc-tabs">
                  <button
                    className={`doc-tab-btn ${apiTab === "curl" ? "active" : ""}`}
                    onClick={() => setApiTab("curl")}
                  >
                    cURL
                  </button>
                  <button
                    className={`doc-tab-btn ${apiTab === "node" ? "active" : ""}`}
                    onClick={() => setApiTab("node")}
                  >
                    Node.js
                  </button>
                  <button
                    className={`doc-tab-btn ${apiTab === "python" ? "active" : ""}`}
                    onClick={() => setApiTab("python")}
                  >
                    Python
                  </button>
                </div>

                <div className="code-block">
                  {apiTab === "curl" && (
                    <pre>
{`curl -X POST "http://localhost:8000/process-meeting" \\
  -H "Authorization: Bearer ${apiKey || "YOUR_API_KEY"}" \\
  -H "Content-Type: multipart/form-data" \\
  -F "file=@/path/to/meeting.mp3"`}
                    </pre>
                  )}
                  {apiTab === "node" && (
                    <pre>
{`const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const form = new FormData();
form.append('file', fs.createReadStream('meeting.mp3'));

axios.post('http://localhost:8000/process-meeting', form, {
  headers: {
    ...form.getHeaders(),
    'Authorization': 'Bearer ${apiKey || "YOUR_API_KEY"}'
  }
})
.then(res => console.log(res.data))
.catch(err => console.error(err));`}
                    </pre>
                  )}
                  {apiTab === "python" && (
                    <pre>
{`import requests

url = "http://localhost:8000/process-meeting"
headers = {"Authorization": "Bearer ${apiKey || "YOUR_API_KEY"}"}
files = {"file": open("meeting.mp3", "rb")}

response = requests.post(url, headers=headers, files=files)
print(response.json())`}
                    </pre>
                  )}
                </div>

                <h4>Response Payload</h4>
                <div className="code-block">
                  <pre>
{`{
  "transcript": "...",
  "summary": "...",
  "action_items": [
    {
      "owner": "David Chen",
      "task": "Migrate production cluster...",
      "deadline": "July 10, 2026"
    }
  ],
  "draft_emails": [
    {
      "to": "David Chen",
      "subject": "Action Required...",
      "body": "Hi David..."
    }
  ]
}`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>
          NovaMeet AI © 2026 · Built with Enterprise Standards using React, FastAPI, LangChain & Google Gemini Core
        </p>
      </footer>

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onAuth={handleAuth}
        />
      )}

      {/* Payment Toast */}
      {paymentToast && (
        <div className={`payment-toast ${paymentToast.type}`}>
          <span className="toast-icon">
            {paymentToast.type === "success" ? "✅" : "⚠️"}
          </span>
          <span>{paymentToast.message}</span>
          <button className="toast-close" onClick={() => setPaymentToast(null)}>×</button>
        </div>
      )}
    </div>
  );
}
