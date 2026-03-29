/**
 * InternLink Client-Side Logic
 * Architecture: Decoupled Frontend
 * Description: Handles DOM manipulation, state management via localStorage, 
 * and asynchronous communication with the Flask REST API.
 */

/** * Centralized Backend Configuration 
 * Points to the local Python/Flask server. In a production environment, 
 * this variable should be updated to the deployed cloud server URI.
 */
const API_BASE_URL = "http://127.0.0.1:5000";

/**
 * Global Authentication Redirect
 * Intercepts authenticated users attempting to view the public landing page
 * and securely routes them to their respective dashboards.
 */
(function () {
  const isLoggedIn = localStorage.getItem("loggedIn");
  const userRole = localStorage.getItem("userRole");
  const path = window.location.pathname;

  if (isLoggedIn === "true" && (path === "/" || path.endsWith("index.html"))) {
    window.location.href = (userRole === "sme") ? "sme_dashboard.html" : "dashboard.html";
  }
})();

/**
 * Fetches and aggregates internship opportunities from both the internal 
 * PostgreSQL database and an external third-party job board API.
 * Renders the results dynamically into the DOM.
 */
async function fetchJobs() {
  const container = document.getElementById("api-jobs-container");
  if (!container) return; 

  container.innerHTML = "<p>Loading internships...</p>";

  try {
    // Fetch local opportunities from the backend API
    const localRes = await fetch(`${API_BASE_URL}/api/internships`);
    const localJobs = await localRes.json();

    // Fetch global remote opportunities from external API
    const extRes = await fetch("https://www.arbeitnow.com/api/job-board-api");
    const extJson = await extRes.json();
    const extJobs = extJson.data.slice(0, 10);

    container.innerHTML = ""; 

    // Helper function to demote specific external roles for better local visibility
    const isFrontEndDevIntern = (title) => (title || "").trim().toLowerCase() === "front end developer intern";
    const pushFrontEndDevInternToBottom = (jobs) =>
      [...jobs].sort((a, b) => {
        const aIs = isFrontEndDevIntern(a?.title);
        const bIs = isFrontEndDevIntern(b?.title);
        if (aIs === bIs) return 0;
        return aIs ? 1 : -1;
      });

    // Render External Jobs
    const extHeader = document.createElement("h3");
    extHeader.textContent = "Global Remote Opportunities";
    container.appendChild(extHeader);

    pushFrontEndDevInternToBottom(extJobs).forEach(job => {
      const card = document.createElement("div");
      card.className = "internship-card internship-card--global";
      card.innerHTML = `
        <h3>${job.title}</h3>
        <p><strong>Company:</strong> ${job.company_name}</p>
        <p><strong>Location:</strong> ${job.location}</p>
        <button class="btn" onclick="window.open('${job.url}', '_blank')">Apply Externally</button>
      `;
      container.appendChild(card);
    });

    // Render Internal (Local) Jobs
    if (localJobs.length > 0) {
      const localHeader = document.createElement("h3");
      localHeader.textContent = "Local Opportunities (InternLink Exclusive)";
      localHeader.style.color = "";
      localHeader.style.marginTop = "44px";
      container.appendChild(localHeader);

      pushFrontEndDevInternToBottom(localJobs).forEach(job => {
        const card = document.createElement("div");
        card.className = "internship-card internship-card--local";
        card.style.borderLeft = "";
        card.innerHTML = `
          <h3>${job.title}</h3>
          <p><strong>Company:</strong> ${job.company_name}</p>
          <p><strong>Location:</strong> ${job.location}</p>
          <p style="font-size: 0.9em; color: var(--muted);">${job.description}</p>
          <button class="btn" onclick="applyInternally(${job.id})">Apply Internally</button>
        `;
        container.appendChild(card);
      });
    }

  } catch (err) {
    container.innerHTML = "<p>Failed to load job listings. Please check your network connection.</p>";
  }
}

document.addEventListener("DOMContentLoaded", fetchJobs);

/**
 * Validates and submits a new internship posting payload to the backend.
 * Restricted to authenticated SME users.
 */
