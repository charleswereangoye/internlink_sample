/* =========================
   API: FETCH LOCAL & GLOBAL JOBS
========================= */
async function fetchJobs() {
  const container = document.getElementById("api-jobs-container");
  if (!container) return; 

  container.innerHTML = "<p>Loading internships...</p>";

  try {
    // 1. Fetch Local Jobs (from our database)
    const localRes = await fetch("/api/internships");
    const localJobs = await localRes.json();

    // 2. Fetch Global Jobs (from Arbeitnow API)
    const extRes = await fetch("https://www.arbeitnow.com/api/job-board-api");
    const extJson = await extRes.json();
    const extJobs = extJson.data.slice(0, 10); 

    container.innerHTML = ""; // Clear loading text

    // --- RENDER LOCAL JOBS FIRST ---
    if (localJobs.length > 0) {
      const localHeader = document.createElement("h3");
      localHeader.textContent = "Local Opportunities (InternLink Exclusive)";
      localHeader.style.color = "#5dfc8d";
      container.appendChild(localHeader);

      localJobs.forEach(job => {
        const card = document.createElement("div");
        card.className = "internship-card";
        card.style.borderLeft = "4px solid #5dfc8d"; // Highlight local jobs
        card.innerHTML = `
          <h3>${job.title}</h3>
          <p><strong>Company:</strong> ${job.company_name}</p>
          <p><strong>Location:</strong> ${job.location}</p>
          <p style="font-size: 0.9em; color: #8b91a8;">${job.description}</p>
          <button class="btn" onclick="applyInternally(${job.id})">Apply Internally</button>
        `;
        container.appendChild(card);
      });
    }

    // --- RENDER GLOBAL JOBS ---
    const extHeader = document.createElement("h3");
    extHeader.textContent = "Global Remote Opportunities";
    extHeader.style.marginTop = "40px";
    container.appendChild(extHeader);

    extJobs.forEach(job => {
      const card = document.createElement("div");
      card.className = "internship-card";
      card.innerHTML = `
        <h3>${job.title}</h3>
        <p><strong>Company:</strong> ${job.company_name}</p>
        <p><strong>Location:</strong> ${job.location}</p>
        <button class="btn" onclick="window.open('${job.url}', '_blank')">Apply Externally</button>
      `;
      container.appendChild(card);
    });

  } catch (err) {
    container.innerHTML = "<p>Failed to load jobs. Please check your connection.</p>";
  }
}

document.addEventListener("DOMContentLoaded", fetchJobs);

/* =========================
   SME POST INTERNSHIP
========================= */
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
    const res = await fetch("/api/internships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sme_id: smeId, title: title, description: description, location: location, start_date: startDate, end_date: endDate })
    });

    const data = await res.json();
    showToast(data.message);

    if (data.status === "success") {
      document.getElementById("post-title").value = "";
      document.getElementById("post-desc").value = "";
      document.getElementById("post-location").value = "";
    }
  } catch (err) {
    showToast("Failed to post internship.");
  }
}

/* =========================
   NAVIGATION UPDATER
========================= */
function updateNav() {
  const isLoggedIn = localStorage.getItem("loggedIn");
  const userRole = localStorage.getItem("userRole"); 
  
  const navLogin = document.getElementById("nav-login");
  const navRegister = document.getElementById("nav-register");
  const navDash = document.getElementById("nav-dash");
  const navLogout = document.getElementById("nav-logout");
  const matchBtn = document.getElementById("match-me-btn"); 

  if (isLoggedIn === "true") {
    if (navLogin) navLogin.style.display = "none";
    if (navRegister) navRegister.style.display = "none";
    if (navLogout) navLogout.style.display = "inline-block";
    
    if (navDash) {
      navDash.style.display = "inline-block";
      navDash.href = (userRole === "sme") ? "/sme_dashboard" : "/dashboard";
    }
    
    // Only show the Match Me button if they are a student
    if (matchBtn) {
      matchBtn.style.display = (userRole === "student") ? "inline-block" : "none";
    }
  } else {
    if (navLogin) navLogin.style.display = "inline-block";
    if (navRegister) navRegister.style.display = "inline-block";
    if (navDash) navDash.style.display = "none";
    if (navLogout) navLogout.style.display = "none";
    if (matchBtn) matchBtn.style.display = "none"; 
  }
}
document.addEventListener("DOMContentLoaded", updateNav);


/* =========================
   AUTHENTICATION LOGIC
========================= */
async function login() {
  const email = document.querySelector("#login-email").value;
  const password = document.querySelector("#login-password").value;

  if (!email || !password) return showToast("Please fill all fields");

  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password })
    });

    const data = await res.json();

    if (data.status === "success") {
      showToast("Login successful");
      localStorage.setItem("loggedIn", "true"); 
      localStorage.setItem("userRole", data.role); 
      localStorage.setItem("userId", data.user_id); 
      
      setTimeout(() => {
        if (data.role === "sme") {
          window.location.href = "/sme_dashboard"; 
        } else {
          window.location.href = "/dashboard"; 
        }
      }, 700);
    } else {
      showToast("Invalid email or password");
    }
  } catch (err) {
    showToast("Server error");
  }
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

  if (!first || !last || !email || !password || (role === "sme" && !companyName)) {
    return showToast("Please fill all required fields");
  }

  try {
    const res = await fetch("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, companyName, first, last, email, password })
    });

    const data = await res.json();
    showToast(data.message);

    if (data.status === "success") {
      setTimeout(() => {
        window.location.href = "/login"; 
      }, 900);
    }
  } catch (err) {
    showToast("Registration failed");
  }
}

