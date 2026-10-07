const API_BASE = "http://localhost:8080";
const loginForm = document.getElementById("loginForm");
loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    if (email === "" || password === "") {
        alert("Please enter email and password.");
        return;
    }
    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: email, password: password }),
        });
        if (!response.ok) {
            let message = response.statusText;
            try {
                const data = await response.json();
                message = data.error || message;
            } catch (e) {}
            alert("Login failed: " + message);
            return;
        }
        const data = await response.json();
        localStorage.setItem("token", data.token);
        localStorage.setItem("username", data.username);
        localStorage.setItem("displayName", data.displayName || data.username);
        loginForm.reset();
        window.location.href = "chat2.html";
    } catch (err) {
        console.error("Login error:", err);
        alert("Could not reach the server. Is the backend running?");
    }
});
