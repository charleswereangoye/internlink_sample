/* PAGE NAVIGATION */
function showPage(name) {
  // 1. Find all elements with the 'page' class
  const allPages = document.querySelectorAll('.page');
  
  // 2. Remove the 'active' class from every page
  allPages.forEach(page => {
    page.classList.remove('active');
  });

  // 3. Find the specific page we clicked and make it active
  const target = document.getElementById('page-' + name);
  if (target) {
    target.classList.add('active');
  }

  // 4. Scroll to top for a clean view
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

/* LOGIN FUNCTION (CONNECTED TO BACKEND) */
async function login() {
  const email = document.querySelector("#login-email").value;
  const password = document.querySelector("#login-password").value;

  if (!email || !password) {
    showToast("Please fill all fields");
    return;
  }

  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: email,
        password: password
      })
    });

    const data = await res.json();

    if (data.status === "success") {
      showToast("Login successful");
      setTimeout(() => {
        showPage('studentDash');
      }, 700);
    } else {
      showToast("Invalid email or password");
    }

  } catch (err) {
    showToast("Server error");
  }
}

/* REGISTER FUNCTION */
async function register() {
  const first = document.querySelector("#register-first").value;
  const last = document.querySelector("#register-last").value;
  const email = document.querySelector("#register-email").value;
  const password = document.querySelector("#register-password").value;

  if (!first || !last || !email || !password) {
    showToast("Please fill all fields");
    return;
  }

  try {
    const res = await fetch("/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        first: first,
        last: last,
        email: email,
        password: password
      })
    });

    const data = await res.json();
    showToast(data.message);

    // Only go to the login page if the backend said "success"
    if (data.status === "success") {
      setTimeout(() => {
        showPage('login');
      }, 900);
    }

  } catch (err) {
    showToast("Registration failed");
    console.error(err); 
  }
}

/* LOGOUT */
function logout() {
  showToast("Logged out successfully");
  setTimeout(() => {
    showPage('landing');
  }, 700);
}

/* TOAST NOTIFICATIONS */
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}
