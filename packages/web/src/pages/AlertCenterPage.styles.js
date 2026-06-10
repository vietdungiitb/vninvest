export const CORE_STYLES = `
:root {
        --neon-green: #00e676;
        --neon-red: #ff1744;
        --neon-orange: #ff9100;
        --neon-blue: #2979ff;
        --neon-grey: #8a99ad;
        --neon-purple: #cc66ff;

        --bg-primary: #07090e;
        --bg-surface: #0e1320;
        --bg-glass: rgba(14, 19, 32, 0.85);
        --border-glass: rgba(255, 255, 255, 0.08);
        --border-hover: rgba(255, 255, 255, 0.16);
        --text-main: #f5f6f8;
        --text-muted: #8a99ad;
        --glow-shadow: 0 0 15px rgba(41, 121, 255, 0.25);
      }

      .core-alert-center-page {
        background-color: var(--bg-primary);
        color: var(--text-main);
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        min-height: 100vh;
        padding: 30px;
        box-sizing: border-box;
      }

      /* Animations */
      @keyframes pulse-live {
        0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 230, 118, 0.8); }
        70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(0, 230, 118, 0); }
        100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 230, 118, 0); }
      }

      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      /* Header styling */
      .core-alert-center-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 25px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        padding-bottom: 22px;
        flex-wrap: wrap;
        gap: 20px;
      }

      .core-alert-center-header h1 {
        font-size: 2.1rem;
        font-weight: 800;
        margin: 0 0 6px 0;
        background: linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        letter-spacing: -0.5px;
      }

      .core-alert-center-subtitle {
        color: var(--text-muted);
        font-size: 0.95rem;
        margin: 0;
      }

      /* LIVE Status */
      .core-alert-live-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--neon-green);
        text-transform: uppercase;
        letter-spacing: 1px;
        background: rgba(0, 230, 118, 0.08);
        border: 1px solid rgba(0, 230, 118, 0.2);
        padding: 4px 12px;
        border-radius: 20px;
      }

      .core-alert-live-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: var(--neon-green);
        animation: pulse-live 1.8s infinite;
      }

      .core-alert-live-badge.is-paused {
        color: var(--text-muted);
        background: rgba(255, 255, 255, 0.04);
        border-color: rgba(255, 255, 255, 0.08);
      }

      .core-alert-live-badge.is-paused .core-alert-live-dot {
        background-color: var(--text-muted);
        animation: none;
      }

      /* Filters & Switcher */
      .core-alert-center-filter-bar {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .core-alert-center-filter-field {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--bg-surface);
        border: 1px solid var(--border-glass);
        padding: 6px 12px;
        border-radius: 8px;
      }

      .core-alert-center-filter-field span {
        font-size: 0.8rem;
        color: var(--text-muted);
        text-transform: uppercase;
        font-weight: 600;
      }

      .core-alert-center-filter-field input {
        background: transparent;
        border: none;
        outline: none;
        color: var(--text-main);
        font-size: 0.9rem;
        width: 110px;
        font-weight: 700;
      }

      .core-alert-center-filter-field input::placeholder {
        color: rgba(255, 255, 255, 0.2);
      }

      .core-alert-center-filter-bar button {
        background: var(--neon-blue);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: 700;
        padding: 8px 18px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .core-alert-center-filter-bar button:hover {
        background: #1976d2;
        transform: translateY(-1px);
        box-shadow: var(--glow-shadow);
      }

      /* Combined Controls Bar */
      .core-alert-combined-controls {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        flex-wrap: wrap;
        gap: 15px;
      }

      .core-alert-lane-block {
        display: flex;
        gap: 8px;
      }

      .core-alert-center-lane-button {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid var(--border-glass);
        color: var(--text-muted);
        padding: 6px 16px;
        border-radius: 20px;
        cursor: pointer;
        font-size: 0.85rem;
        font-weight: 600;
        transition: all 0.2s ease;
      }

      .core-alert-center-lane-button:hover {
        border-color: rgba(255, 255, 255, 0.15);
        color: var(--text-main);
      }

      .core-alert-center-lane-button.is-active {
        background: rgba(41, 121, 255, 0.1);
        border-color: var(--neon-blue);
        color: #82b1ff;
      }

      /* Timeframe selector strip */
      .core-alert-time-strip {
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 255, 255, 0.02);
        padding: 4px 12px;
        border-radius: 30px;
        border: 1px solid rgba(255, 255, 255, 0.03);
        width: fit-content;
      }

      .core-alert-time-label {
        font-size: 0.72rem;
        font-weight: 700;
        color: var(--text-muted);
        text-transform: uppercase;
        margin-right: 6px;
      }

      .core-alert-time-btn {
        background: transparent;
        border: none;
        color: var(--text-muted);
        font-size: 0.75rem;
        font-weight: 700;
        padding: 3px 10px;
        border-radius: 15px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .core-alert-time-btn:hover {
        color: var(--text-main);
        background: rgba(255, 255, 255, 0.05);
      }

      .core-alert-time-btn.is-active {
        background: var(--neon-blue);
        color: white;
      }

      /* Summary Dashboard Metrics */
      .core-alert-center-summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 15px;
        margin-bottom: 30px;
      }

      .core-alert-center-summary-card {
        background: var(--bg-glass);
        border: 1px solid var(--border-glass);
        border-radius: 12px;
        padding: 12px 16px;
        backdrop-filter: blur(16px);
        transition: all 0.25s ease;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        position: relative;
        overflow: hidden;
      }

      .core-alert-center-summary-card:hover {
        border-color: var(--border-hover);
        transform: translateY(-2px);
      }

      .core-alert-center-summary-card::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        width: 3px;
        height: 100%;
        background-color: var(--neon-blue);
        opacity: 0.5;
      }

      .core-alert-center-summary-card.severity-high::before {
        background-color: var(--neon-orange);
      }

      .core-alert-center-summary-card.is-highlighted::before {
        background-color: var(--neon-purple);
      }

      .core-alert-center-summary-label {
        font-size: 0.7rem;
        color: var(--text-muted);
        text-transform: uppercase;
        font-weight: 700;
        letter-spacing: 0.5px;
        margin-bottom: 4px;
      }

      .core-alert-center-summary-value {
        font-size: 1.5rem;
        font-weight: 800;
        margin: 0;
        font-family: monospace;
      }

      /* Two Column Layout */
      .core-alert-dashboard-container {
        display: grid;
        grid-template-columns: 1.6fr 1fr;
        gap: 30px;
        align-items: start;
      }

      @media (max-width: 1024px) {
        .core-alert-dashboard-container {
          grid-template-columns: 1fr;
        }
      }

      /* Section Headers */
      .core-section-title {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin: 0 0 20px 0;
        font-size: 1.3rem;
        font-weight: 800;
        border-left: 4px solid var(--neon-blue);
        padding-left: 12px;
      }

      /* Module 1: Alert Feed styles */
      .core-feed-control-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid var(--border-glass);
        padding: 8px 16px;
        border-radius: 8px;
        margin-bottom: 15px;
        flex-wrap: wrap;
        gap: 10px;
      }

      .core-feed-control-left {
        display: flex;
        gap: 8px;
      }

      .core-feed-sort-btn {
        background: transparent;
        border: none;
        color: var(--text-muted);
        font-size: 0.8rem;
        font-weight: 700;
        cursor: pointer;
        padding: 4px 10px;
        border-radius: 4px;
        transition: all 0.2s ease;
      }

      .core-feed-sort-btn:hover {
        color: var(--text-main);
      }

      .core-feed-sort-btn.is-active {
        background: rgba(255, 255, 255, 0.08);
        color: var(--text-main);
      }

      .core-feed-refresh-group {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .core-feed-auto-toggle {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.8rem;
        color: var(--text-muted);
        cursor: pointer;
        user-select: none;
      }

      .core-feed-auto-toggle input {
        cursor: pointer;
      }

      .core-feed-refresh-btn {
        background: transparent;
        border: 1px solid var(--border-glass);
        color: var(--text-muted);
        border-radius: 6px;
        padding: 6px 12px;
        cursor: pointer;
        font-size: 0.8rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
      }

      .core-feed-refresh-btn:hover {
        border-color: rgba(255, 255, 255, 0.2);
        color: var(--text-main);
        background: rgba(255, 255, 255, 0.02);
      }

      .core-feed-refresh-btn svg.is-spinning {
        animation: spin 0.8s linear infinite;
      }

      .core-alert-center-list {
        display: flex;
        flex-direction: column;
        gap: 15px;
      }

      .core-alert-center-card {
        background: var(--bg-glass);
        border: 1px solid var(--border-glass);
        border-radius: 12px;
        padding: 20px;
        backdrop-filter: blur(16px);
        position: relative;
        transition: all 0.25s ease;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      }

      .core-alert-center-card:hover {
        border-color: var(--border-hover);
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
      }

      /* Card Severity Glows */
      .core-alert-center-card::after {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        width: 4px;
        height: 100%;
        border-top-left-radius: 12px;
        border-bottom-left-radius: 12px;
        background-color: var(--neon-blue);
      }

      .core-alert-center-card.severity-critical::after {
        background-color: var(--neon-red);
      }
      .core-alert-center-card.severity-critical {
        box-shadow: 0 4px 24px rgba(255, 23, 68, 0.06);
      }

      .core-alert-center-card.severity-high::after {
        background-color: var(--neon-orange);
      }
      .core-alert-center-card.severity-high {
        box-shadow: 0 4px 24px rgba(255, 145, 0, 0.06);
      }

      .core-alert-center-card.severity-low::after {
        background-color: var(--neon-grey);
      }

      .core-alert-center-card-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 12px;
        gap: 15px;
      }

      .core-alert-center-card-title {
        font-size: 1.15rem;
        font-weight: 700;
        margin: 0 0 6px 0;
        color: white;
      }

      .core-alert-center-card-meta {
        margin: 0;
        font-size: 0.85rem;
        color: var(--text-muted);
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .core-alert-symbol-badge {
        background: rgba(41, 121, 255, 0.15);
        color: #82b1ff;
        font-weight: 800;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.8rem;
        border: 1px solid rgba(41, 121, 255, 0.25);
      }

      .core-alert-center-badge {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        padding: 3px 10px;
        border-radius: 4px;
        letter-spacing: 0.5px;
      }

      .core-alert-center-badge.severity-critical {
        background: rgba(255, 23, 68, 0.12);
        color: #ff5252;
        border: 1px solid rgba(255, 23, 68, 0.2);
      }

      .core-alert-center-badge.severity-high {
        background: rgba(255, 145, 0, 0.12);
        color: #ffab40;
        border: 1px solid rgba(255, 145, 0, 0.2);
      }

      .core-alert-center-badge.severity-medium {
        background: rgba(41, 121, 255, 0.12);
        color: #448aff;
        border: 1px solid rgba(41, 121, 255, 0.2);
      }

      .core-alert-center-badge.severity-low {
        background: rgba(255, 255, 255, 0.05);
        color: var(--text-muted);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .core-alert-center-card-summary {
        font-size: 0.95rem;
        line-height: 1.5;
        margin: 0 0 15px 0;
        color: rgba(255, 255, 255, 0.85);
      }

      .core-alert-center-card-metrics {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 10px;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.03);
        padding: 12px 15px;
        border-radius: 8px;
        margin-bottom: 15px;
        font-size: 0.85rem;
      }

      .core-alert-center-card-metrics span {
        color: var(--text-muted);
      }

      .core-alert-center-card-metrics strong {
        color: white;
        font-family: monospace;
      }

      /* Side / Direction Colors */
      .direction-buy {
        color: var(--neon-green) !important;
        font-weight: 700;
      }

      .direction-sell {
        color: var(--neon-red) !important;
        font-weight: 700;
      }

      /* Expandable Evidence list */
      .core-evidence-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 0.8rem;
        color: var(--text-muted);
        font-weight: 700;
        text-transform: uppercase;
        cursor: pointer;
        padding: 6px 12px;
        background: rgba(255, 255, 255, 0.02);
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.04);
        margin-bottom: 12px;
        transition: all 0.2s ease;
      }

      .core-evidence-header:hover {
        background: rgba(255, 255, 255, 0.04);
        color: var(--text-main);
      }

      .core-alert-center-evidence-list {
        margin: 0 0 15px 0;
        padding-left: 20px;
        font-size: 0.82rem;
        color: var(--text-muted);
        display: flex;
        flex-direction: column;
        gap: 6px;
        background: rgba(0, 0, 0, 0.15);
        padding: 12px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.03);
      }

      .core-alert-center-evidence-list li {
        list-style-type: square;
        word-break: break-all;
      }

      /* Card actions row */
      .core-alert-card-actions {
        display: flex;
        gap: 10px;
        margin-top: 15px;
        flex-wrap: wrap;
      }

      .core-alert-card-actions button {
        background: rgba(255, 255, 255, 0.04);
        color: var(--text-muted);
        border: 1px solid var(--border-glass);
        font-size: 0.8rem;
        font-weight: 700;
        padding: 6px 14px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .core-alert-card-actions button:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.08);
        color: var(--text-main);
        border-color: var(--border-hover);
      }

      .core-alert-card-actions button.is-primary {
        background: rgba(41, 121, 255, 0.1);
        border-color: rgba(41, 121, 255, 0.3);
        color: #82b1ff;
      }

      .core-alert-card-actions button.is-primary:hover:not(:disabled) {
        background: var(--neon-blue);
        color: white;
        box-shadow: var(--glow-shadow);
      }

      /* Symmetrical Dashboard Panel */
      .core-dashboard-panel {
        background: var(--bg-surface);
        border: 1px solid var(--border-glass);
        border-radius: 12px;
        padding: 22px;
        backdrop-filter: blur(20px);
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);
        display: flex;
        flex-direction: column;
        height: 640px; /* Force strict equal height */
        box-sizing: border-box;
      }

      .core-symbol-stats-search {
        display: flex;
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid var(--border-glass);
        border-radius: 8px;
        padding: 8px 12px;
        margin-bottom: 20px;
        align-items: center;
        gap: 10px;
      }

      .core-symbol-stats-search input {
        background: transparent;
        border: none;
        outline: none;
        color: var(--text-main);
        font-size: 0.85rem;
        font-weight: 600;
        width: 100%;
      }

      .core-symbol-stats-search input::placeholder {
        color: rgba(255, 255, 255, 0.2);
      }

      .core-symbol-stats-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
      }

      .core-symbol-stats-table th {
        text-align: left;
        color: var(--text-muted);
        font-weight: 700;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        text-transform: uppercase;
        font-size: 0.75rem;
      }

      .core-symbol-stats-table td {
        padding: 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        vertical-align: middle;
      }

      .core-symbol-stats-row:hover {
        background: rgba(255, 255, 255, 0.01);
      }

      .core-stats-symbol-badge {
        font-weight: 800;
        color: white;
        background: rgba(255, 255, 255, 0.05);
        padding: 3px 8px;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        display: inline-flex;
        align-items: center;
        gap: 6px;
        text-decoration: none;
        transition: all 0.2s ease;
      }

      .core-stats-symbol-badge:hover {
        background: var(--neon-blue);
        border-color: var(--neon-blue);
        box-shadow: var(--glow-shadow);
      }

      .core-stats-frequency-badge {
        font-size: 0.7rem;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
      }

      .core-stats-frequency-badge.freq-explosive {
        background: rgba(255, 23, 68, 0.12);
        color: #ff5252;
        border: 1px solid rgba(255, 23, 68, 0.2);
      }

      .core-stats-frequency-badge.freq-high {
        background: rgba(255, 145, 0, 0.12);
        color: #ffab40;
        border: 1px solid rgba(255, 145, 0, 0.2);
      }

      .core-stats-frequency-badge.freq-medium {
        background: rgba(41, 121, 255, 0.12);
        color: #448aff;
        border: 1px solid rgba(41, 121, 255, 0.2);
      }

      .core-stats-frequency-badge.freq-low {
        background: rgba(255, 255, 255, 0.05);
        color: var(--text-muted);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      /* Buy/Sell graphical Strength Meter */
      .core-stats-strength-container {
        display: flex;
        flex-direction: column;
        gap: 4px;
        width: 100%;
        max-width: 120px;
      }

      .core-stats-strength-text {
        font-size: 0.72rem;
        color: var(--text-muted);
        display: flex;
        justify-content: space-between;
      }

      .core-stats-strength-bar {
        display: flex;
        height: 6px;
        border-radius: 3px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.08);
        width: 100%;
      }

      .core-stats-strength-buy {
        background-color: var(--neon-green);
        height: 100%;
      }

      .core-stats-strength-sell {
        background-color: var(--neon-red);
        height: 100%;
      }

      .core-stats-strength-neutral {
        background-color: var(--neon-grey);
        height: 100%;
      }

      /* Detail Forensic Drawer styles */
      .core-detail-drawer {
        background: var(--bg-surface);
        border: 1px solid rgba(41, 121, 255, 0.3);
        border-radius: 12px;
        padding: 22px;
        margin-top: 30px;
        box-shadow: 0 8px 32px rgba(41, 121, 255, 0.1);
        backdrop-filter: blur(20px);
        position: relative;
      }

      .core-detail-drawer::after {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 3px;
        background: linear-gradient(90deg, var(--neon-blue) 0%, var(--neon-purple) 100%);
        border-top-left-radius: 12px;
        border-top-right-radius: 12px;
      }

      .core-detail-title-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
      }

      .core-detail-title-row h3 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 800;
        color: white;
      }

      .core-detail-close-btn {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid var(--border-glass);
        color: var(--text-muted);
        border-radius: 50%;
        width: 26px;
        height: 26px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 0.8rem;
        font-weight: 700;
      }

      .core-detail-close-btn:hover {
        background: rgba(255, 23, 68, 0.1);
        color: var(--neon-red);
        border-color: rgba(255, 23, 68, 0.2);
      }

      .core-detail-section {
        background: rgba(0, 0, 0, 0.15);
        padding: 15px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.03);
        margin-bottom: 15px;
      }

      .core-detail-section h4 {
        margin: 0 0 10px 0;
        font-size: 0.85rem;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--text-muted);
      }

      .core-detail-section p {
        margin: 0;
        font-size: 0.95rem;
        line-height: 1.6;
        color: rgba(255, 255, 255, 0.9);
      }

      .core-detail-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
      }

      .core-detail-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .core-detail-item span {
        font-size: 0.75rem;
        color: var(--text-muted);
        text-transform: uppercase;
        font-weight: 700;
      }

      .core-detail-item strong {
        font-size: 1rem;
        color: white;
      }

      .core-loading {
        color: var(--neon-blue);
        font-weight: 700;
        font-size: 0.95rem;
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 20px 0;
      }

      .core-loading::before {
        content: "";
        width: 14px;
        height: 14px;
        border: 2px solid var(--neon-blue);
        border-top-color: transparent;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        display: inline-block;
      }

      .core-error {
        background: rgba(255, 23, 68, 0.08);
        border: 1px solid rgba(255, 23, 68, 0.15);
        color: #ff5252;
        padding: 12px 18px;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: 600;
        margin: 20px 0;
      }

      .core-empty {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid var(--border-glass);
        color: var(--text-muted);
        text-align: center;
        padding: 40px 20px;
        border-radius: 12px;
        font-size: 0.95rem;
        font-weight: 600;
      }

      .core-scrollable-container {
        flex: 1;
        overflow-y: auto;
        padding-right: 8px;
        box-sizing: border-box;
      }

      /* Custom premium scrollbars */
      .core-scrollable-container::-webkit-scrollbar {
        width: 6px;
      }
      .core-scrollable-container::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.02);
        border-radius: 3px;
      }
      .core-scrollable-container::-webkit-scrollbar-thumb {
        background: rgba(41, 121, 255, 0.25);
        border-radius: 3px;
        transition: background 0.2s ease;
      }
      .core-scrollable-container::-webkit-scrollbar-thumb:hover {
        background: rgba(41, 121, 255, 0.45);
      }

      /* Pagination controls styling */
      .core-pagination-controls {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-top: 15px;
        padding-top: 15px;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
      }

      .core-pagination-btn {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid var(--border-glass);
        color: var(--text-muted);
        padding: 5px 10px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.8rem;
        font-weight: 700;
        transition: all 0.2s ease;
        min-width: 32px;
        text-align: center;
      }

      .core-pagination-btn:hover:not(:disabled) {
        background: rgba(41, 121, 255, 0.1);
        border-color: var(--neon-blue);
        color: white;
      }

      .core-pagination-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }

      .core-pagination-info {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--text-muted);
        padding: 0 10px;
      }
`;