async function postInternship() {
  const title = document.getElementById("post-title").value;
  const description = document.getElementById("post-desc").value;
  const location = document.getElementById("post-location").value;
  const startDate = document.getElementById("post-start").value;
  const endDate = document.getElementById("post-end").value;
  const smeId = localStorage.getItem("userId"); 

  if (!title || !description || !location || !smeId) {
    return showToast("Please fill all required fields.");
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/internships`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sme_id: smeId, title: title, description: description, location: location, start_date: startDate, end_date: endDate })
    });

    const data = await res.json();
    showToast(data.message);

    if (data.status === "success") {
      // Clear form inputs upon successful submission
      document.getElementById("post-title").value = "";
      document.getElementById("post-desc").value = "";
      document.getElementById("post-location").value = "";
      
      if (typeof loadSmePostings === "function") loadSmePostings();
    }
  } catch (err) {
    showToast("Failed to post internship due to a server error.");
  }
}

/**
 * Retrieves and renders internships specific to the logged-in SME.
 * Provides interface elements for updating or soft-deleting records.
 */
async function loadSmePostings() {
  const userId = localStorage.getItem("userId");
  const container = document.getElementById("sme-postings-container");

  if (!userId || !container) return;

  container.innerHTML = "<p style='color: var(--muted);'>Loading your postings...</p>";

  try {
    const res = await fetch(`${API_BASE_URL}/api/internships`);
    const allJobs = await res.json();
    
    // Filter payload client-side for SME-specific records
    const myJobs = allJobs.filter(job => String(job.sme_id) === String(userId));

    if (myJobs.length === 0) {
      container.innerHTML = "<p style='color: var(--muted);'>You have not posted any active internships.</p>";
      return;
    }

    container.innerHTML = "";

    myJobs.forEach(job => {
      const card = document.createElement("div");
      card.style.background = "var(--input-bg)";
      card.style.border = "1px solid var(--border)";
      card.style.padding = "15px";
      card.style.borderRadius = "8px";
      card.style.marginBottom = "10px";
      card.style.display = "flex";
      card.style.justifyContent = "space-between";
      card.style.alignItems = "center";
      card.style.flexWrap = "wrap";
      card.style.gap = "10px";

      // Serialize job object for inline DOM injection
      const jobData = JSON.stringify(job).replace(/"/g, '&quot;');

      card.innerHTML = `
        <div>
          <h4 style="margin: 0 0 4px 0; color: var(--text);">${job.title}</h4>
          <span style="font-size: 12px; color: var(--muted);">${job.location}</span>
        </div>
        <div>
          <button class="btn" style="background: transparent; color: var(--text); border: 1px solid var(--border); padding: 8px 14px; font-size: 12px; margin-right: 8px;" onclick="openEditJobModal(${jobData})">
            Edit
          </button>
          <button class="btn" style="background: #b91c1c; padding: 8px 14px; font-size: 12px;" onclick="openDeleteModal(${job.id})">
            Close Role
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = "<p style='color: #b91c1c;'>Error establishing connection to retrieve postings.</p>";
  }
}

/**
 * Modal state management functions for Delete and Edit operations
 */
function openDeleteModal(jobId) {
  document.getElementById("delete-job-id").value = jobId;
  document.getElementById("delete-job-modal").style.display = "flex";
}

function closeDeleteModal() {
  document.getElementById("delete-job-modal").style.display = "none";
}

/**
 * Executes a soft-delete (status update) on an internship record via the API.
 */
