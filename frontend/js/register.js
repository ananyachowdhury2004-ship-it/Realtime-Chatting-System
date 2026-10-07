const API_BASE = "http://localhost:8080";
const registerForm = document.getElementById("registerForm");
registerForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const mobile = document.getElementById("tel").value.trim();
    const userType = document.getElementById("user_type").value;
    const password = document.getElementById("password").value;
    const confirmPass = document.getElementById("confirm_pass").value;
    const mobileDigits = mobile.replace(/\D/g, "");
    if (mobileDigits.length < 10 || mobileDigits.length > 15) {
        alert("Please enter a valid mobile number (10 to 15 digits).");
        return;
    }
    if (password !== confirmPass) {
        alert("Passwords do not match!");
        return;
    }
    try {
        const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: email, password: password, displayName: name, mobile: mobileDigits }),
        });
        if (!response.ok) {
            let message = response.statusText;
            try {
                const data = await response.json();
                message = data.error || message;
            } catch (e) {}
            alert("Registration failed: " + message);
            return;
        }
        alert("Registration Successful! Please log in.");
        console.log("Name:", name);
        console.log("Email:", email);
        console.log("Mobile:", mobile);
        console.log("User Type:", userType);
        registerForm.reset();
        window.location.href = "login.html";
    } catch (err) {
        console.error("Registration error:", err);
        alert("Could not reach the server. Is the backend running?");
    }
});
