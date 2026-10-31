/**
 * Meet Focus Tracker - Teacher Dashboard Controller (Role 4)
 * 
 * Handles UI interactions, rendering, Chart.js graphs,
 * sorting, filtering, and event modals.
 */

(function () {
  'use strict';

  // State Management
  let currentMeetingCode = "abc-defg-hij";
  let currentEvents = [];
  let currentStats = [];
  let chartInstance = null;
  let chartViewMode = "switches"; // 'switches' | 'duration'
  let currentSort = "switches-desc";
  let searchFilter = "";
  let isTeacherLoggedIn = false;
  let isSignUpMode = false;
  let pollingTimer = null;
  let currentDateRange = "all"; // 'today' | 'yesterday' | 'last7' | 'all'

  // DOM Elements
  const meetingCodeInput = document.getElementById("meeting-code-input");
  const loadMeetingBtn = document.getElementById("load-meeting-btn");
  const classSelect = document.getElementById("class-select");
  const currentMeetingCodeDisplay = document.getElementById("current-meeting-code-display");

  // KPI elements
  const kpiStudentsCount = document.getElementById("kpi-students-count");
  const kpiSwitchesCount = document.getElementById("kpi-switches-count");
  const kpiTotalAway = document.getElementById("kpi-total-away");
  const kpiLongestAway = document.getElementById("kpi-longest-away");

  // Chart elements
  const chartCanvas = document.getElementById("participantsChart");
  const toggleViewSwitches = document.getElementById("toggle-view-switches");
  const toggleViewDuration = document.getElementById("toggle-view-duration");
  const chartTitleText = document.getElementById("chart-title-text");

  // Table elements
  const participantsTbody = document.getElementById("participants-tbody");
  const emptyStateView = document.getElementById("empty-state-view");
  const participantsTable = document.getElementById("participants-table");
  const emptyStateResetBtn = document.getElementById("empty-state-reset-btn");
  const tableSearchInput = document.getElementById("table-search-input");
  const tableSortSelect = document.getElementById("table-sort-select");
  const exportCsvBtn = document.getElementById("export-csv-btn");
  const sortableHeaders = document.querySelectorAll(".data-table th.sortable");

  // Session dropdown & Insights
  const sessionRangeSelect = document.getElementById("session-range-select");
  const insightTopStudentTitle = document.getElementById("insight-top-student-title");
  const insightTopStudentText = document.getElementById("insight-top-student-text");
  const insightTopStudentContent = document.getElementById("insight-top-student-content");
  const insightAwayBadge = document.getElementById("insight-away-badge");
  const insightAwayContent = document.getElementById("insight-away-content");
  const insightDisconnectedBadge = document.getElementById("insight-disconnected-badge");
  const insightDisconnectedContent = document.getElementById("insight-disconnected-content");

  // Modals
  const teacherLoginBtn = document.getElementById("teacher-login-btn");
  const landingPage = document.getElementById("landing-page");
  const dashboardApp = document.getElementById("dashboard-app");
  const loginModal = document.getElementById("login-modal");
  const loginModalTitle = document.getElementById("login-modal-title");
  const loginModalClose = document.getElementById("login-modal-close");
  const teacherLoginForm = document.getElementById("teacher-login-form");
  const authStatusDot = document.getElementById("auth-status-dot");
  const authBtnLabel = document.getElementById("auth-btn-label");
  const headerTeacherAvatar = document.getElementById("header-teacher-avatar");

  // Auth & Profile DOM elements
  const teacherProfileView = document.getElementById("teacher-profile-view");
  const teacherAuthInputs = document.getElementById("teacher-auth-inputs");
  const authHeading = document.getElementById("auth-heading");
  const authSubtitle = document.getElementById("auth-subtitle");
  const authEnvironmentNote = document.getElementById("auth-environment-note");
  const authModePrompt = document.getElementById("auth-mode-prompt");
  const authModeToggle = document.getElementById("auth-mode-toggle");
  const teacherNameField = document.getElementById("teacher-name-field");
  const teacherNameInput = document.getElementById("teacher-name");
  const loginSubmitBtn = document.getElementById("login-submit-btn");
  const teacherProfileName = document.getElementById("teacher-profile-name");
  const teacherProfileEmail = document.getElementById("teacher-profile-email");
  const teacherProfileAvatar = document.getElementById("teacher-profile-avatar");
  const teacherSignoutBtn = document.getElementById("teacher-signout-btn");
  const googleSigninBtn = document.getElementById("google-signin-btn");
  const supabaseUrlInput = document.getElementById("supabase-url-input");
  const supabaseKeyInput = document.getElementById("supabase-key-input");
  const saveSupabaseSettingsBtn = document.getElementById("save-supabase-settings-btn");
  const footerConnectionText = document.getElementById("footer-connection-text");

  const inspectModal = document.getElementById("inspect-modal");
  const inspectModalClose = document.getElementById("inspect-modal-close");
  const inspectModalTitle = document.getElementById("inspect-modal-title");
  const inspectModalSubtitle = document.getElementById("inspect-modal-subtitle");
  const inspectTimelineList = document.getElementById("inspect-timeline-list");

  const toastNotice = document.getElementById("toast-notice");

  /**
   * Show temporary toast notification
   */
  function showToast(message, duration = 3200) {
    if (!toastNotice) return;
    toastNotice.textContent = message;
    toastNotice.classList.add("show");
    setTimeout(() => {
      toastNotice.classList.remove("show");
    }, duration);
  }

  /**
   * Extracts and cleans meeting codes from raw input or pasted Google Meet URLs.
   */
  function cleanMeetingCode(raw) {
    if (!raw) return '';
    let val = String(raw).trim();
    const urlMatch = val.match(/meet\.google\.com\/([a-zA-Z0-9-]+)/i);
    if (urlMatch && urlMatch[1]) {
      val = urlMatch[1];
    }
    val = val.split('?')[0].split('#')[0].replace(/^\/+|\/+$/g, '');
    return val.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
  }

  /**
   * Determines the initial meeting code with precedence:
   * 1. URL search param (?meeting=... or ?code=...)
   * 2. localStorage saved meeting code
   * 3. Fallback demo code ("abc-defg-hij")
   */
  function getInitialMeetingCode() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlCode = urlParams.get("meeting") || urlParams.get("code");
      if (urlCode && cleanMeetingCode(urlCode)) {
        return cleanMeetingCode(urlCode);
      }
    } catch (e) {
      console.warn("Could not read URL meeting param:", e);
    }

    try {
      const savedCode = localStorage.getItem("last_meeting_code");
      if (savedCode && cleanMeetingCode(savedCode)) {
        return cleanMeetingCode(savedCode);
      }
    } catch (e) {
      console.warn("Could not read saved meeting code from localStorage:", e);
    }

    return "abc-defg-hij";
  }

  /**
   * Loads meeting events using data.js
   */
  async function loadMeetingData(code) {
    if (!code) code = meetingCodeInput.value.trim();
    code = cleanMeetingCode(code);
    if (!code) return;

    currentMeetingCode = code;
    meetingCodeInput.value = code;
    currentMeetingCodeDisplay.textContent = code;

    // Sync class dropdown selection
    if (classSelect) {
      const optExists = Array.from(classSelect.options).some(o => o.value === code);
      if (optExists) {
        classSelect.value = code;
      }
    }

    // Persist chosen meeting code to localStorage
    try {
      localStorage.setItem("last_meeting_code", code);
    } catch (e) {
      console.warn("Could not save meeting code to localStorage:", e);
    }

    // Persist chosen meeting code to URL query parameter without full page reload
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("meeting") !== code) {
        url.searchParams.set("meeting", code);
        window.history.replaceState({ meeting: code }, "", url.toString());
      }
    } catch (e) {
      console.warn("Could not update URL parameter:", e);
    }

    try {
      // Call Role 4 centralized data function, passing active date range filter
      currentEvents = await window.DashboardData.getEvents(currentMeetingCode, { dateRange: currentDateRange });
      currentStats = window.DashboardData.computeParticipantStats(currentEvents);

      renderDashboard();

      // Refresh dynamic meeting chips from database
      updateAvailableMeetingChips();

      // Subscribe to real-time Supabase events if connected
      if (typeof window.DashboardData.subscribeToRealtime === "function") {
        window.DashboardData.subscribeToRealtime(currentMeetingCode, (newEvent) => {
          currentEvents.push(newEvent);
          currentStats = window.DashboardData.computeParticipantStats(currentEvents);
          renderDashboard();
          const name = newEvent.participant || "Student";
          const action = newEvent.type === "left" ? "left Google Meet tab" : "returned to Google Meet";
          showToast(`Live Update: ${name} ${action}`);
        });
      }

      // Live sync fallback: Periodic polling to ensure data never falls out of sync
      if (pollingTimer) clearInterval(pollingTimer);
      pollingTimer = setInterval(async () => {
        try {
          const freshEvents = await window.DashboardData.getEvents(currentMeetingCode, { dateRange: currentDateRange });
          if (Array.isArray(freshEvents) && freshEvents.length !== currentEvents.length) {
            currentEvents = freshEvents;
            currentStats = window.DashboardData.computeParticipantStats(currentEvents);
            renderDashboard();
          }
        } catch (e) {
          // Silently ignore background poll errors
        }
      }, 4000);
    } catch (err) {
      console.error("Failed to load meeting data:", err);
      showToast("Error loading meeting events.");
    }
  }

  /**
   * Dynamically loads all active meeting codes found in the database into the class dropdown
   */
  async function updateAvailableMeetingChips() {
    if (!classSelect || typeof window.DashboardData.getAvailableMeetingCodes !== "function") return;
    try {
      const codes = await window.DashboardData.getAvailableMeetingCodes();
      if (Array.isArray(codes) && codes.length > 0) {
        // Remember current set to avoid unnecessary rebuilds
        const existingCodes = Array.from(classSelect.options).map(o => o.value);
        const codesStr = codes.join(",");
        const existingStr = existingCodes.join(",");
        if (codesStr === existingStr) return;

        classSelect.innerHTML = "";
        codes.forEach(code => {
          const opt = document.createElement("option");
          opt.value = code;
          const isDemo = code === "abc-defg-hij" || code === "xyz-uvwx-rst";
          opt.textContent = isDemo ? `${code} (Demo)` : code;
          if (code === currentMeetingCode) opt.selected = true;
          classSelect.appendChild(opt);
        });
      }
    } catch (e) {
      console.warn("Could not update class dropdown:", e);
    }
  }

  /**
   * Main render coordinator
   */
  function renderDashboard() {
    renderKPIs();
    renderChart();
    renderInsights();
    renderTable();
  }

  /**
   * Render Top KPI cards
   */
  function renderKPIs() {
    if (!currentStats || currentStats.length === 0) {
      kpiStudentsCount.textContent = "0";
      kpiSwitchesCount.textContent = "0";
      kpiTotalAway.textContent = "00:00";
      kpiLongestAway.textContent = "00:00";
      return;
    }

    const totalStudents = currentStats.length;
    const totalSwitches = currentStats.reduce((sum, item) => sum + item.switches, 0);
    const totalAwayMs = currentStats.reduce((sum, item) => sum + item.totalAway, 0);
    const maxSingleAwayMs = Math.max(...currentStats.map(item => item.longestAway), 0);

    kpiStudentsCount.textContent = totalStudents;
    kpiSwitchesCount.textContent = totalSwitches;
    kpiTotalAway.textContent = window.DashboardData.formatDuration(totalAwayMs);
    kpiLongestAway.textContent = window.DashboardData.formatDuration(maxSingleAwayMs);
  }

  /**
   * Render or update Chart.js Bar Chart
   */
  function renderChart() {
    if (!chartCanvas) return;

    if (!currentStats || currentStats.length === 0) {
      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }
      return;
    }

    const labels = currentStats.map(s => s.participant);
    let datasetLabel = "";
    let dataValues = [];
    let backgroundColors = [];
    let borderColors = [];
    let hoverBackgroundColors = [];
    let hoverBorderColors = '#ffffff';
    let yAxisTitleText = chartViewMode === "switches" ? "Tab Switches" : "Time Away (Seconds)";

    if (chartViewMode === "switches") {
      chartTitleText.textContent = "Tab Switches per Participant";
      datasetLabel = "Tab Switches";
      dataValues = currentStats.map(s => s.switches);
      backgroundColors = currentStats.map(s => s.switches > 3 ? 'rgba(244, 63, 94, 0.90)' : 'rgba(56, 189, 248, 0.90)');
      borderColors = currentStats.map(s => s.switches > 3 ? '#f43f5e' : '#38bdf8');
      hoverBackgroundColors = currentStats.map(s => s.switches > 3 ? 'rgba(253, 164, 175, 1)' : 'rgba(125, 211, 252, 1)');
      hoverBorderColors = '#ffffff';
    } else {
      chartTitleText.textContent = "Total Time Away (Seconds) per Participant";
      datasetLabel = "Time Away (seconds)";
      dataValues = currentStats.map(s => Math.round(s.totalAway / 1000));
      backgroundColors = 'rgba(251, 146, 60, 0.90)';
      borderColors = '#fb923c';
      hoverBackgroundColors = 'rgba(253, 186, 116, 1)';
      hoverBorderColors = '#ffffff';
    }

    if (chartInstance) {
      chartInstance.data.labels = labels;
      chartInstance.data.datasets[0].label = datasetLabel;
      chartInstance.data.datasets[0].data = dataValues;
      chartInstance.data.datasets[0].backgroundColor = backgroundColors;
      chartInstance.data.datasets[0].borderColor = borderColors;
      chartInstance.data.datasets[0].hoverBackgroundColor = hoverBackgroundColors;
      chartInstance.data.datasets[0].hoverBorderColor = hoverBorderColors;
      if (chartInstance.options.scales?.y?.title) {
        chartInstance.options.scales.y.title.text = yAxisTitleText;
      }
      chartInstance.update();
      return;
    }

    const ctx = chartCanvas.getContext('2d');
    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: datasetLabel,
          data: dataValues,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 2,
          hoverBackgroundColor: hoverBackgroundColors,
          hoverBorderColor: hoverBorderColors,
          borderRadius: 6,
          maxBarThickness: 48
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: '#0b181c',
            titleColor: '#d5f9ff',
            titleFont: {
              family: 'Plus Jakarta Sans',
              size: 13,
              weight: '700'
            },
            bodyColor: '#96b8c3',
            bodyFont: {
              family: 'Plus Jakarta Sans',
              size: 12,
              weight: '500'
            },
            borderColor: '#5fc0dd',
            borderWidth: 1.5,
            padding: 12,
            boxPadding: 6,
            usePointStyle: true,
            callbacks: {
              label: function (context) {
                if (chartViewMode === "switches") {
                  return ` ${context.parsed.y} tab switch${context.parsed.y === 1 ? '' : 'es'}`;
                }
                const ms = context.parsed.y * 1000;
                return ` Time away: ${window.DashboardData.formatDuration(ms)} (${context.parsed.y}s)`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(46, 77, 87, 0.4)',
              borderColor: '#2e4d57',
              borderWidth: 1.5
            },
            ticks: {
              color: '#d5f9ff',
              font: {
                family: 'Plus Jakarta Sans',
                size: 12,
                weight: '600'
              },
              padding: 6,
              maxRotation: 35,
              autoSkip: false
            },
            title: {
              display: true,
              text: "Participants",
              color: '#96b8c3',
              font: {
                family: 'Plus Jakarta Sans',
                size: 12,
                weight: '600'
              },
              padding: { top: 8 }
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(46, 77, 87, 0.45)',
              borderColor: '#2e4d57',
              borderWidth: 1.5,
              borderDash: [4, 4]
            },
            ticks: {
              stepSize: 1,
              precision: 0,
              color: '#d5f9ff',
              font: {
                family: 'Plus Jakarta Sans',
                size: 12,
                weight: '600'
              },
              padding: 8
            },
            title: {
              display: true,
              text: yAxisTitleText,
              color: '#96b8c3',
              font: {
                family: 'Plus Jakarta Sans',
                size: 12,
                weight: '600'
              },
              padding: { bottom: 8 }
            }
          }
        }
      }
    });
  }

  /**
   * Render Live Insights & Summary Highlights
   */
  function renderInsights() {
    if (!currentStats || currentStats.length === 0) {
      if (insightTopStudentTitle) insightTopStudentTitle.textContent = "Most Frequent Switcher";
      if (insightTopStudentContent) {
        insightTopStudentContent.innerHTML = `<span class="insight-empty-text">No student events recorded for this meeting.</span>`;
      } else if (insightTopStudentText) {
        insightTopStudentText.textContent = "No student events recorded for this meeting.";
      }
      if (insightAwayBadge) insightAwayBadge.textContent = "0";
      if (insightAwayContent) insightAwayContent.innerHTML = `<span class="insight-empty-text">No participants currently away.</span>`;
      if (insightDisconnectedBadge) insightDisconnectedBadge.textContent = "0";
      if (insightDisconnectedContent) insightDisconnectedContent.innerHTML = `<span class="insight-empty-text">No participants disconnected.</span>`;
      return;
    }

    // 1. Currently Away Participants (isCurrentlyAway && !isDisconnected)
    const awayStudents = currentStats.filter(s => s.isCurrentlyAway && !s.isDisconnected);
    if (insightAwayBadge) {
      insightAwayBadge.textContent = awayStudents.length;
    }
    if (insightAwayContent) {
      if (awayStudents.length > 0) {
        insightAwayContent.innerHTML = `
          <div class="insight-names-wrap">
            ${awayStudents.map(s => `
              <span class="insight-name-pill away" title="${escapeHtml(s.participant)}">
                <span class="status-dot"></span>${escapeHtml(s.participant)}
              </span>
            `).join("")}
          </div>
        `;
      } else {
        insightAwayContent.innerHTML = `<span class="insight-empty-text">No participants currently away.</span>`;
      }
    }

    // 2. Disconnected / Idle Participants (isDisconnected / statusCode === 'idle')
    const disconnectedStudents = currentStats.filter(s => s.isDisconnected || s.statusCode === "idle");
    if (insightDisconnectedBadge) {
      insightDisconnectedBadge.textContent = disconnectedStudents.length;
    }
    if (insightDisconnectedContent) {
      if (disconnectedStudents.length > 0) {
        insightDisconnectedContent.innerHTML = `
          <div class="insight-names-wrap">
            ${disconnectedStudents.map(s => `
              <span class="insight-name-pill idle" title="${escapeHtml(s.participant)}">
                <span class="status-dot"></span>${escapeHtml(s.participant)}
              </span>
            `).join("")}
          </div>
        `;
      } else {
        insightDisconnectedContent.innerHTML = `<span class="insight-empty-text">No participants disconnected.</span>`;
      }
    }

    // 3. Most Frequent Participant Who Switched (Easy on the eyes visual format)
    const mostSwitched = [...currentStats].sort((a, b) => b.switches - a.switches)[0];
    if (insightTopStudentTitle) {
      insightTopStudentTitle.textContent = "Most Frequent Switcher";
    }

    if (insightTopStudentContent) {
      if (mostSwitched && mostSwitched.switches > 0) {
        const initials = mostSwitched.participant
          .split(" ")
          .map(n => n[0])
          .slice(0, 2)
          .join("")
          .toUpperCase();

        insightTopStudentContent.innerHTML = `
          <div class="mf-card">
            <div class="mf-student-row">
              <div class="mf-avatar">${initials}</div>
              <span class="mf-name" title="${escapeHtml(mostSwitched.participant)}">${escapeHtml(mostSwitched.participant)}</span>
            </div>
            <div class="mf-stats-row">
              <span class="mf-stat-badge switches" title="${mostSwitched.switches} tab switches">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="16 3 21 3 21 8"></polyline>
                  <line x1="4" y1="20" x2="21" y2="3"></line>
                  <polyline points="21 16 21 21 16 21"></polyline>
                  <line x1="15" y1="15" x2="21" y2="21"></line>
                  <line x1="4" y1="4" x2="9" y2="9"></line>
                </svg>
                <span class="mf-stat-num">${mostSwitched.switches}</span> switches
              </span>
              <span class="mf-stat-badge time" title="${mostSwitched.formattedTotalAway} total away">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span class="mf-stat-num">${mostSwitched.formattedTotalAway}</span> total away
              </span>
            </div>
          </div>
        `;
      } else {
        insightTopStudentContent.innerHTML = `<span class="insight-empty-text">All participants currently have 0 switches.</span>`;
      }
    } else if (insightTopStudentText) {
      if (mostSwitched && mostSwitched.switches > 0) {
        insightTopStudentText.innerHTML = `<strong>${escapeHtml(mostSwitched.participant)}</strong> has <strong>${mostSwitched.switches}</strong> tab switches (${mostSwitched.formattedTotalAway} total away).`;
      } else {
        insightTopStudentText.textContent = "All participants currently have zero recorded tab switches!";
      }
    }
  }

  /**
   * Sort and filter table rows
   */
  function getFilteredAndSortedStats() {
    let list = [...currentStats];

    // Filter by search string
    if (searchFilter.trim() !== "") {
      const q = searchFilter.trim().toLowerCase();
      list = list.filter(item => item.participant.toLowerCase().includes(q));
    }

    // Sort list
    switch (currentSort) {
      case "switches-desc":
        list.sort((a, b) => b.switches - a.switches);
        break;
      case "switches-asc":
        list.sort((a, b) => a.switches - b.switches);
        break;
      case "totalAway-desc":
        list.sort((a, b) => b.totalAway - a.totalAway);
        break;
      case "longestAway-desc":
        list.sort((a, b) => b.longestAway - a.longestAway);
        break;
      case "name-asc":
        list.sort((a, b) => a.participant.localeCompare(b.participant));
        break;
      case "name-desc":
        list.sort((a, b) => b.participant.localeCompare(a.participant));
        break;
      default:
        list.sort((a, b) => b.switches - a.switches);
    }

    return list;
  }

  /**
   * Render Participant Table
   */
  function renderTable() {
    const data = getFilteredAndSortedStats();

    if (data.length === 0) {
      participantsTable.style.display = "none";
      emptyStateView.style.display = "flex";
      return;
    }

    participantsTable.style.display = "table";
    emptyStateView.style.display = "none";
    participantsTbody.innerHTML = "";

    data.forEach(item => {
      const tr = document.createElement("tr");

      // Initials for avatar
      const initials = item.participant
        .split(" ")
        .map(n => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

      // Switch count badge class
      let badgeClass = "count-low";
      if (item.switches >= 4) {
        badgeClass = "count-high";
      } else if (item.switches >= 2) {
        badgeClass = "count-mid";
      }

      // Status pill — three states: active, away, disconnected/idle (>15 min away)
      let statusHtml;
      if (item.statusCode === "idle") {
        statusHtml = `<span class="status-pill idle"><span class="status-dot"></span>Disconnected / Idle</span>`;
      } else if (item.isCurrentlyAway) {
        statusHtml = `<span class="status-pill away"><span class="status-dot"></span>Currently Away</span>`;
      } else {
        statusHtml = `<span class="status-pill active"><span class="status-dot"></span>In Meet</span>`;
      }

      tr.innerHTML = `
        <td>
          <div class="student-cell">
            <div class="avatar-circle">${initials}</div>
            <div>
              <span class="student-name-text">${escapeHtml(item.participant)}</span>
            </div>
          </div>
        </td>
        <td>${statusHtml}</td>
        <td>
          <span class="count-badge ${badgeClass}">${item.switches}</span>
        </td>
        <td>
          <span class="duration-val">${item.formattedTotalAway}</span>
        </td>
        <td>
          <span class="duration-val">${item.formattedLongestAway}</span>
        </td>
        <td>
          <button type="button" class="btn-inspect" data-participant="${escapeHtml(item.participant)}">
            View Log
          </button>
        </td>
      `;

      participantsTbody.appendChild(tr);
    });

    // Attach inspect click handlers
    const inspectButtons = participantsTbody.querySelectorAll(".btn-inspect");
    inspectButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const studentName = btn.getAttribute("data-participant");
        openInspectModal(studentName);
      });
    });
  }

  /**
   * Opens timeline modal for a student
   */
  function openInspectModal(studentName) {
    const student = currentStats.find(s => s.participant === studentName);
    if (!student) return;

    inspectModalTitle.textContent = `${student.participant} - Event History`;
    inspectModalSubtitle.textContent = `Meeting: ${currentMeetingCode} • ${student.events.length} total raw events`;
    inspectTimelineList.innerHTML = "";

    if (student.events.length === 0) {
      inspectTimelineList.innerHTML = `<p style="color: var(--text-muted); padding: 1rem; text-align: center;">No event details available.</p>`;
    } else {
      student.events.forEach((ev, idx) => {
        const date = new Date(ev.timestamp);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const isLeft = ev.type === "left";

        const div = document.createElement("div");
        div.className = `timeline-event-item ${isLeft ? 'type-left' : 'type-returned'}`;
        
        let desc = isLeft ? "Left Google Meet Tab (Focus Lost)" : "Returned to Google Meet";
        let durationInfo = "";
        if (!isLeft && typeof ev.duration === "number") {
          durationInfo = `<span style="color: #fb923c; font-weight: 600;">Away: ${window.DashboardData.formatDuration(ev.duration)}</span>`;
        }

        div.innerHTML = `
          <div style="font-size: 1.1rem; line-height: 1;">${isLeft ? '🚪' : '↩️'}</div>
          <div class="timeline-event-info">
            <div class="timeline-event-header">
              <span>${desc}</span>
              ${durationInfo}
            </div>
            <div class="timeline-event-time">Timestamp: ${timeStr} (${ev.timestamp})</div>
          </div>
        `;

        inspectTimelineList.appendChild(div);
      });
    }

    inspectModal.classList.add("active");
  }

  /**
   * Helper to escape HTML characters
   */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Export participant data to CSV
   */
  function exportCSV() {
    if (!currentStats || currentStats.length === 0) {
      showToast("No data available to export.");
      return;
    }

    const headers = ["Participant", "Meeting Code", "Current Status", "Tab Switches", "Total Time Away (ms)", "Total Away (mm:ss)", "Longest Away (mm:ss)"];
    const rows = currentStats.map(s => [
      `"${s.participant.replace(/"/g, '""')}"`,
      `"${currentMeetingCode}"`,
      `"${s.status}"`,
      s.switches,
      s.totalAway,
      `"${s.formattedTotalAway}"`,
      `"${s.formattedLongestAway}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `focus-report-${currentMeetingCode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Exported focus report CSV.");
  }

  // ==========================================
  // Event Listeners
  // ==========================================

  // Load meeting button
  loadMeetingBtn.addEventListener("click", () => {
    loadMeetingData();
  });

  // Enter key in meeting input
  meetingCodeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      loadMeetingData();
    }
  });

  // Class dropdown — selecting an existing class loads it
  if (classSelect) {
    classSelect.addEventListener("change", (e) => {
      const code = e.target.value;
      if (code) {
        meetingCodeInput.value = code;
        loadMeetingData(code);
      }
    });
  }

  // Chart view toggles
  toggleViewSwitches.addEventListener("click", () => {
    chartViewMode = "switches";
    toggleViewSwitches.classList.add("active");
    toggleViewDuration.classList.remove("active");
    renderChart();
  });

  toggleViewDuration.addEventListener("click", () => {
    chartViewMode = "duration";
    toggleViewDuration.classList.add("active");
    toggleViewSwitches.classList.remove("active");
    renderChart();
  });

  // Search input
  tableSearchInput.addEventListener("input", (e) => {
    searchFilter = e.target.value;
    renderTable();
  });

  // Sort dropdown
  tableSortSelect.addEventListener("change", (e) => {
    currentSort = e.target.value;
    renderTable();
  });

  // Clickable table header sorting
  sortableHeaders.forEach(th => {
    th.addEventListener("click", () => {
      const sortType = th.getAttribute("data-sort");
      if (sortType === "name") {
        currentSort = (currentSort === "name-asc") ? "name-desc" : "name-asc";
      } else if (sortType === "switches") {
        currentSort = (currentSort === "switches-desc") ? "switches-asc" : "switches-desc";
      } else if (sortType === "totalAway") {
        currentSort = (currentSort === "totalAway-desc") ? "totalAway-asc" : "totalAway-desc";
      } else if (sortType === "longestAway") {
        currentSort = (currentSort === "longestAway-desc") ? "longestAway-asc" : "longestAway-desc";
      }
      renderTable();
    });
  });

  // Reset empty state button
  emptyStateResetBtn.addEventListener("click", () => {
    loadMeetingData("abc-defg-hij");
  });

  // Export CSV button
  exportCsvBtn.addEventListener("click", exportCSV);

  // ==========================================
  // Teacher Authentication & Supabase Handlers
  // ==========================================

  function updateTeacherAuthState(user) {
    if (landingPage) landingPage.hidden = Boolean(user);
    if (dashboardApp) dashboardApp.hidden = !user;

    if (user) {
      isTeacherLoggedIn = true;
      if (loginModalTitle) loginModalTitle.textContent = "Teacher Profile";
      if (authStatusDot) {
        authStatusDot.classList.add("logged-in");
        authStatusDot.style.display = "none";
      }

      const displayName = user.user_metadata?.full_name || (user.email ? user.email.split('@')[0] : "Sir (Teacher)");
      const email = user.email || "teacher@gmail.com";

      if (authBtnLabel) {
        authBtnLabel.textContent = displayName;
        authBtnLabel.style.display = "none";
      }
      if (teacherProfileName) teacherProfileName.textContent = displayName;
      if (teacherProfileEmail) teacherProfileEmail.textContent = email;

      const avatarMarkupLarge = user.user_metadata?.avatar_url
        ? `<img src="${user.user_metadata.avatar_url}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`
        : `<svg width="58" height="58" viewBox="0 0 24 24" style="width: 58px; height: 58px; display: block;" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;

      const avatarMarkupHeader = user.user_metadata?.avatar_url
        ? `<img src="${user.user_metadata.avatar_url}" alt="${displayName}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`
        : `<svg width="26" height="26" viewBox="0 0 24 24" style="width: 62%; height: 62%; display: block;" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;

      if (teacherProfileAvatar) {
        teacherProfileAvatar.innerHTML = avatarMarkupLarge;
      }

      if (headerTeacherAvatar) {
        headerTeacherAvatar.innerHTML = avatarMarkupHeader;
        headerTeacherAvatar.style.display = "flex";
      }

      if (teacherLoginBtn) {
        teacherLoginBtn.classList.add("logged-in");
        teacherLoginBtn.title = displayName;
        teacherLoginBtn.setAttribute("aria-label", `Teacher profile: ${displayName}`);
      }

      if (teacherProfileView) teacherProfileView.style.display = "block";
      if (teacherAuthInputs) teacherAuthInputs.style.display = "none";
    } else {
      isTeacherLoggedIn = false;
      if (loginModalTitle) loginModalTitle.textContent = "Teacher Authentication";
      if (authStatusDot) {
        authStatusDot.style.display = "";
        authStatusDot.classList.remove("logged-in");
      }
      if (authBtnLabel) {
        authBtnLabel.style.display = "";
        authBtnLabel.textContent = "Teacher Login";
      }
      if (headerTeacherAvatar) {
        headerTeacherAvatar.style.display = "none";
        headerTeacherAvatar.innerHTML = "";
      }
      if (teacherLoginBtn) {
        teacherLoginBtn.classList.remove("logged-in");
        teacherLoginBtn.removeAttribute("title");
        teacherLoginBtn.setAttribute("aria-label", "Teacher Login");
      }

      if (teacherProfileView) teacherProfileView.style.display = "none";
      if (teacherAuthInputs) teacherAuthInputs.style.display = "block";
    }
    updateConnectionStatusBadge();
  }

  function updateConnectionStatusBadge() {
    const config = window.DashboardData.getSupabaseConfig();
    if (!footerConnectionText) return;

    if (config.isConfigured) {
      if (isTeacherLoggedIn) {
        footerConnectionText.textContent = "Supabase: Authenticated & Live (focus_events)";
        if (footerConnectionText.previousElementSibling) {
          footerConnectionText.previousElementSibling.style.background = "var(--success)";
        }
      } else {
        footerConnectionText.textContent = "Supabase: Connected (Sign in to unlock full student RLS)";
        if (footerConnectionText.previousElementSibling) {
          footerConnectionText.previousElementSibling.style.background = "var(--info)";
        }
      }
    } else {
      footerConnectionText.textContent = "Backend: Mock Mode (Ready for Supabase credentials)";
      if (footerConnectionText.previousElementSibling) {
        footerConnectionText.previousElementSibling.style.background = "var(--warning)";
      }
    }
  }

  function updateAuthEnvironmentNote() {
    if (!authEnvironmentNote) return;
    const config = window.DashboardData.getSupabaseConfig();
    authEnvironmentNote.hidden = config.isConfigured;
    authEnvironmentNote.textContent = config.isConfigured
      ? ""
      : "Preview mode is active. Connect Supabase in Connection settings to create real accounts.";
  }

  // Teacher Login Modal Handlers
  teacherLoginBtn.addEventListener("click", () => {
    if (loginModalTitle) {
      loginModalTitle.textContent = isTeacherLoggedIn ? "Teacher Profile" : "Teacher Authentication";
    }

    // Populate current config in settings input
    const config = window.DashboardData.getSupabaseConfig();
    if (supabaseUrlInput && !supabaseUrlInput.value) supabaseUrlInput.value = config.url;
    if (supabaseKeyInput && !supabaseKeyInput.value) supabaseKeyInput.value = config.key;

    loginModal.classList.add("active");
  });

  loginModalClose.addEventListener("click", () => {
    loginModal.classList.remove("active");
  });

  loginModal.addEventListener("click", (e) => {
    if (e.target === loginModal) {
      loginModal.classList.remove("active");
    }
  });

  if (authModeToggle) {
    authModeToggle.addEventListener("click", () => {
      isSignUpMode = !isSignUpMode;
      teacherNameField.hidden = !isSignUpMode;
      teacherNameInput.required = isSignUpMode;
      document.getElementById("teacher-password").autocomplete = isSignUpMode ? "new-password" : "current-password";
      authHeading.textContent = isSignUpMode ? "Create your account" : "Welcome back";
      authSubtitle.textContent = isSignUpMode
        ? "Create an account to access your teacher dashboard."
        : "Sign in to continue to your dashboard.";
      authModePrompt.textContent = isSignUpMode ? "Already have an account?" : "New to Meet Focus Tracker?";
      authModeToggle.textContent = isSignUpMode ? "Sign in" : "Create an account";
      loginSubmitBtn.textContent = isSignUpMode ? "Create account" : "Sign in";
    });
  }

  // Google (Gmail) One-Click Sign In
  if (googleSigninBtn) {
    googleSigninBtn.addEventListener("click", async () => {
      try {
        showToast("Connecting to Google / Gmail authentication...");
        await window.DashboardData.signInWithGoogle();
      } catch (err) {
        console.error("Google sign-in error:", err);
        showToast(err.message || "Could not start Google sign in. Verify Supabase URL & Key.");
      }
    });
  }

  // Teacher Sign Out
  if (teacherSignoutBtn) {
    teacherSignoutBtn.addEventListener("click", async () => {
      try {
        await window.DashboardData.signOut();
        try { localStorage.removeItem("demo_teacher_user"); } catch (e) {}
        updateTeacherAuthState(null);
        loginModal.classList.remove("active");
        showToast("Signed out successfully.");
      } catch (err) {
        console.error("Sign out error:", err);
      }
    });
  }

  // Teacher Email/Password Authentication
  teacherLoginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("teacher-email").value.trim();
    const password = document.getElementById("teacher-password").value;

    if (isSignUpMode) {
      try {
        const { user, session } = await window.DashboardData.signUpWithEmail(
          email,
          password,
          teacherNameInput.value.trim()
        );
        if (session && user) {
          updateTeacherAuthState(user);
          showToast("Account created. Welcome to Meet Focus Tracker!");
          updateAvailableMeetingChips();
          loadMeetingData();
        } else if (user) {
          showToast("Account created. Check your email to confirm your account, then sign in.");
        } else {
          showToast("Account creation did not return a user. Please try again.");
        }
      } catch (err) {
        console.error("Account creation error:", err);
        showToast(err.message || "Could not create your account.");
      }
      return;
    }

    const config = window.DashboardData.getSupabaseConfig();
    try {
      const data = await window.DashboardData.signInWithEmail(email, password);
      if (data && data.user) {
        try { localStorage.removeItem("demo_teacher_user"); } catch (e) {}
        updateTeacherAuthState(data.user);
        showToast(`Welcome back, ${data.user.email}!`);
        updateAvailableMeetingChips();
        loadMeetingData();
        return;
      }
    } catch (err) {
      if (config.isConfigured) {
        console.error("Sign-in error:", err);
        showToast(err.message || "Could not sign in. Check your email and password.");
        return;
      }
    }

    if (config.isConfigured) {
      showToast("Sign-in did not return a user. Please try again.");
      return;
    }

    showToast("Preview mode: opening the demo dashboard.");
    isTeacherLoggedIn = true;
    const demoUser = {
      email: email,
      user_metadata: { full_name: email.split('@')[0] }
    };
    try {
      localStorage.setItem("demo_teacher_user", JSON.stringify(demoUser));
    } catch (e) {}
    updateTeacherAuthState(demoUser);
    updateAvailableMeetingChips();
    loadMeetingData();
  });

  // Save Supabase Settings Button
  if (saveSupabaseSettingsBtn) {
    saveSupabaseSettingsBtn.addEventListener("click", () => {
      const url = supabaseUrlInput.value.trim();
      const key = supabaseKeyInput.value.trim();
      if (!url || !key) {
        showToast("Please enter both Supabase URL and Anon Key.");
        return;
      }
      const client = window.DashboardData.saveSupabaseSettings(url, key);
      if (!client) {
        showToast("Could not connect to Supabase. Check the project URL, anon key, and browser connection.");
        authEnvironmentNote.hidden = false;
        authEnvironmentNote.textContent = "Supabase could not connect. Check the project URL and anon key.";
        updateConnectionStatusBadge();
        return;
      }
      showToast("Supabase configuration saved & connected!");
      updateAuthEnvironmentNote();
      updateConnectionStatusBadge();
    });
  }

  // Inspect Modal Close Handlers
  inspectModalClose.addEventListener("click", () => {
    inspectModal.classList.remove("active");
  });

  inspectModal.addEventListener("click", (e) => {
    if (e.target === inspectModal) {
      inspectModal.classList.remove("active");
    }
  });

  // Initial load & Auth Listener
  async function initApp() {
    // Check initial user session (Supabase or saved demo login)
    let currentUser = null;
    if (typeof window.DashboardData.getCurrentUser === "function") {
      currentUser = await window.DashboardData.getCurrentUser();
    }
    if (!currentUser) {
      try {
        const savedDemo = localStorage.getItem("demo_teacher_user");
        if (savedDemo) currentUser = JSON.parse(savedDemo);
      } catch (e) {}
    }

    if (currentUser) {
      updateTeacherAuthState(currentUser);
      updateAvailableMeetingChips();
      loadMeetingData(getInitialMeetingCode());
    } else {
      updateConnectionStatusBadge();
    }

    // Listen for auth state changes
    if (typeof window.DashboardData.onAuthStateChange === "function") {
      window.DashboardData.onAuthStateChange((event, session) => {
        if (session && session.user) {
          updateTeacherAuthState(session.user);
          updateAvailableMeetingChips();
          loadMeetingData();
        } else if (event === "SIGNED_OUT") {
          updateTeacherAuthState(null);
        }
      });
    }

    const config = window.DashboardData.getSupabaseConfig();
    if (supabaseUrlInput && !supabaseUrlInput.value) supabaseUrlInput.value = config.url;
    if (supabaseKeyInput && !supabaseKeyInput.value) supabaseKeyInput.value = config.key;
    updateAuthEnvironmentNote();

    // Session Date Range Filter Dropdown (Aligned Right)
    const DATE_RANGE_LABELS = {
      all: "All Time",
      today: "Today",
      yesterday: "Yesterday",
      last7: "Last 7 Days"
    };

    if (sessionRangeSelect) {
      sessionRangeSelect.value = currentDateRange || "all";
      sessionRangeSelect.addEventListener("change", (e) => {
        const range = e.target.value;
        if (!range || range === currentDateRange) return;

        currentDateRange = range;

        // Update table subtitle to reflect active filter
        const subtitleEl = document.getElementById("table-subtitle");
        if (subtitleEl) {
          const label = DATE_RANGE_LABELS[range] || range;
          subtitleEl.innerHTML = `Showing focus data for meeting: <span id="current-meeting-code-display" style="font-family: monospace; color: var(--accent-primary);">${currentMeetingCode}</span> &mdash; <span style="color: var(--warning); font-weight: 600;">${label}</span>`;
        }

        showToast(`Filtering by: ${DATE_RANGE_LABELS[range] || range}`);
        loadMeetingData(currentMeetingCode);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }

  // Handle browser back and forward navigation
  window.addEventListener("popstate", () => {
    const code = getInitialMeetingCode();
    if (code && code !== currentMeetingCode) {
      loadMeetingData(code);
    }
  });

})();