async function confirmDeleteInternship() {
  const jobId = document.getElementById("delete-job-id").value;
  if (!jobId) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/internships`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ internship_id: jobId })
    });
    const data = await res.json();
    showToast(data.message);
    
    if (data.status === "success") {
      closeDeleteModal();
      loadSmePostings(); 
    }
  } catch (err) {
    showToast("Failed to close internship. Server error.");
  }
}

function openEditJobModal(job) {
  document.getElementById("edit-job-id").value = job.id;
  document.getElementById("edit-title").value = job.title;
  document.getElementById("edit-desc").value = job.description;
  document.getElementById("edit-location").value = job.location;
  document.getElementById("edit-start").value = job.start_date || "";
  document.getElementById("edit-end").value = job.end_date || "";
  document.getElementById("edit-job-modal").style.display = "flex";
}

function closeEditJobModal() {
  document.getElementById("edit-job-modal").style.display = "none";
}

/**
 * Submits updated internship details via HTTP PUT request.
 */
async function saveJobEdit() {
  const jobId = document.getElementById("edit-job-id").value;
  const smeId = localStorage.getItem("userId");
  const title = document.getElementById("edit-title").value;
  const desc = document.getElementById("edit-desc").value;
  const loc = document.getElementById("edit-location").value;
  const start = document.getElementById("edit-start").value;
  const end = document.getElementById("edit-end").value;

  try {
    const res = await fetch(`${API_BASE_URL}/api/internships`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ internship_id: jobId, sme_id: smeId, title: title, description: desc, location: loc, start_date: start, end_date: end })
    });
    const data = await res.json();
    showToast(data.message);
    if (data.status === "success") {
      closeEditJobModal();
      loadSmePostings();
    }
  } catch (err) {
    showToast("Failed to update internship record.");
  }
}

document.addEventListener("DOMContentLoaded", loadSmePostings);

/**
 * Role-Based Access Control (RBAC) Client Routing
 * Dynamically updates navigation bar links based on local authentication state.
 */
function updateNav() {
  const isLoggedIn = localStorage.getItem("loggedIn");
  const userRole = localStorage.getItem("userRole"); 
  
  const navLogo = document.getElementById("nav-logo");
  const navHome = document.getElementById("nav-home"); 
  const navLogin = document.getElementById("nav-login");
  const navRegister = document.getElementById("nav-register");
  const navDash = document.getElementById("nav-dash");
  const navLogout = document.getElementById("nav-logout");
  const matchBtn = document.getElementById("match-me-btn"); 

  if (isLoggedIn === "true") {
    // Route to appropriate dashboard based on user identity
    const dashUrl = (userRole === "sme") ? "sme_dashboard.html" : "dashboard.html";

    if (navLogo) navLogo.onclick = () => window.location.reload();
    if (navHome) navHome.style.display = "none";
    if (navLogin) navLogin.style.display = "none";
    if (navRegister) navRegister.style.display = "none";
    if (navLogout) navLogout.style.display = "inline-block";
    
    if (navDash) {
      navDash.style.display = "inline-block";
      navDash.href = dashUrl;
    }
    
    if (matchBtn) matchBtn.style.display = (userRole === "student") ? "inline-block" : "none";
    
  } else {
    // Unauthenticated state view
    if (navLogo) navLogo.onclick = () => window.location.href = "index.html";
    if (navHome) navHome.style.display = "inline-block";
    if (navLogin) navLogin.style.display = "inline-block";
    if (navRegister) navRegister.style.display = "inline-block";
    if (navDash) navDash.style.display = "none";
    if (navLogout) navLogout.style.display = "none";
    if (matchBtn) matchBtn.style.display = "none"; 
  }
}
document.addEventListener("DOMContentLoaded", updateNav);

/**
 * UI/UX Theme Management
 * Persists user preference via localStorage and applies CSS variable sets.
 */
function applyTheme(theme) {
  const next = (theme === "light" || theme === "dark") ? theme : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("theme", next); } catch (e) {}
  updateThemeToggleLabel();
  updateChartColors(); 
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme || "dark";
  applyTheme(current === "dark" ? "light" : "dark");
}

function updateThemeToggleLabel() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  const current = document.documentElement.dataset.theme || "dark";
  btn.textContent = current === "dark" ? "Dark" : "Light";
  btn.setAttribute("aria-pressed", current === "dark" ? "true" : "false");
}

document.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme") || "dark";
  applyTheme(savedTheme);
});

// Chart.js Theme Subroutines
function getChartTextColor() {
  const theme = document.documentElement.dataset.theme || "dark";
  return theme === "light" ? "#45506a" : "#a3aac8";
}

function getChartGridColor() {
  const theme = document.documentElement.dataset.theme || "dark";
  return theme === "light" ? "rgba(15, 23, 42, 0.08)" : "rgba(255, 255, 255, 0.08)";
}

function getChartBorderColor() {
  const theme = document.documentElement.dataset.theme || "dark";
  return theme === "light" ? "#ffffff" : "#0f172a";
}

/**
 * Synchronizes Chart.js instance colors with the active DOM dataset theme.
 */
function updateChartColors() {
  const textColor = getChartTextColor();
  const gridColor = getChartGridColor();
  const borderColor = getChartBorderColor();

  if (typeof applicationsChartInstance !== "undefined" && applicationsChartInstance) {
    applicationsChartInstance.options.plugins.legend.labels.color = textColor;
    applicationsChartInstance.data.datasets[0].borderColor = borderColor;
    applicationsChartInstance.update();
  }

  if (typeof smeLiveAppsChartInstance !== "undefined" && smeLiveAppsChartInstance) {
    smeLiveAppsChartInstance.options.plugins.legend.labels.color = textColor;
    smeLiveAppsChartInstance.options.scales.x.ticks.color = textColor;
    smeLiveAppsChartInstance.options.scales.x.grid.color = gridColor;
    smeLiveAppsChartInstance.options.scales.y.ticks.color = textColor;
    smeLiveAppsChartInstance.options.scales.y.grid.color = gridColor;
    smeLiveAppsChartInstance.update();
  }
}

/**
 * Authentication Controllers
 * Manages HTTP session requests and client-side token storage.
 */
async function login() {
  const email = document.querySelector("#login-email").value;
  const password = document.querySelector("#login-password").value;
  if (!email || !password) return showToast("Please fill all required fields");

  try {
    const res = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password })
    });
    const data = await res.json();
    
    if (data.status === "success") {
      showToast("Authentication successful");
      // Store session metadata securely
      localStorage.setItem("loggedIn", "true"); 
      localStorage.setItem("userRole", data.role); 
      localStorage.setItem("userId", data.user_id); 
      
      // Redirect based on RBAC identity
      setTimeout(() => window.location.href = data.role === "sme" ? "sme_dashboard.html" : "dashboard.html", 700);
    } else {
      showToast("Authentication failed: Invalid credentials");
    }
  } catch (err) { showToast("Internal server error during authentication"); }
}

async function register() {
  const roleElement = document.getElementById("register-role");
  const companyElement = document.querySelector("#register-company");
  const role = roleElement ? roleElement.value : "student";
  const companyName = companyElement ? companyElement.value : "";
  const first = document.querySelector("#register-first").value;
  const last = document.querySelector("#register-last").value;
  const email = document.querySelector("#register-email").value;
  const password = document.querySelector("#register-password").value;

  // Enforce validation rule: SMEs must provide a company name
  if (!first || !last || !email || !password || (role === "sme" && !companyName)) {
      return showToast("Please fill all required fields to proceed.");
  }

  try {
    const res = await fetch(`${API_BASE_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, companyName, first, last, email, password })
    });
    const data = await res.json();
    showToast(data.message);
    
    if (data.status === "success") setTimeout(() => window.location.href = "login.html", 900);
  } catch (err) { showToast("Registration payload rejected by server"); }
}

