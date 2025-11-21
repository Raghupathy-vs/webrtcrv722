document.addEventListener("DOMContentLoaded", () => {
  const loginTab = document.getElementById("loginTab");
  const signupTab = document.getElementById("signupTab");
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const authBox = document.getElementById("authBox");
  const logoutBtn = document.getElementById("logoutBtn");
  const meetingTitle = document.querySelector(".meeting-section h1");

  loginTab.onclick = () => {
    loginTab.classList.add("active");
    signupTab.classList.remove("active");
    loginForm.classList.add("active");
    signupForm.classList.remove("active");
  };
  signupTab.onclick = () => {
    signupTab.classList.add("active");
    loginTab.classList.remove("active");
    signupForm.classList.add("active");
    loginForm.classList.remove("active");
  };

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value.trim();

    try {
      const res = await fetch("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, cpassword: password }),
      });
      const data = await res.json();
      alert(data.msg);
    } catch (err) {
      alert("Signup failed. Check console.");
      console.error(err);
    }
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      alert(data.msg);

      if (res.ok) {
        localStorage.setItem("loggedInUser", JSON.stringify(data.user));
        authBox.style.display = "none";
        logoutBtn.style.display = "inline-block";
        meetingTitle.textContent = `Welcome, ${data.user.username}!`;
      }
    } catch (err) {
      alert("Login failed. Check console.");
      console.error(err);
    }
  });

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("loggedInUser");
    authBox.style.display = "block";
    logoutBtn.style.display = "none";
    meetingTitle.textContent = "Welcome to WebRTC Meeting";
    alert("You have logged out.");
  });

  const loggedUser = JSON.parse(localStorage.getItem("loggedInUser"));
  if (loggedUser) {
    authBox.style.display = "none";
    logoutBtn.style.display = "inline-block";
    meetingTitle.textContent = `Welcome, ${loggedUser.username}!`;
  } else {
    authBox.style.display = "block";
    logoutBtn.style.display = "none";
  }

document.getElementById("newMeetingBtn").onclick = () => {
  const loggedUser = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!loggedUser) {
    alert("Please Login or SignUp to continue.");
    return;
  }
  const roomId = Math.random().toString(36).substring(2, 8);
  window.location.href = `/index.html?roomId=${roomId}&username=${loggedUser.username}`;
};

document.getElementById("joinMeetingBtn").onclick = () => {
  const loggedUser = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!loggedUser) {
    alert("Please Login or SignUp to continue.");
    return;
  }
  const meetingId = document.getElementById("meetingIdInput").value.trim();
  if (!meetingId) return alert("Please enter a Meeting ID");

  window.location.href = `/index.html?roomId=${meetingId}&username=${loggedUser.username}`;
};

});