function logout() {
  localStorage.removeItem("loggedIn"); 
  localStorage.removeItem("userRole");
  localStorage.removeItem("userId");
  showToast("Logged out successfully");
  setTimeout(() => {
    window.location.href = "/"; 
  }, 700);
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

/* =========================
   APPLICATION TRACKING
========================= */
async function applyInternally(internshipId) {
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("userRole");
  
  if (!userId) return showToast("Please login to apply.");
  if (role !== "student") return showToast("Only Student accounts can apply.");
  
  try {
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: userId, internship_id: internshipId })
    });
    const data = await res.json();
    showToast(data.message);
  } catch (err) {
    showToast("Error submitting application.");
  }
}

async function loadDashboardData() {
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("userRole");
  
  if (!userId) return;
  
  const containerId = role === "sme" ? "sme-applications-container" : "student-applications-container";
  const container = document.getElementById(containerId);
  
  if (!container) return; 
  
  container.innerHTML = "<p>Loading records...</p>";
  
  try {
    const res = await fetch(`/api/applications?user_id=${userId}&role=${role}`);
    const apps = await res.json();
    
    if (apps.length === 0) {
      container.innerHTML = "<p>No applications found yet.</p>";
      return;
    }
    
    container.innerHTML = "";
    
    apps.forEach(app => {
      const card = document.createElement("div");
      card.className = "internship-card";
      
      const statusColor = app.status === 'Pending' ? '#f1c40f' : (app.status === 'Accepted' ? '#5dfc8d' : '#e74c3c');
      
      if (role === "sme") {
        card.innerHTML = `
          <h4>${app.title}</h4>
          <p><strong>Candidate:</strong> ${app.first} ${app.last} (${app.email})</p>
          <p><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${app.status}</span></p>
          ${app.status === 'Pending' ? `
            <div style="margin-top: 10px;">
              <button class="btn" style="margin-right: 10px;" onclick="updateAppStatus(${app.app_id}, 'Accepted')">Accept</button>
              <button class="btn" style="background: #e74c3c; color: white;" onclick="updateAppStatus(${app.app_id}, 'Rejected')">Reject</button>
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
    container.innerHTML = "<p>Error loading applications.</p>";
  }
}

async function updateAppStatus(appId, newStatus) {
  try {
    const res = await fetch("/api/applications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: appId, status: newStatus })
    });
    const data = await res.json();
    showToast(data.message);
    
    if (data.status === "success") {
      loadDashboardData(); 
    }
  } catch(err) {
    showToast("Failed to update status.");
  }
}

document.addEventListener("DOMContentLoaded", loadDashboardData);

/* =========================
   SKILL PROFILE LOGIC
========================= */
async function loadProfile() {
  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("userRole");
  
  if (!userId || role !== "student") return; 
  
  const uniInput = document.getElementById("prof-uni");
  if (!uniInput) return;
  
  try {
    const res = await fetch(`/api/profile?user_id=${userId}`);
    const data = await res.json();
    
    if (data) {
      document.getElementById("prof-uni").value = data.university || "";
      document.getElementById("prof-major").value = data.major || "";
      document.getElementById("prof-year").value = data.graduation_year || "";
      document.getElementById("prof-skills").value = data.skills || "";
    }
  } catch(err) {
    console.error("Error loading profile");
  }
}

async function updateProfile() {
  const userId = localStorage.getItem("userId");
  if (!userId) return showToast("Please log in first.");
  
  const university = document.getElementById("prof-uni").value;
  const major = document.getElementById("prof-major").value;
  const year = document.getElementById("prof-year").value;
  const skills = document.getElementById("prof-skills").value;
  
  try {
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        user_id: userId, 
        university: university, 
        major: major, 
        graduation_year: year, 
        skills: skills 
      })
    });
    const data = await res.json();
    showToast(data.message);
  } catch(err) {
    showToast("Failed to update profile.");
  }
}

document.addEventListener("DOMContentLoaded", loadProfile);

/* =========================
   SKILL-BASED MATCHING
========================= */
async function matchInternships() {
  const userId = localStorage.getItem("userId");
  const container = document.getElementById("api-jobs-container");
  
  if (!userId || !container) return;
  
  container.innerHTML = "<p>Analyzing your skills and finding matches...</p>";
  
  try {
    const res = await fetch(`/api/match?user_id=${userId}`);
    const data = await res.json();
    
    if (data.status === "error") {
      container.innerHTML = `<p style="color: #e74c3c;">${data.message}</p>`;
      return;
    }
    
    const matches = data.matches;
    
    container.innerHTML = `
      <h3 style="color: #5dfc8d;">Your Top Matches</h3>
      <button class="btn" style="margin-bottom: 20px;" onclick="fetchJobs()">Show All Jobs</button>
    `;
    
    if (matches.length === 0) {
      container.innerHTML += "<p>No perfect matches found yet. Try adding more skills to your profile or check back later!</p>";
      return;
    }
    
    matches.forEach(job => {
      const card = document.createElement("div");
      card.className = "internship-card";
      card.style.borderLeft = "4px solid #5dfc8d"; 
      
      // Removed font-weight: bold; from this span
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="margin: 0;">${job.title}</h3>
          <span class="btn" style="color: #0d0f14; cursor: default; pointer-events: none; padding: 8px 15px; font-size: 13px;">
            Matched ${job.match_score} Skill(s)
          </span>
        </div>
        <p><strong>Company:</strong> ${job.company_name}</p>
        <p><strong>Location:</strong> ${job.location}</p>
        <p style="font-size: 0.9em; color: #8b91a8;">${job.description}</p>
        <button class="btn" onclick="applyInternally(${job.id})">Apply Internally</button>
      `;
      container.appendChild(card);
    });
    
  } catch (err) {
    container.innerHTML = "<p>Error running matching algorithm.</p>";
  }
}