function logout() {
  // Purge local session metadata
  localStorage.removeItem("loggedIn"); 
  localStorage.removeItem("userRole");
  localStorage.removeItem("userId");
  showToast("Session terminated successfully");
  setTimeout(() => window.location.href = "index.html", 700);
}

/**
 * Utility: UI notification handler
 */
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return; 
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

/**
 * Application Tracking Module
 * Handles interactions between Students applying to SME job postings.
 */
async function applyInternally(internshipId) {
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("userRole");
  
  // Guard clauses for unauthenticated or incorrect role attempts
  if (!userId) return showToast("Authentication required to apply.");
  if (role !== "student") return showToast("Action restricted to Student accounts.");
  
  try {
    const res = await fetch(`${API_BASE_URL}/api/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: userId, internship_id: internshipId })
    });
    const data = await res.json();
    showToast(data.message);
  } catch (err) { showToast("Transaction failed. Application not submitted."); }
}

/**
 * Fetches and populates the dashboard matrix based on user role.
 * Students see their application history; SMEs see their candidate pipeline.
 */
async function loadDashboardData() {
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("userRole");
  if (!userId) return;
  
  const containerId = role === "sme" ? "sme-applications-container" : "student-applications-container";
  const container = document.getElementById(containerId);
  if (!container) return; 
  
  container.innerHTML = "<p>Retrieving database records...</p>";
  
  try {
    const res = await fetch(`${API_BASE_URL}/api/applications?user_id=${userId}&role=${role}`);
    const apps = await res.json();

    // Initialize data visualization
    renderApplicationsChart(apps);
    
    if (apps.length === 0) {
      container.innerHTML = "<p>No active records found in the pipeline.</p>";
      return;
    }
    
    container.innerHTML = "";
    
    apps.forEach(app => {
      const card = document.createElement("div");
      card.className = "internship-card";
      
      // Dynamic status coloring logic
      const statusColor = app.status === 'Pending' ? '#b45309' : (app.status === 'Accepted' ? '#15803d' : '#b91c1c');
      
      if (role === "sme") {
        // Prepare student object for detailed modal inspection
        const studentData = JSON.stringify({
          first: app.first, last: app.last, email: app.email,
          uni: app.university, major: app.major, year: app.graduation_year, skills: app.skills
        }).replace(/"/g, '&quot;');

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
            <div>
              <h4 style="margin: 0 0 5px 0;">${app.title}</h4>
              <p style="margin: 0;"><strong>Candidate:</strong> ${app.first} ${app.last}</p>
              <p style="margin: 0;"><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${app.status}</span></p>
            </div>
            <button class="btn" style="background: transparent; color: var(--accent); border: 1px solid var(--accent); padding: 6px 12px; font-size: 13px;" onclick="viewCandidateProfile(${studentData})">
              View Profile
            </button>
          </div>
          ${app.status === 'Pending' ? `
            <div style="margin-top: 15px; border-top: 1px solid var(--border); padding-top: 15px;">
              <button class="btn" style="background: #15803d; margin-right: 10px; padding: 8px 16px; font-size: 13px;" onclick="updateAppStatus(${app.app_id}, 'Accepted')">Accept Candidate</button>
              <button class="btn" style="background: transparent; color: #b91c1c; border: 1px solid #b91c1c; padding: 8px 16px; font-size: 13px;" onclick="updateAppStatus(${app.app_id}, 'Rejected')">Reject</button>
            </div>
          ` : ''}
        `;
      } else {
        card.innerHTML = `
          <h4>${app.title}</h4>
          <p><strong>Company:</strong> ${app.company_name}</p>
          <p><strong>Location:</strong> ${app.location}</p>
          <p><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${app.status}</span></p>
        `;
      }
      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = "<p>Error loading pipeline data.</p>";
  }
}

