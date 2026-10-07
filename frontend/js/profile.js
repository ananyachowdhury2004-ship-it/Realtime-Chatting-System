document.addEventListener("DOMContentLoaded", function () {
    const API_BASE = "http://localhost:8080";
    const token = localStorage.getItem("token");
    const DEFAULT_IMAGE = "./images/Default-Icon.jpg";
    const profileImage = document.getElementById("profileImage");
    const profileImageInput = document.getElementById("profileImageInput");
    const changeButton = document.getElementById("changeProfilePictureBtn");
    const removeButton = document.getElementById("removeProfilePictureBtn");
    const usernameElement = document.getElementById("username");
    const displayNameElement = document.getElementById("displayName");
    const onlineStatusElement = document.getElementById("onlineStatus");
    const backButton = document.getElementById("backButton");
    if (!token) {
        window.location.href = "login.html";
        return;
    }
    if (changeButton && profileImageInput) {
        changeButton.addEventListener("click", function () {
            profileImageInput.click();
        });
    }
    if (profileImageInput) {
        profileImageInput.addEventListener("change", async function () {
            const file = profileImageInput.files[0];
            if (!file) {
                return;
            }
            if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
                alert("Please select a JPG, PNG, GIF or WEBP image.");
                profileImageInput.value = "";
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                alert("Image must be less than 5 MB.");
                profileImageInput.value = "";
                return;
            }
            const reader = new FileReader();
            reader.onload = async function () {
                const imageData = reader.result;
                profileImage.src = imageData;
                await saveProfilePicture(imageData);
            };
            reader.onerror = function () {
                alert("Could not read the selected image.");
            };
            reader.readAsDataURL(file);
        });
    }
    async function saveProfilePicture(imageData) {
        try {
            const response = await fetch(`${API_BASE}/api/users/profile-picture`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ picture: imageData }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error("Profile picture save failed:", errorText);
                throw new Error("Could not save profile picture.");
            }
            const result = await response.json();
            if (result.picture && result.picture.trim() !== "") {
                profileImage.src = result.picture;
                localStorage.setItem("profileImage", result.picture);
            }
            alert("Profile picture saved successfully.");
        } catch (error) {
            console.error("Profile picture error:", error);
            const savedImage = localStorage.getItem("profileImage");
            if (savedImage) {
                profileImage.src = savedImage;
            } else {
                profileImage.src = DEFAULT_IMAGE;
            }
            alert("Profile picture was not saved.");
        }
    }
    if (removeButton) {
        removeButton.addEventListener("click", async function () {
            try {
                removeButton.disabled = true;
                removeButton.textContent = "Removing...";
                const response = await fetch(`${API_BASE}/api/users/profile-picture`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify({ picture: "" }),
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error("Remove picture failed:", errorText);
                    throw new Error("Failed to remove profile picture.");
                }
                const result = await response.json();
                console.log("Remove picture response:", result);
                localStorage.removeItem("profileImage");
                profileImage.src = DEFAULT_IMAGE;
                if (profileImageInput) {
                    profileImageInput.value = "";
                }
                alert("Profile picture removed successfully.");
            } catch (error) {
                console.error("Remove profile picture error:", error);
                alert("Profile picture could not be removed.");
            } finally {
                removeButton.disabled = false;
                removeButton.textContent = "Remove Profile Picture";
            }
        });
    }
    const privacyMessage = document.getElementById("privacyMessage");
    function showPrivacyMessage(text, isError) {
        if (!privacyMessage) {
            return;
        }
        privacyMessage.textContent = text;
        privacyMessage.classList.toggle("error", !!isError);
    }
    function applyPrivacyMode(mode) {
        const wanted = mode || "LAST_SEEN";
        document.querySelectorAll('input[name="presenceMode"]').forEach(function (radio) {
            radio.checked = radio.value === wanted;
        });
    }
    document.querySelectorAll('input[name="presenceMode"]').forEach(function (radio) {
        radio.addEventListener("change", async function () {
            showPrivacyMessage("Saving...", false);
            try {
                const response = await fetch(`${API_BASE}/api/users/privacy`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify({ presenceMode: radio.value }),
                });
                if (!response.ok) {
                    let message = "Could not save";
                    try {
                        const data = await response.json();
                        message = data.error || message;
                    } catch (e) {}
                    showPrivacyMessage(message, true);
                    loadProfile();
                    return;
                }
                showPrivacyMessage("Saved", false);
            } catch (error) {
                console.error(error);
                showPrivacyMessage("Could not reach the server", true);
            }
        });
    });
    async function loadProfile() {
        try {
            const response = await fetch(`${API_BASE}/api/users/me`, {
                method: "GET",
                headers: { "Authorization": `Bearer ${token}` },
            });
            if (!response.ok) {
                throw new Error("Could not load profile.");
            }
            const user = await response.json();
            if (usernameElement) {
                usernameElement.textContent = user.username || "";
            }
            if (displayNameElement) {
                displayNameElement.textContent = user.displayName || "";
            }
            if (onlineStatusElement) {
                onlineStatusElement.textContent = user.online ? "Online" : "Offline";
            }
            applyPrivacyMode(user.presenceMode);
            if (user.picture && user.picture.trim() !== "") {
                profileImage.src = user.picture;
                localStorage.setItem("profileImage", user.picture);
            } else {
                profileImage.src = DEFAULT_IMAGE;
                localStorage.removeItem("profileImage");
            }
        } catch (error) {
            console.error("Load profile error:", error);
            const savedImage = localStorage.getItem("profileImage");
            if (savedImage && savedImage.trim() !== "") {
                profileImage.src = savedImage;
            } else {
                profileImage.src = DEFAULT_IMAGE;
            }
        }
    }
    if (backButton) {
        backButton.addEventListener("click", function () {
            window.location.href = "chat2.html";
        });
    }
    loadProfile();
});
