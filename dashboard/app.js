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

  // DOM Elements
  const meetingCodeInput = document.getElementById("meeting-code-input");
  const loadMeetingBtn = document.getElementById("load-meeting-btn");
  const quickCodeChips = document.querySelectorAll(".chip-btn");
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

  // Insights
  const insightTopStudentTitle = document.getElementById("insight-top-student-title");
  const insightTopStudentText = document.getElementById("insight-top-student-text");

  // Modals
  const teacherLoginBtn = document.getElementById("teacher-login-btn");
  const loginModal = document.getElementById("login-modal");
  const loginModalClose = document.getElementById("login-modal-close");
  const teacherLoginForm = document.getElementById("teacher-login-form");
  const authStatusDot = document.getElementById("auth-status-dot");
  const authBtnLabel = document.getElementById("auth-btn-label");

  // Auth & Profile DOM elements
  const teacherProfileView = document.getElementById("teacher-profile-view");
  const teacherAuthInputs = document.getElementById("teacher-auth-inputs");
  const teacherProfileName = document.getElementById("teacher-profile-name");
  const teacherProfileEmail = document.getElementById("teacher-profile-email");
  const teacherProfileAvatar = document.getElementById("teacher-profile-avatar");
  const teacherSignoutBtn = document.getElementById("teacher-signout-btn");
  const googleSigninBtn = document.getElementById("google-signin-btn");
  const toggleSupabaseSettings = document.getElementById("toggle-supabase-settings");
  const supabaseSettingsBox = document.getElementById("supabase-settings-box");
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
   * Loads meeting events using data.js
   */
  async function loadMeetingData(code) {
    if (!code) code = meetingCodeInput.value.trim();
    if (!code) return;

    currentMeetingCode = code;
    meetingCodeInput.value = code;
    currentMeetingCodeDisplay.textContent = code;

    try {
      // Call Role 4 centralized data function
      currentEvents = await window.DashboardData.getEvents(currentMeetingCode);
      currentStats = window.DashboardData.computeParticipantStats(currentEvents);

      renderDashboard();

      // Subscribe to real-time Supabase events if connected
      if (typeof window.DashboardData.subscribeToRealtime === "function") {
        window.DashboardData.subscribeToRealtime(currentMeetingCode, (newEvent) => {
          currentEvents.push(newEvent);
          currentStats = window.DashboardData.computeParticipantStats(currentEvents);
          renderDashboard();
          const name = newEvent.participant || "Student";
          const action = newEvent.type === "left" ? "left Google Meet tab" : "returned to Google Meet";
          showToast(`⚡ Live Update: ${name} ${action}`);
        });
      }
    } catch (err) {
      console.error("Failed to load meeting data:", err);
      showToast("Error loading meeting events.");
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

    if (chartViewMode === "switches") {
      chartTitleText.textContent = "Tab Switches per Participant";
      datasetLabel = "Tab Switches";
      dataValues = currentStats.map(s => s.switches);
      backgroundColors = currentStats.map(s => s.switches > 3 ? 'rgba(239, 68, 68, 0.75)' : 'rgba(99, 102, 241, 0.75)');
      borderColors = currentStats.map(s => s.switches > 3 ? '#ef4444' : '#6366f1');
    } else {
      chartTitleText.textContent = "Total Time Away (Seconds) per Participant";
      datasetLabel = "Time Away (seconds)";
      dataValues = currentStats.map(s => Math.round(s.totalAway / 1000));
      backgroundColors = 'rgba(6, 182, 212, 0.75)';
      borderColors = '#06b6d4';
    }

    if (chartInstance) {
      chartInstance.data.labels = labels;
      chartInstance.data.datasets[0].label = datasetLabel;
      chartInstance.data.datasets[0].data = dataValues;
      chartInstance.data.datasets[0].backgroundColor = backgroundColors;
      chartInstance.data.datasets[0].borderColor = borderColors;
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
          borderWidth: 1.5,
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
            backgroundColor: '#182234',
            titleColor: '#f8fafc',
            bodyColor: '#94a3b8',
            borderColor: '#243048',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: function (context) {
                if (chartViewMode === "switches") {
                  return ` ${context.parsed.y} tab switches`;
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
              color: 'rgba(255, 255, 255, 0.04)'
            },
            ticks: {
              color: '#94a3b8',
              font: {
                family: 'Plus Jakarta Sans',
                size: 11
              }
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.06)'
            },
            ticks: {
              stepSize: 1,
              color: '#94a3b8',
              font: {
                family: 'Plus Jakarta Sans',
                size: 11
              }
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
      insightTopStudentTitle.textContent = "No Activity";
      insightTopStudentText.textContent = "No student events recorded for this meeting.";
      return;
    }

    // Find participant with highest switch count
    const mostSwitched = [...currentStats].sort((a, b) => b.switches - a.switches)[0];
    if (mostSwitched && mostSwitched.switches > 0) {
      insightTopStudentTitle.textContent = `Most Frequent: ${mostSwitched.participant}`;
      insightTopStudentText.textContent = `${mostSwitched.switches} tab switches recorded, with ${mostSwitched.formattedTotalAway} total time outside Google Meet.`;
    } else {
      insightTopStudentTitle.textContent = "High Class Focus";
      insightTopStudentText.textContent = "All participants currently have zero recorded tab switches!";
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

      // Status pill
      const statusHtml = item.isCurrentlyAway
        ? `<span class="status-pill away"><span class="status-dot"></span>Away</span>`
        : `<span class="status-pill active"><span class="status-dot"></span>In Meet</span>`;

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
          durationInfo = `<span style="color: #38bdf8; font-weight: 600;">Away: ${window.DashboardData.formatDuration(ev.duration)}</span>`;
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

  // Quick preset chips
  quickCodeChips.forEach(chip => {
    chip.addEventListener("click", () => {
      const code = chip.getAttribute("data-code");
      loadMeetingData(code);
    });
  });

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
    if (user) {
      isTeacherLoggedIn = true;
      if (authStatusDot) authStatusDot.classList.add("logged-in");

      const displayName = user.user_metadata?.full_name || (user.email ? user.email.split('@')[0] : "Sir (Teacher)");
      const email = user.email || "teacher@gmail.com";

      if (authBtnLabel) authBtnLabel.textContent = displayName;
      if (teacherProfileName) teacherProfileName.textContent = displayName;
      if (teacherProfileEmail) teacherProfileEmail.textContent = email;

      if (user.user_metadata?.avatar_url && teacherProfileAvatar) {
        teacherProfileAvatar.innerHTML = `<img src="${user.user_metadata.avatar_url}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
      } else if (teacherProfileAvatar) {
        teacherProfileAvatar.textContent = "👨‍🏫";
      }

      if (teacherProfileView) teacherProfileView.style.display = "block";
      if (teacherAuthInputs) teacherAuthInputs.style.display = "none";
    } else {
      isTeacherLoggedIn = false;
      if (authStatusDot) authStatusDot.classList.remove("logged-in");
      if (authBtnLabel) authBtnLabel.textContent = "Teacher Login";

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

  // Teacher Login Modal Handlers
  teacherLoginBtn.addEventListener("click", () => {
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
        updateTeacherAuthState(null);
        loginModal.classList.remove("active");
        showToast("Signed out successfully.");
        loadMeetingData();
      } catch (err) {
        console.error("Sign out error:", err);
      }
    });
  }

  // Teacher Email/Password Sign In Form
  teacherLoginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("teacher-email").value.trim();
    const password = document.getElementById("teacher-password").value;

    try {
      showToast("Verifying credentials with Supabase...");
      const data = await window.DashboardData.signInWithEmail(email, password);
      if (data && data.user) {
        updateTeacherAuthState(data.user);
        loginModal.classList.remove("active");
        showToast(`Welcome back, ${data.user.email}!`);
        loadMeetingData();
        return;
      }
    } catch (err) {
      console.warn("Supabase password auth notice:", err.message);
    }

    // Demo fallback sign-in
    isTeacherLoggedIn = true;
    updateTeacherAuthState({
      email: email,
      user_metadata: { full_name: email.split('@')[0] }
    });
    loginModal.classList.remove("active");
    showToast(`Signed in as: ${email}`);
    loadMeetingData();
  });

  // Supabase Settings Drawer Toggle
  if (toggleSupabaseSettings && supabaseSettingsBox) {
    toggleSupabaseSettings.addEventListener("click", () => {
      const isHidden = supabaseSettingsBox.style.display === "none";
      supabaseSettingsBox.style.display = isHidden ? "block" : "none";
      const chevron = document.getElementById("supabase-settings-chevron");
      if (chevron) chevron.textContent = isHidden ? "▲" : "▼";
    });
  }

  // Save Supabase Settings Button
  if (saveSupabaseSettingsBtn) {
    saveSupabaseSettingsBtn.addEventListener("click", () => {
      const url = supabaseUrlInput.value.trim();
      const key = supabaseKeyInput.value.trim();
      if (!url || !key) {
        showToast("Please enter both Supabase URL and Anon Key.");
        return;
      }
      window.DashboardData.saveSupabaseSettings(url, key);
      showToast("Supabase configuration saved & connected!");
      updateConnectionStatusBadge();
      loadMeetingData();
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
  document.addEventListener("DOMContentLoaded", async () => {
    // Check initial user session
    if (typeof window.DashboardData.getCurrentUser === "function") {
      const currentUser = await window.DashboardData.getCurrentUser();
      if (currentUser) {
        updateTeacherAuthState(currentUser);
      } else {
        updateConnectionStatusBadge();
      }
    }

    // Listen for auth state changes
    if (typeof window.DashboardData.onAuthStateChange === "function") {
      window.DashboardData.onAuthStateChange((event, session) => {
        if (session && session.user) {
          updateTeacherAuthState(session.user);
          loadMeetingData();
        } else if (event === "SIGNED_OUT") {
          updateTeacherAuthState(null);
        }
      });
    }

    loadMeetingData("abc-defg-hij");
  });

})();