// Subroutines for Candidate Inspection UI
function viewCandidateProfile(student) {
  document.getElementById("modal-cand-name").textContent = student.first + " " + student.last;
  document.getElementById("modal-cand-email").textContent = student.email;
  document.getElementById("modal-cand-uni").textContent = student.uni || "Data not provided";
  document.getElementById("modal-cand-major").textContent = student.major || "Data not provided";
  document.getElementById("modal-cand-year").textContent = student.year || "Data not provided";
  document.getElementById("modal-cand-skills").textContent = student.skills || "Data not provided";
  document.getElementById("candidate-modal").style.display = "flex";
}

function closeCandidateModal() {
  document.getElementById("candidate-modal").style.display = "none";
}

/**
 * Data Visualization Component (Doughnut Chart)
 * Aggregates application statuses and renders via Chart.js
 */
let applicationsChartInstance = null;
function renderApplicationsChart(apps) {
  const canvas = document.getElementById("applications-chart");
  if (!canvas) return;
  if (typeof Chart === "undefined") return;

  const counts = { Pending: 0, Accepted: 0, Rejected: 0 };
  (apps || []).forEach(a => {
    const status = (a && a.status) ? a.status : "Pending";
    if (status in counts) counts[status] += 1;
  });

  const data = [counts.Pending, counts.Accepted, counts.Rejected];

  // Destroy previous instance to prevent memory leaks and visual artifacts
  if (applicationsChartInstance) {
    applicationsChartInstance.destroy();
    applicationsChartInstance = null;
  }

  applicationsChartInstance = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Pending", "Accepted", "Rejected"],
      datasets: [{
        data,
        backgroundColor: ["#b45309", "#15803d", "#b91c1c"],
        borderColor: getChartBorderColor(),
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: getChartTextColor() } }
      }
    }
  });
}

/**
 * Updates application status (e.g., Accepting or Rejecting a candidate)
 */
async function updateAppStatus(appId, newStatus) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/applications`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: appId, status: newStatus })
    });
    const data = await res.json();
    showToast(data.message);
    if (data.status === "success") loadDashboardData(); 
  } catch(err) { showToast("Failed to mutate status on server."); }
}

document.addEventListener("DOMContentLoaded", loadDashboardData);

/**
 * Live Metrics Module (Time-Series Analytics)
 * Polls the backend every 5 seconds to provide real-time application tracking.
 */
let smeLiveAppsChartInstance = null;
let smeLiveAppsIntervalId = null;

async function loadSmeLiveApplicationsChartOnce() {
  const role = localStorage.getItem("userRole");
  const userId = localStorage.getItem("userId");
  const canvas = document.getElementById("applications-live-chart");
  if (!canvas || typeof Chart === "undefined" || !userId || role !== "sme") return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/sme_metrics/applications_timeseries?user_id=${userId}`);
    const data = await res.json();
    if (!data || data.status !== "success") return;

    if (!smeLiveAppsChartInstance) {
      smeLiveAppsChartInstance = new Chart(canvas, {
        type: "line",
        data: {
          labels: data.labels || [],
          datasets: [{
            label: "Applications Volume", data: data.counts || [],
            borderColor: "#2563eb", backgroundColor: "rgba(37, 99, 235, 0.12)",
            tension: 0.25, fill: true, pointRadius: 3, pointHoverRadius: 5
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, animation: false,
          scales: {
            x: { ticks: { color: getChartTextColor() }, grid: { color: getChartGridColor() } },
            y: { beginAtZero: true, ticks: { color: getChartTextColor(), precision: 0 }, grid: { color: getChartGridColor() } }
          },
          plugins: { legend: { labels: { color: getChartTextColor() } } }
        }
      });
    } else {
      // Update data mutably to preserve chart performance
      smeLiveAppsChartInstance.data.labels = data.labels || [];
      smeLiveAppsChartInstance.data.datasets[0].data = data.counts || [];
      smeLiveAppsChartInstance.update();
    }
  } catch (err) {}
}

function startSmeLiveApplicationsChart() {
  const canvas = document.getElementById("applications-live-chart");
  if (!canvas) return;
  
  loadSmeLiveApplicationsChartOnce();
  
  // Establish polling interval
  if (smeLiveAppsIntervalId) clearInterval(smeLiveAppsIntervalId);
  smeLiveAppsIntervalId = setInterval(loadSmeLiveApplicationsChartOnce, 5000);
}
document.addEventListener("DOMContentLoaded", startSmeLiveApplicationsChart);

/**
 * User Profile Management
 * Controls the read/write state of the profile form and executes API updates.
 */
function toggleProfileEdit(isEditing) {
  const fields = ["prof-uni", "prof-major", "prof-year", "prof-skills"];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.readOnly = !isEditing;
      if (!isEditing) {
        el.style.opacity = "0.6"; el.style.cursor = "not-allowed";
      } else {
        el.style.opacity = "1"; el.style.cursor = "text";
      }
    }
  });

  const saveBtn = document.getElementById("btn-save-profile");
  const editBtn = document.getElementById("btn-edit-profile");
  if (saveBtn && editBtn) {
    saveBtn.style.display = isEditing ? "block" : "none";
    editBtn.style.display = isEditing ? "none" : "block";
  }
}

async function loadProfile() {
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("userRole");
  if (!userId || role !== "student") return; 
  
  const uniInput = document.getElementById("prof-uni");
  if (!uniInput) return;
  
  try {
    const res = await fetch(`${API_BASE_URL}/api/profile?user_id=${userId}`);
    const data = await res.json();
    if (data && (data.university || data.major || data.skills)) {
      document.getElementById("prof-uni").value = data.university || "";
      document.getElementById("prof-major").value = data.major || "";
      document.getElementById("prof-year").value = data.graduation_year || "";
      document.getElementById("prof-skills").value = data.skills || "";
      toggleProfileEdit(false);
    } else {
      toggleProfileEdit(true);
    }
  } catch(err) { console.error("Data retrieval error during profile load"); }
}

async function updateProfile() {
  const userId = localStorage.getItem("userId");
  if (!userId) return showToast("Session expired. Please re-authenticate.");
  
  try {
    const res = await fetch(`${API_BASE_URL}/api/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        user_id: userId, 
        university: document.getElementById("prof-uni").value, 
        major: document.getElementById("prof-major").value, 
        graduation_year: document.getElementById("prof-year").value, 
        skills: document.getElementById("prof-skills").value 
      })
    });
    const data = await res.json();
    showToast(data.message);
    if (data.status === "success") toggleProfileEdit(false);
  } catch(err) { showToast("Network error. Profile update failed."); }
}
document.addEventListener("DOMContentLoaded", loadProfile);

/**
 * Recommendation Engine Interface
 * Requests the backend to run a keyword-intersection analysis comparing 
 * the active user's skills against available internship descriptions.
 */
async function matchInternships() {
  const userId = localStorage.getItem("userId");
  const container = document.getElementById("api-jobs-container");
  if (!userId || !container) return;
  
  container.innerHTML = "<p>Analyzing skill compatibility...</p>";
  try {
    const res = await fetch(`${API_BASE_URL}/api/match?user_id=${userId}`);
    const data = await res.json();
    
    // Guard clause for missing profile data
    if (data.status === "error") {
      container.innerHTML = `<p style="color: #b91c1c;">${data.message}</p>`;
      return;
    }
    
    container.innerHTML = `<h3>Algorithm Matches</h3><button class="btn" style="margin-bottom: 20px;" onclick="fetchJobs()">Reset Feed</button>`;
    if (data.matches.length === 0) {
      container.innerHTML += "<p>No threshold matches identified. Consider expanding your technical skill profile.</p>";
      return;
    }
    
    // Render sorted matches prioritizing higher algorithmic scores
    data.matches.forEach(job => {
      const card = document.createElement("div");
      card.className = "internship-card";
      card.style.borderLeft = "";
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="margin: 0;">${job.title}</h3>
          <span class="btn" style="color: #ffffff; cursor: default; pointer-events: none; padding: 8px 15px; font-size: 13px;">
            Match Score: ${job.match_score}
          </span>
        </div>
        <p><strong>Company:</strong> ${job.company_name}</p>
        <p><strong>Location:</strong> ${job.location}</p>
        <p style="font-size: 0.9em; color: var(--muted);">${job.description}</p>
        <button class="btn" onclick="applyInternally(${job.id})">Apply Internally</button>
      `;
      container.appendChild(card);
    });
  } catch (err) { container.innerHTML = "<p>Connection error communicating with matching engine.</p>"; }
}

/**
 * Client-Side Router Helper
 * Parses URL query parameters to auto-select user roles during registration.
 */
document.addEventListener("DOMContentLoaded", () => {
  const roleSelect = document.getElementById("register-role");
  
  if (roleSelect) {
    const urlParams = new URLSearchParams(window.location.search);
    const prefillRole = urlParams.get("role");
    
    if (prefillRole === "student" || prefillRole === "sme") {
      roleSelect.value = prefillRole;
      roleSelect.dispatchEvent(new Event("change"));
    }
  }
});