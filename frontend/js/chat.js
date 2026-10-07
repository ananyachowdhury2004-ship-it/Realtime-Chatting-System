const API_BASE = "http://localhost:8080";
const WS_URL = `${API_BASE}/ws`;
const token = localStorage.getItem("token");
const currentUsername = localStorage.getItem("username");
const currentDisplayName = localStorage.getItem("displayName");
if (!token || !currentUsername) {
    window.location.href = "login.html";
}
const DEFAULT_PROFILE_IMAGE = "./images/Default-Icon.jpg";
const searchInput = document.getElementById("userSearchInput");
const searchButton = document.getElementById("userSearchButton");
const chatList = document.getElementById("chatList");
const chatsTab = document.getElementById("chatsTab");
const requestsTab = document.getElementById("requestsTab");
const blockedTab = document.getElementById("blockedTab");
const chatMenu = document.getElementById("chatMenu");
const chatMenuButton = document.getElementById("chatMenuButton");
const chatDropdown = document.getElementById("chatDropdown");
const deleteChatLink = document.getElementById("deleteChatLink");
const removeFriendLink = document.getElementById("removeFriendLink");
const blockUserLink = document.getElementById("blockUserLink");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const attachButton = document.getElementById("attachButton");
const fileInput = document.getElementById("fileInput");
const messagesContainer = document.querySelector(".messages-container");
const chatHeaderName = document.querySelector(".chat-user-details h3");
const chatHeaderStatus = document.querySelector(".chat-user-details p");
const registeredUserName = document.getElementById("registered-user-name");
const threeDots = document.getElementById("threeDots");
const dropdownMenu = document.getElementById("dropdownMenu");
const logoutLink = document.getElementById("logoutLink");
const profileImage = document.getElementById("image");
if (profileImage) {
    profileImage.src = DEFAULT_PROFILE_IMAGE;
    profileImage.onerror = function () {
        this.onerror = null;
        console.error("Default profile image could not be loaded:", DEFAULT_PROFILE_IMAGE);
    };
}
const savedProfileImage = localStorage.getItem("profileImage");
if (savedProfileImage && profileImage) {
    profileImage.src = savedProfileImage;
    profileImage.onerror = function () {
        console.warn("Saved profile image could not be loaded. Using default image.");
        this.onerror = null;
        this.src = DEFAULT_PROFILE_IMAGE;
        localStorage.removeItem("profileImage");
    };
}
async function loadCurrentUserProfile() {
    try {
        const response = await fetch(`${API_BASE}/api/users/me`, { headers: { "Authorization": `Bearer ${token}` } });
        if (!response.ok) {
            console.error("Could not load current user profile.");
            return;
        }
        const user = await response.json();
        const myStatus = document.querySelector(".my-status");
        if (myStatus && user.mobile) {
            myStatus.textContent = (user.mobile.length > 10 ? "+" : "") + user.mobile;
        }
        if (user.picture && user.picture.trim() !== "" && profileImage) {
            profileImage.src = user.picture;
            localStorage.setItem("profileImage", user.picture);
            profileImage.onerror = function () {
                console.warn("Database profile image could not be loaded. Using default image.");
                this.onerror = null;
                this.src = DEFAULT_PROFILE_IMAGE;
                localStorage.removeItem("profileImage");
            };
        } else if (profileImage) {
            profileImage.onerror = null;
            profileImage.src = DEFAULT_PROFILE_IMAGE;
            localStorage.removeItem("profileImage");
        }
    } catch (error) {
        console.error("Could not load profile image:", error);
        if (profileImage) {
            profileImage.onerror = null;
            profileImage.src = DEFAULT_PROFILE_IMAGE;
        }
    }
}
let activeUsername = null;
let activeProfilePicture = null;
let activeDisplayName = null;
let stompClient = null;
const presenceMap = {};
function presenceOf(username, fallbackOnline) {
    return (
        presenceMap[username] || {
            username: username,
            online: !!fallbackOnline,
            lastSeen: null,
            presenceMode: "ONLINE_ONLY",
        }
    );
}
function isOnlineVisible(p) {
    return !!p && p.presenceMode !== "NOTHING" && !!p.online;
}
function formatLastSeen(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) {
        return "Offline";
    }
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const now = new Date();
    function dayStart(x) {
        return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    }
    const days = Math.round((dayStart(now) - dayStart(d)) / 86400000);
    if (days <= 0) {
        return "last seen today at " + time;
    }
    if (days === 1) {
        return "last seen yesterday at " + time;
    }
    const date = d.toLocaleDateString(
        [],
        d.getFullYear() === now.getFullYear()
            ? { day: "numeric", month: "short" }
            : { day: "numeric", month: "short", year: "numeric" },
    );
    return "last seen on " + date + " at " + time;
}
function presenceText(p) {
    if (!p || p.presenceMode === "NOTHING") {
        return "";
    }
    if (p.online) {
        return "Online";
    }
    if (p.presenceMode === "LAST_SEEN" && p.lastSeen) {
        return formatLastSeen(p.lastSeen);
    }
    return "Offline";
}
function updateHeaderPresence(p) {
    if (chatHeaderStatus) {
        chatHeaderStatus.textContent = presenceText(p);
    }
    const headerBar = document.querySelector(".chat-header");
    if (headerBar) {
        headerBar.classList.toggle("is-online", isOnlineVisible(p));
    }
}
function applyPresence(p) {
    if (!p || !p.username) {
        return;
    }
    presenceMap[p.username] = p;
    document.querySelectorAll(".chat-user").forEach(function (row) {
        if (row.dataset.username !== p.username) {
            return;
        }
        row.classList.toggle("is-online", isOnlineVisible(p));
        if (row.dataset.kind === "friend") {
            const line = row.querySelector(".user-info p");
            if (line) {
                line.textContent = presenceText(p);
            }
        }
    });
    if (p.username === activeUsername) {
        updateHeaderPresence(p);
    }
}
if (registeredUserName) {
    registeredUserName.textContent = currentDisplayName || currentUsername;
}
if (logoutLink) {
    logoutLink.addEventListener("click", function (event) {
        event.preventDefault();
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        localStorage.removeItem("displayName");
        localStorage.removeItem("profileImage");
        if (stompClient) {
            stompClient.deactivate();
        }
        window.location.href = "login.html";
    });
}
if (threeDots && dropdownMenu) {
    threeDots.addEventListener("click", function (event) {
        event.stopPropagation();
        dropdownMenu.classList.toggle("show");
    });
}
if (chatsTab) {
    chatsTab.addEventListener("click", function () {
        setActiveTab("chats");
        loadFriends();
    });
}
if (requestsTab) {
    requestsTab.addEventListener("click", function () {
        setActiveTab("requests");
        loadFriendRequests();
    });
}
if (blockedTab) {
    blockedTab.addEventListener("click", function () {
        setActiveTab("blocked");
        loadBlockedUsers();
    });
}
function setActiveTab(tab) {
    if (chatsTab) {
        chatsTab.classList.remove("active");
    }
    if (requestsTab) {
        requestsTab.classList.remove("active");
    }
    if (blockedTab) {
        blockedTab.classList.remove("active");
    }
    if (tab === "blocked") {
        if (blockedTab) {
            blockedTab.classList.add("active");
        }
    } else if (tab === "chats") {
        if (chatsTab) {
            chatsTab.classList.add("active");
        }
    } else {
        if (requestsTab) {
            requestsTab.classList.add("active");
        }
    }
}
async function loadFriends() {
    try {
        const response = await fetch(`${API_BASE}/api/users/friends`, {
            headers: { "Authorization": `Bearer ${token}` },
        });
        if (!response.ok) {
            console.error("Failed to load friends");
            return;
        }
        const friends = await response.json();
        renderFriends(friends);
    } catch (error) {
        console.error("Error loading friends:", error);
        if (chatList) {
            chatList.innerHTML = `
                <p class="list-empty">
                    Could not reach server.
                </p>
            `;
        }
    }
}
function renderFriends(friends) {
    if (!chatList) {
        return;
    }
    chatList.innerHTML = "";
    if (!friends || friends.length === 0) {
        chatList.innerHTML = `
            <p class="list-empty">
                No chats yet.<br>
                Search for someone and send a friend request.
            </p>
        `;
        return;
    }
    friends.forEach(function (friend) {
        const item = document.createElement("div");
        item.classList.add("chat-user");
        item.dataset.username = friend.username;
        item.dataset.kind = "friend";
        presenceMap[friend.username] = friend;
        item.classList.toggle("is-online", isOnlineVisible(friend));
        const picture = friend.picture && friend.picture.trim() !== "" ? friend.picture : DEFAULT_PROFILE_IMAGE;
        item.innerHTML = `

                <div class="profile-image">

                    <img
                        src="${escapeHtml(picture)}"
                        alt="profile"
                    >

                </div>


                <div class="user-info">

                    <div class="chat-user-header">

                        <h3>
                            ${escapeHtml(friend.displayName || friend.username)}
                        </h3>

                    </div>


                    <p>
                        ${escapeHtml(presenceText(friend))}
                    </p>

                </div>

            `;
        const image = item.querySelector("img");
        if (image) {
            image.onerror = function () {
                this.onerror = null;
                this.src = DEFAULT_PROFILE_IMAGE;
            };
        }
        attachFriendMenu(item, friend);
        item.addEventListener("click", function () {
            openConversation(friend.username, friend.displayName || friend.username, friend.online, friend.picture);
        });
        chatList.appendChild(item);
    });
}
const searchClear = document.getElementById("userSearchClear");
let searchTimer = null;
let searchRequestId = 0;
function getCurrentTab() {
    if (blockedTab && blockedTab.classList.contains("active")) {
        return "blocked";
    }
    if (requestsTab && requestsTab.classList.contains("active")) {
        return "requests";
    }
    return "chats";
}
function showCurrentTabList() {
    const tab = getCurrentTab();
    if (tab === "blocked") {
        loadBlockedUsers();
    } else if (tab === "requests") {
        loadFriendRequests();
    } else {
        loadFriends();
    }
}
function refreshSidebarList() {
    if (searchInput && searchInput.value.trim() !== "") {
        searchUsers();
    } else {
        showCurrentTabList();
    }
}
function clearSearch() {
    if (searchInput) {
        searchInput.value = "";
    }
    if (searchClear) {
        searchClear.hidden = true;
    }
    clearTimeout(searchTimer);
    searchRequestId++;
    showCurrentTabList();
}
if (searchInput) {
    searchInput.addEventListener("input", function () {
        const query = searchInput.value.trim();
        if (searchClear) {
            searchClear.hidden = searchInput.value === "";
        }
        clearTimeout(searchTimer);
        if (!query) {
            searchRequestId++;
            showCurrentTabList();
            return;
        }
        searchTimer = setTimeout(searchUsers, 120);
    });
    searchInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            clearTimeout(searchTimer);
            searchUsers();
        }
        if (event.key === "Escape") {
            clearSearch();
        }
    });
}
if (searchClear) {
    searchClear.addEventListener("click", function () {
        clearSearch();
        if (searchInput) {
            searchInput.focus();
        }
    });
}
async function searchUsers() {
    const query = searchInput ? searchInput.value.trim() : "";
    if (!query) {
        showCurrentTabList();
        return;
    }
    const requestId = ++searchRequestId;
    try {
        const response = await fetch(`${API_BASE}/api/users/search?query=${encodeURIComponent(query)}`, {
            headers: { "Authorization": `Bearer ${token}` },
        });
        if (!response.ok) {
            console.error("Search failed");
            return;
        }
        const users = await response.json();
        if (requestId !== searchRequestId) {
            return;
        }
        renderSearchResults(users, query);
    } catch (error) {
        console.error("Search error:", error);
    }
}
function sortSearchResults(users, query) {
    const q = query.toLowerCase();
    function nameOf(user) {
        return (user.displayName || user.username || "").toLowerCase();
    }
    function rank(user) {
        const name = nameOf(user);
        const username = (user.username || "").toLowerCase();
        if (name.startsWith(q)) {
            return 0;
        }
        if (username.startsWith(q)) {
            return 1;
        }
        if (name.split(/\s+/).some((w) => w.startsWith(q))) {
            return 2;
        }
        return 3;
    }
    return users.slice().sort(function (a, b) {
        const diff = rank(a) - rank(b);
        if (diff !== 0) {
            return diff;
        }
        return nameOf(a).localeCompare(nameOf(b));
    });
}
function highlightMatch(text, query) {
    const value = text == null ? "" : String(text);
    const index = value.toLowerCase().indexOf(query.toLowerCase());
    if (!query || index === -1) {
        return escapeHtml(value);
    }
    return (
        escapeHtml(value.slice(0, index)) +
        "<mark>" +
        escapeHtml(value.slice(index, index + query.length)) +
        "</mark>" +
        escapeHtml(value.slice(index + query.length))
    );
}
const FRIEND_STATUS_LABEL = { ACCEPTED: "Friend", PENDING: "Request pending" };
function renderSearchResults(users, query) {
    if (!chatList) {
        return;
    }
    chatList.innerHTML = "";
    if (!users || users.length === 0) {
        chatList.innerHTML = `
            <p class="list-empty">
                No user found for "${escapeHtml(query || "")}".
            </p>
        `;
        return;
    }
    sortSearchResults(users, query || "").forEach(function (user) {
        const item = document.createElement("div");
        item.classList.add("chat-user");
        item.dataset.username = user.username;
        item.classList.toggle("is-online", !!user.online);
        const displayName = user.displayName || user.username;
        const isFriend = user.friendStatus === "ACCEPTED";
        const canAdd = user.friendStatus === "NONE" || user.friendStatus === "REJECTED";
        const picture = user.picture && user.picture.trim() !== "" ? user.picture : DEFAULT_PROFILE_IMAGE;
        const statusText = FRIEND_STATUS_LABEL[user.friendStatus] || "";
        item.innerHTML = `
                    <div class="profile-image">
                        <img
                            src="${escapeHtml(picture)}"
                            alt="profile"
                        >
                    </div>

                    <div class="user-info">

                        <div class="chat-user-header">
                            <h3>
                                ${highlightMatch(displayName, query)}
                            </h3>
                        </div>

                        <p>
                            ${user.mobileHint ? `<span class="mobile-hint">${escapeHtml(user.mobileHint)}</span>` : ""}
                            ${
                                statusText
                                    ? `<span class="status-chip ${isFriend ? "is-friend" : ""}">${escapeHtml(statusText)}</span>`
                                    : ""
                            }
                        </p>

                    </div>

                    ${
                        canAdd
                            ? `<button
                                   type="button"
                                   class="friend-action add-friend add-friend-btn">
                                   Add friend
                               </button>`
                            : ""
                    }
                `;
        const addBtn = item.querySelector(".add-friend-btn");
        if (addBtn) {
            addBtn.addEventListener("click", async function (event) {
                event.stopPropagation();
                addBtn.disabled = true;
                const result = await apiRequest(`/api/friend-requests/${encodeURIComponent(user.username)}`, "POST");
                showToast(result.data.error || result.data.message || "Done");
                searchUsers();
            });
        }
        if (isFriend) {
            item.addEventListener("click", function () {
                if (user.presenceMode) {
                    presenceMap[user.username] = user;
                }
                openConversation(user.username, displayName, user.online, user.picture);
            });
        }
        const image = item.querySelector("img");
        if (image) {
            image.onerror = function () {
                this.onerror = null;
                this.src = DEFAULT_PROFILE_IMAGE;
            };
        }
        chatList.appendChild(item);
    });
}
async function loadFriendRequests() {
    try {
        const response = await fetch(`${API_BASE}/api/friend-requests/received`, {
            headers: { "Authorization": `Bearer ${token}` },
        });
        if (!response.ok) {
            console.error("Failed to load friend requests");
            return;
        }
        const requests = await response.json();
        renderFriendRequests(requests);
    } catch (error) {
        console.error("Error loading friend requests:", error);
    }
}
function renderFriendRequests(requests) {
    if (!chatList) {
        return;
    }
    chatList.innerHTML = "";
    if (!requests || requests.length === 0) {
        chatList.innerHTML = `
            <p class="list-empty">
                No friend requests.
            </p>
        `;
        return;
    }
    requests.forEach(function (request) {
        const item = document.createElement("div");
        item.classList.add("chat-user");
        const picture = request.senderPicture || request.picture || DEFAULT_PROFILE_IMAGE;
        item.innerHTML = `

                <div class="profile-image">

                    <img
                        src="${escapeHtml(picture)}"
                        alt="profile"
                    >

                </div>


                <div class="user-info">

                    <h3>
                        ${escapeHtml(request.senderDisplayName || request.senderUsername || "User")}
                    </h3>


                    <div class="request-buttons">

                        <button
                            type="button"
                            class="accept-request"
                            onclick="
                                acceptFriendRequest(
                                    ${request.id}
                                )
                            "
                        >
                            Accept
                        </button>


                        <button
                            type="button"
                            class="reject-request"
                            onclick="
                                rejectFriendRequest(
                                    ${request.id}
                                )
                            "
                        >
                            Reject
                        </button>

                    </div>

                </div>
            `;
        const image = item.querySelector("img");
        if (image) {
            image.onerror = function () {
                this.onerror = null;
                this.src = DEFAULT_PROFILE_IMAGE;
            };
        }
        chatList.appendChild(item);
    });
}
async function acceptFriendRequest(id) {
    try {
        const response = await fetch(`${API_BASE}/api/friend-requests/${id}/accept`, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) {
            showToast(data.error || "Could not accept request");
            return;
        }
        showToast("Friend request accepted");
        loadFriendRequests();
    } catch (error) {
        console.error(error);
        showToast("Could not reach server");
    }
}
async function rejectFriendRequest(id) {
    try {
        const response = await fetch(`${API_BASE}/api/friend-requests/${id}/reject`, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) {
            showToast(data.error || "Could not reject request");
            return;
        }
        showToast("Friend request rejected");
        loadFriendRequests();
    } catch (error) {
        console.error(error);
        showToast("Could not reach server");
    }
}
async function openConversation(username, displayName, online, picture) {
    activeUsername = username;
    activeDisplayName = displayName;
    cancelRecording();
    showChatPanel();
    if (chatMenu) {
        chatMenu.style.display = "block";
    }
    closeChatDropdown();
    activeProfilePicture = picture && picture.trim() !== "" ? picture : DEFAULT_PROFILE_IMAGE;
    document.querySelectorAll(".chat-user").forEach(function (el) {
        el.classList.toggle("active", el.dataset.username === username);
    });
    if (chatHeaderName) {
        chatHeaderName.textContent = displayName;
    }
    if (chatHeaderStatus) {
        chatHeaderStatus.textContent = presenceText(presenceOf(username, online));
        const headerBar = document.querySelector(".chat-header");
        if (headerBar) {
            headerBar.classList.toggle("is-online", isOnlineVisible(presenceOf(username, online)));
        }
    }
    updateChatHeaderImage(activeProfilePicture);
    if (messagesContainer) {
        messagesContainer.innerHTML = "<p style='color:#888;'>Loading messages...</p>";
    }
    try {
        const response = await fetch(`${API_BASE}/api/messages/${encodeURIComponent(username)}`, {
            headers: { "Authorization": `Bearer ${token}` },
        });
        if (!response.ok) {
            if (messagesContainer) {
                messagesContainer.innerHTML = "<p style='color:#888;'>You are not friends with this user.</p>";
            }
            return;
        }
        const history = await response.json();
        if (messagesContainer) {
            messagesContainer.innerHTML = "";
        }
        history.forEach(function (m) {
            renderMessage(m);
        });
        scrollToBottom();
        markConversationRead(username);
    } catch (error) {
        console.error(error);
        if (messagesContainer) {
            messagesContainer.innerHTML = "<p style='color:#888;'>Could not reach server.</p>";
        }
    }
}
function updateChatHeaderImage(picture) {
    const headerImage = document.getElementById("chatProfileImage") || document.querySelector(".chat-header img");
    if (!headerImage) {
        return;
    }
    headerImage.onerror = function () {
        this.onerror = null;
        this.src = DEFAULT_PROFILE_IMAGE;
    };
    headerImage.src = picture && picture.trim() !== "" ? picture : DEFAULT_PROFILE_IMAGE;
}
const PLAY_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
const PAUSE_ICON =
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
function formatClock(seconds) {
    const total = Math.max(0, Math.floor(seconds || 0));
    return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
}
function formatMessageTime(timestamp) {
    if (!timestamp) {
        return "";
    }
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
        return "";
    }
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
let playingVoice = null;
function buildVoicePlayer(url) {
    const wrap = document.createElement("div");
    wrap.className = "voice";
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.src = url;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "voice-play";
    button.setAttribute("aria-label", "Play voice message");
    button.innerHTML = PLAY_ICON;
    const track = document.createElement("div");
    track.className = "voice-track";
    const seek = document.createElement("input");
    seek.type = "range";
    seek.className = "voice-seek";
    seek.min = "0";
    seek.max = "100";
    seek.step = "0.1";
    seek.value = "0";
    seek.setAttribute("aria-label", "Seek");
    const time = document.createElement("span");
    time.className = "voice-time";
    time.textContent = "0:00";
    track.append(seek, time);
    wrap.append(button, track, audio);
    let total = 0;
    function duration() {
        return isFinite(audio.duration) ? audio.duration : total;
    }
    function paint() {
        const length = duration();
        const current = audio.currentTime || 0;
        const percent = length > 0 ? Math.min(100, (current / length) * 100) : 0;
        seek.value = percent;
        seek.style.setProperty("--pct", percent + "%");
        time.textContent = formatClock(audio.paused && current === 0 ? length : current);
    }
    audio.addEventListener("loadedmetadata", function () {
        if (audio.duration === Infinity) {
            const fix = function () {
                audio.removeEventListener("timeupdate", fix);
                total = audio.duration;
                audio.currentTime = 0;
                paint();
            };
            audio.addEventListener("timeupdate", fix);
            audio.currentTime = 1e101;
        } else {
            total = audio.duration;
            paint();
        }
    });
    audio.addEventListener("timeupdate", paint);
    audio.addEventListener("play", function () {
        button.innerHTML = PAUSE_ICON;
        button.setAttribute("aria-label", "Pause voice message");
    });
    audio.addEventListener("pause", function () {
        button.innerHTML = PLAY_ICON;
        button.setAttribute("aria-label", "Play voice message");
    });
    audio.addEventListener("ended", function () {
        audio.currentTime = 0;
        if (playingVoice === audio) {
            playingVoice = null;
        }
        paint();
    });
    audio.addEventListener("error", function () {
        time.textContent = "unavailable";
    });
    button.addEventListener("click", function () {
        if (audio.paused) {
            if (playingVoice && playingVoice !== audio) {
                playingVoice.pause();
            }
            playingVoice = audio;
            audio.play().catch(function () {
                showToast("Could not play this voice message");
            });
        } else {
            audio.pause();
        }
    });
    seek.addEventListener("input", function () {
        const length = duration();
        if (length > 0) {
            audio.currentTime = (seek.value / 100) * length;
        }
    });
    return wrap;
}
const TICK_RANK = { SENT: 0, DELIVERED: 1, READ: 2 };
const TICK_ATTRS =
    'class="tick-svg" viewBox="0 0 18 12" width="17" height="12" ' +
    'fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const TICK_SINGLE_SVG = "<svg " + TICK_ATTRS + '><path d="M3 6.5L6.5 10 14 2"/></svg>';
const TICK_DOUBLE_SVG =
    "<svg " + TICK_ATTRS + ">" + '<path d="M1 6.5L4.5 10 12 2"/>' + '<path d="M6.5 6.5L10 10 17.5 2"/></svg>';
const TICK_LABEL = { SENT: "Sent", DELIVERED: "Delivered", READ: "Read" };
function setTick(bubble, status) {
    const tick = bubble.querySelector(".msg-tick");
    if (!tick) {
        return;
    }
    const next = TICK_RANK[status] === undefined ? "SENT" : status;
    const current = bubble.dataset.status;
    if (current && TICK_RANK[next] < TICK_RANK[current]) {
        return;
    }
    bubble.dataset.status = next;
    tick.className = "msg-tick tick-" + next.toLowerCase();
    tick.innerHTML = next === "SENT" ? TICK_SINGLE_SVG : TICK_DOUBLE_SVG;
    tick.title = TICK_LABEL[next];
}
function fillBubble(bubble, msg) {
    const isMine = msg.senderUsername === currentUsername;
    if (msg.deleted) {
        bubble.classList.add("deleted");
        const note = document.createElement("span");
        note.className = "deleted-note";
        note.textContent = isMine ? "\uD83D\uDEAB You deleted this message" : "\uD83D\uDEAB This message was deleted";
        bubble.appendChild(note);
    } else if (msg.attachment) {
        const mediaUrl = `${API_BASE}/files/${encodeURIComponent(msg.attachment)}`;
        if (msg.attachmentType === "AUDIO") {
            bubble.appendChild(buildVoicePlayer(mediaUrl));
        } else {
            bubble.classList.add("has-media");
            let media;
            if (msg.attachmentType === "VIDEO") {
                media = document.createElement("video");
                media.controls = true;
                media.preload = "metadata";
                media.addEventListener("loadedmetadata", scrollToBottom);
            } else {
                media = document.createElement("img");
                media.alt = "photo";
                media.addEventListener("load", scrollToBottom);
            }
            media.classList.add("chat-media");
            media.src = mediaUrl;
            bubble.appendChild(media);
            if (msg.content) {
                const caption = document.createElement("div");
                caption.classList.add("chat-caption");
                caption.textContent = msg.content;
                bubble.appendChild(caption);
            }
        }
    } else {
        const text = document.createElement("span");
        text.textContent = msg.content;
        bubble.appendChild(text);
    }
    const time = document.createElement("span");
    time.className = "msg-time";
    time.appendChild(document.createTextNode(formatMessageTime(msg.timestamp)));
    if (isMine && !msg.deleted) {
        const tick = document.createElement("span");
        tick.className = "msg-tick";
        time.appendChild(tick);
    }
    bubble.appendChild(time);
    if (isMine && !msg.deleted) {
        setTick(bubble, msg.status || "SENT");
    }
}
function renderMessage(msg) {
    if (!messagesContainer) {
        return;
    }
    const bubble = document.createElement("div");
    const isMine = msg.senderUsername === currentUsername;
    bubble.classList.add("message", isMine ? "sent" : "received");
    if (msg.id !== undefined && msg.id !== null) {
        bubble.dataset.id = msg.id;
    }
    bubble.dataset.sender = msg.senderUsername || "";
    bubble.dataset.ts = msg.timestamp || "";
    bubble.dataset.delivered = msg.deliveredAt || "";
    bubble.dataset.read = msg.readAt || "";
    bubble.dataset.attachment = msg.attachment || "";
    bubble.dataset.attachmentType = msg.attachmentType || "";
    bubble.dataset.text = msg.deleted ? "" : msg.content || "";
    addDaySeparatorIfNeeded(msg.timestamp);
    fillBubble(bubble, msg);
    attachMessageMenu(bubble);
    attachMessageInfoClick(bubble);
    messagesContainer.appendChild(bubble);
}
let msgMenuTarget = null;
const msgMenu = document.createElement("div");
msgMenu.className = "dropdown-menu list-menu msg-menu";
msgMenu.setAttribute("role", "menu");
msgMenu.innerHTML = `
    <a href="#" data-action="info" role="menuitem">
        <span class="mi">&#9432;</span>Message info
    </a>
    <a href="#" data-scope="me" role="menuitem">
        <span class="mi">&#128465;</span>Delete for me
    </a>
    <a href="#" data-scope="everyone" role="menuitem" class="danger">
        <span class="mi">&#128683;</span>Delete for everyone
    </a>
`;
document.body.appendChild(msgMenu);
function closeMsgMenu() {
    msgMenu.classList.remove("show");
    msgMenuTarget = null;
}
function openMsgMenu(bubble, x, y) {
    if (!bubble.dataset.id) {
        return;
    }
    closeListMenu();
    closeChatDropdown();
    msgMenuTarget = bubble;
    const canEveryone = bubble.classList.contains("sent") && !bubble.classList.contains("deleted");
    msgMenu.querySelector('[data-scope="everyone"]').style.display = canEveryone ? "" : "none";
    msgMenu.querySelector('[data-action="info"]').style.display = bubble.classList.contains("deleted") ? "none" : "";
    msgMenu.classList.add("show");
    const width = msgMenu.offsetWidth;
    const height = msgMenu.offsetHeight;
    msgMenu.style.left = Math.max(8, Math.min(x, window.innerWidth - width - 8)) + "px";
    msgMenu.style.top = Math.max(8, Math.min(y, window.innerHeight - height - 8)) + "px";
}
msgMenu.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    const link = event.target.closest("a[data-scope], a[data-action]");
    if (!link || !msgMenuTarget) {
        return;
    }
    const bubble = msgMenuTarget;
    closeMsgMenu();
    if (link.dataset.action === "info") {
        openMessageInfo(bubble);
        return;
    }
    deleteMessage(bubble, link.dataset.scope);
});
document.addEventListener("click", closeMsgMenu);
document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        closeMsgMenu();
    }
});
window.addEventListener("resize", closeMsgMenu);
if (messagesContainer) {
    messagesContainer.addEventListener("scroll", closeMsgMenu);
}
function addMenuButton(bubble) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "msg-menu-btn";
    button.title = "Message options";
    button.setAttribute("aria-label", "Message options");
    button.innerHTML =
        '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" ' +
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
        'stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M5 8l5 5 5-5"/></svg>';
    button.addEventListener("click", function (event) {
        event.stopPropagation();
        const rect = button.getBoundingClientRect();
        openMsgMenu(bubble, rect.right - 210, rect.bottom + 4);
    });
    bubble.appendChild(button);
}
function attachMessageMenu(bubble) {
    addMenuButton(bubble);
    let holdTimer = null;
    let heldOpen = false;
    let startX = 0;
    let startY = 0;
    function cancelHold() {
        clearTimeout(holdTimer);
        holdTimer = null;
    }
    bubble.addEventListener("contextmenu", function (event) {
        event.preventDefault();
        openMsgMenu(bubble, event.clientX, event.clientY);
    });
    bubble.addEventListener("pointerdown", function (event) {
        if (event.pointerType === "mouse") {
            return;
        }
        if (event.target.closest(".voice-seek, video, .msg-menu-btn")) {
            return;
        }
        heldOpen = false;
        startX = event.clientX;
        startY = event.clientY;
        cancelHold();
        holdTimer = setTimeout(function () {
            heldOpen = true;
            if (navigator.vibrate) {
                navigator.vibrate(15);
            }
            openMsgMenu(bubble, startX - 100, startY + 24);
        }, 450);
    });
    bubble.addEventListener("pointermove", function (event) {
        if (Math.abs(event.clientX - startX) > 10 || Math.abs(event.clientY - startY) > 10) {
            cancelHold();
        }
    });
    bubble.addEventListener("pointerup", cancelHold);
    bubble.addEventListener("pointercancel", cancelHold);
    bubble.addEventListener("pointerleave", cancelHold);
    bubble.addEventListener(
        "click",
        function (event) {
            if (heldOpen) {
                heldOpen = false;
                event.stopPropagation();
                event.preventDefault();
            }
        },
        true,
    );
}
function stopBubbleMedia(bubble) {
    bubble.querySelectorAll("audio, video").forEach(function (media) {
        media.pause();
    });
}
function markBubbleDeleted(bubble) {
    stopBubbleMedia(bubble);
    bubble.replaceChildren();
    bubble.classList.remove("has-media");
    delete bubble.dataset.status;
    fillBubble(bubble, { senderUsername: bubble.dataset.sender, timestamp: bubble.dataset.ts, deleted: true });
    addMenuButton(bubble);
}
async function deleteMessage(bubble, scope) {
    const id = bubble.dataset.id;
    if (!id) {
        return;
    }
    if (
        scope === "everyone" &&
        !confirm("Delete this message for everyone?\n\n" + "It will be removed for you and for the receiver.")
    ) {
        return;
    }
    try {
        const result = await apiRequest(`/api/messages/by-id/${encodeURIComponent(id)}?scope=${scope}`, "DELETE");
        if (!result.ok) {
            showToast(result.data.error || "Could not delete message");
            return;
        }
        if (scope === "everyone") {
            markBubbleDeleted(bubble);
        } else {
            stopBubbleMedia(bubble);
            bubble.remove();
            cleanupDaySeparators();
        }
    } catch (error) {
        console.error(error);
        showToast("Could not reach server");
    }
}
function markConversationRead(peer) {
    if (!peer || document.visibilityState !== "visible") {
        return;
    }
    fetch(`${API_BASE}/api/messages/${encodeURIComponent(peer)}/read`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
    }).catch(function () {});
}
document.addEventListener("visibilitychange", function () {
    if (activeUsername) {
        markConversationRead(activeUsername);
    }
});
window.addEventListener("focus", function () {
    if (activeUsername) {
        markConversationRead(activeUsername);
    }
});
function onReceipt(frame) {
    let receipt;
    try {
        receipt = JSON.parse(frame.body);
    } catch (e) {
        return;
    }
    if (!receipt || !messagesContainer || receipt.peer !== activeUsername) {
        return;
    }
    const status = receipt.status === "READ" ? "READ" : "DELIVERED";
    messagesContainer.querySelectorAll(".message.sent:not(.deleted)").forEach(function (bubble) {
        setTick(bubble, status);
        stampReceipt(bubble, status, receipt.at);
    });
    refreshOpenMessageInfo();
}
function onDeletion(frame) {
    let info;
    try {
        info = JSON.parse(frame.body);
    } catch (e) {
        return;
    }
    if (!info || !messagesContainer || info.peer !== activeUsername) {
        return;
    }
    const bubble = messagesContainer.querySelector(`.message[data-id="${info.id}"]`);
    if (bubble && !bubble.classList.contains("deleted")) {
        markBubbleDeleted(bubble);
    }
}
function startOfLocalDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
function dayKeyOf(date) {
    return date.getFullYear() + "-" + date.getMonth() + "-" + date.getDate();
}
function dayLabel(date) {
    const days = Math.round((startOfLocalDay(new Date()) - startOfLocalDay(date)) / 86400000);
    if (days <= 0) {
        return "Today";
    }
    if (days === 1) {
        return "Yesterday";
    }
    if (days < 7) {
        return date.toLocaleDateString([], { weekday: "long" });
    }
    return date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}
function formatStamp(iso) {
    if (!iso) {
        return "";
    }
    const d = new Date(iso);
    if (isNaN(d.getTime())) {
        return "";
    }
    return (
        d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: "numeric" }) +
        ", " +
        d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    );
}
function lastMessageBubble() {
    let node = messagesContainer.lastElementChild;
    while (node && !node.classList.contains("message")) {
        node = node.previousElementSibling;
    }
    return node;
}
function refreshDaySeparatorLabels() {
    messagesContainer.querySelectorAll(".day-separator").forEach(function (sep) {
        const d = new Date(sep.dataset.ts);
        if (!isNaN(d.getTime())) {
            sep.textContent = dayLabel(d);
        }
    });
}
function addDaySeparatorIfNeeded(timestamp) {
    if (!messagesContainer || !timestamp) {
        return;
    }
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
        return;
    }
    const previous = lastMessageBubble();
    if (previous) {
        const before = new Date(previous.dataset.ts);
        if (!isNaN(before.getTime()) && dayKeyOf(before) === dayKeyOf(date)) {
            return;
        }
    }
    const sep = document.createElement("div");
    sep.className = "day-separator";
    sep.dataset.ts = timestamp;
    sep.textContent = dayLabel(date);
    sep.setAttribute("role", "separator");
    messagesContainer.appendChild(sep);
    refreshDaySeparatorLabels();
}
function cleanupDaySeparators() {
    if (!messagesContainer) {
        return;
    }
    messagesContainer.querySelectorAll(".day-separator").forEach(function (sep) {
        const next = sep.nextElementSibling;
        if (!next || !next.classList.contains("message")) {
            sep.remove();
        }
    });
}
const modalStack = [];
function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) {
        node.className = className;
    }
    if (text !== undefined && text !== null) {
        node.textContent = text;
    }
    return node;
}
function createModal(extraClass, label) {
    const overlay = el("div", "app-modal " + extraClass);
    overlay.hidden = true;
    const card = el("div", "app-modal-card");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-label", label);
    const closeBtn = el("button", "app-modal-close", "\u00D7");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    card.appendChild(closeBtn);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    const modal = {
        overlay: overlay,
        card: card,
        closeBtn: closeBtn,
        onHide: null,
        show: function () {
            overlay.hidden = false;
            if (modalStack.indexOf(modal) === -1) {
                modalStack.push(modal);
            }
            closeBtn.focus();
        },
        hide: function () {
            overlay.hidden = true;
            const i = modalStack.indexOf(modal);
            if (i !== -1) {
                modalStack.splice(i, 1);
            }
            if (modal.onHide) {
                modal.onHide();
            }
        },
    };
    closeBtn.addEventListener("click", modal.hide);
    overlay.addEventListener("click", function (event) {
        if (event.target === overlay) {
            modal.hide();
        }
    });
    return modal;
}
document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && modalStack.length) {
        modalStack[modalStack.length - 1].hide();
    }
});
function safeImageSrc(src) {
    if (typeof src !== "string" || !src.trim()) {
        return DEFAULT_PROFILE_IMAGE;
    }
    const value = src.trim();
    if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(value.slice(0, 40))) {
        return value;
    }
    if (/^(https?:\/\/|\.\/|\/)/i.test(value)) {
        return value;
    }
    return DEFAULT_PROFILE_IMAGE;
}
let infoModal = null;
let infoBody = null;
let infoBubble = null;
function buildInfoModal() {
    infoModal = createModal("info-modal", "Message info");
    infoBody = el("div", "info-body");
    infoModal.card.appendChild(el("h3", "app-modal-title", "Message info"));
    infoModal.card.appendChild(infoBody);
    infoModal.onHide = function () {
        infoBubble = null;
    };
}
function stampReceipt(bubble, status, at) {
    const when = at || new Date().toISOString();
    if (!bubble.dataset.delivered) {
        bubble.dataset.delivered = when;
    }
    if (status === "READ" && !bubble.dataset.read) {
        bubble.dataset.read = when;
    }
}
function infoRow(list, label, value, muted) {
    const row = el("div", "info-row");
    row.appendChild(el("dt", "", label));
    row.appendChild(el("dd", muted ? "muted" : "", value));
    list.appendChild(row);
}
function renderMessageInfo() {
    const bubble = infoBubble;
    if (!bubble) {
        return;
    }
    const mine = bubble.classList.contains("sent");
    const file = bubble.dataset.attachment;
    const kind = bubble.dataset.attachmentType;
    const text = bubble.dataset.text || "";
    infoBody.replaceChildren();
    const preview = el("div", "info-preview");
    let mediaUrl = null;
    if (file) {
        mediaUrl = `${API_BASE}/files/${encodeURIComponent(file)}`;
    }
    if (file && kind === "IMAGE") {
        const img = el("img", "info-thumb");
        img.alt = "photo";
        img.src = mediaUrl;
        preview.appendChild(img);
    } else if (file && kind === "VIDEO") {
        preview.appendChild(el("div", "info-kind", "\uD83C\uDFAC Video"));
    } else if (file && kind === "AUDIO") {
        preview.appendChild(el("div", "info-kind", "\uD83C\uDFA4 Voice message"));
    }
    if (text) {
        preview.appendChild(el("div", "info-text", text.length > 200 ? text.slice(0, 200) + "\u2026" : text));
    }
    infoBody.appendChild(preview);
    const list = el("dl", "info-rows");
    infoRow(list, "Sent", formatStamp(bubble.dataset.ts) || "\u2014");
    const delivered = formatStamp(bubble.dataset.delivered);
    infoRow(list, "Delivered", delivered || (mine ? "Not delivered yet" : "\u2014"), !delivered);
    const read = formatStamp(bubble.dataset.read);
    infoRow(list, "Read", read || (mine ? "Not read yet" : "\u2014"), !read);
    infoBody.appendChild(list);
    if (mediaUrl && (kind === "IMAGE" || kind === "VIDEO")) {
        const open = el("a", "info-open", kind === "IMAGE" ? "Open full size" : "Open video");
        open.href = mediaUrl;
        open.target = "_blank";
        open.rel = "noopener noreferrer";
        infoBody.appendChild(open);
    }
    const actions = el("div", "info-actions");
    const delMe = el("button", "info-btn", "Delete for me");
    delMe.type = "button";
    delMe.addEventListener("click", function () {
        infoModal.hide();
        deleteMessage(bubble, "me");
    });
    actions.appendChild(delMe);
    if (mine) {
        const delAll = el("button", "info-btn danger", "Delete for everyone");
        delAll.type = "button";
        delAll.addEventListener("click", function () {
            infoModal.hide();
            deleteMessage(bubble, "everyone");
        });
        actions.appendChild(delAll);
    }
    infoBody.appendChild(actions);
}
function openMessageInfo(bubble) {
    if (!bubble || !bubble.dataset.id || bubble.classList.contains("deleted")) {
        return;
    }
    if (!infoModal) {
        buildInfoModal();
    }
    infoBubble = bubble;
    renderMessageInfo();
    infoModal.show();
}
function refreshOpenMessageInfo() {
    if (infoModal && !infoModal.overlay.hidden && infoBubble && document.body.contains(infoBubble)) {
        renderMessageInfo();
    }
}
function attachMessageInfoClick(bubble) {
    bubble.addEventListener("click", function (event) {
        if (event.target.closest(".msg-menu-btn, .voice, video, audio, button, a, input")) {
            return;
        }
        const selection = window.getSelection ? String(window.getSelection()) : "";
        if (selection.length > 0) {
            return;
        }
        openMessageInfo(bubble);
    });
}
let profileModal = null;
let profileEls = null;
let profileRequest = 0;
let photoModal = null;
let photoEl = null;
const RELATION_TEXT = {
    SELF: "This is you",
    FRIENDS: "Friend",
    PENDING: "Friend request pending",
    NONE: "Not connected",
};
function buildProfileModal() {
    profileModal = createModal("profile-modal", "User profile");
    const photoBtn = el("button", "pf-photo-btn");
    photoBtn.type = "button";
    photoBtn.title = "View full photo";
    photoBtn.setAttribute("aria-label", "View full photo");
    const photo = el("img", "pf-photo");
    photo.alt = "profile photo";
    photo.onerror = function () {
        this.onerror = null;
        this.src = DEFAULT_PROFILE_IMAGE;
    };
    photoBtn.appendChild(photo);
    const name = el("h2", "pf-name");
    const handle = el("p", "pf-handle");
    const status = el("p", "pf-status");
    const rows = el("dl", "info-rows pf-rows");
    const error = el("p", "pf-error");
    profileModal.card.append(photoBtn, name, handle, status, rows, error);
    profileEls = { photo: photo, name: name, handle: handle, status: status, rows: rows, error: error };
    photoBtn.addEventListener("click", function () {
        if (!photoModal) {
            photoModal = createModal("photo-modal", "Profile photo");
            photoEl = el("img", "pf-full");
            photoEl.alt = "profile photo (full size)";
            photoModal.card.appendChild(photoEl);
        }
        photoEl.src = photo.src;
        photoModal.show();
    });
}
function fillProfile(p) {
    const shownName = p.displayName || p.username;
    profileEls.photo.src = safeImageSrc(p.picture);
    profileEls.name.textContent = shownName;
    profileEls.handle.textContent = "@" + p.username;
    profileEls.status.textContent = presenceText(p);
    profileEls.status.hidden = !profileEls.status.textContent;
    profileEls.error.textContent = "";
    profileEls.rows.replaceChildren();
    infoRow(profileEls.rows, "Name", shownName);
    infoRow(profileEls.rows, "Username", p.username);
    infoRow(profileEls.rows, "User ID", String(p.id));
    infoRow(profileEls.rows, "Mobile", p.mobileHint || "\u2014", !p.mobileHint);
    const since = p.memberSince ? new Date(p.memberSince) : null;
    infoRow(
        profileEls.rows,
        "Member since",
        since && !isNaN(since.getTime())
            ? since.toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" })
            : "\u2014",
        !since,
    );
    infoRow(profileEls.rows, "Relationship", RELATION_TEXT[p.relation] || "\u2014");
}
async function openProfile(username, displayNameHint, pictureHint) {
    if (!username) {
        return;
    }
    if (!profileModal) {
        buildProfileModal();
    }
    const requestId = ++profileRequest;
    profileEls.photo.src = safeImageSrc(pictureHint);
    profileEls.name.textContent = displayNameHint || username;
    profileEls.handle.textContent = "@" + username;
    profileEls.status.textContent = "";
    profileEls.status.hidden = true;
    profileEls.rows.replaceChildren();
    profileEls.error.textContent = "Loading\u2026";
    profileModal.show();
    try {
        const response = await fetch(`${API_BASE}/api/users/${encodeURIComponent(username)}/profile`, {
            headers: { "Authorization": `Bearer ${token}` },
        });
        if (requestId !== profileRequest) {
            return;
        }
        if (!response.ok) {
            profileEls.error.textContent = "This profile is not available.";
            return;
        }
        fillProfile(await response.json());
    } catch (error) {
        console.error(error);
        if (requestId === profileRequest) {
            profileEls.error.textContent = "Could not reach server.";
        }
    }
}
function wireHeaderProfileClick() {
    const targets = [
        document.querySelector(".chat-header .profile-image"),
        document.querySelector(".chat-header .chat-user-details"),
    ];
    function open() {
        if (activeUsername) {
            openProfile(activeUsername, activeDisplayName, activeProfilePicture);
        }
    }
    targets.forEach(function (node) {
        if (!node) {
            return;
        }
        node.classList.add("profile-trigger");
        node.setAttribute("role", "button");
        node.tabIndex = 0;
        node.title = "View profile";
        node.addEventListener("click", open);
        node.addEventListener("keydown", function (event) {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                open();
            }
        });
    });
}
wireHeaderProfileClick();
const viewProfileLink = document.getElementById("viewProfileLink");
if (viewProfileLink) {
    viewProfileLink.addEventListener("click", function (event) {
        event.preventDefault();
        closeChatDropdown();
        if (activeUsername) {
            openProfile(activeUsername, activeDisplayName, activeProfilePicture);
        }
    });
}
function scrollToBottom() {
    if (!messagesContainer) {
        return;
    }
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
if (sendButton) {
    sendButton.addEventListener("click", sendMessage);
}
if (messageInput) {
    messageInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            sendMessage();
        }
    });
}
function sendMessage() {
    if (!messageInput) {
        return;
    }
    const text = messageInput.value.trim();
    if (text === "") {
        return;
    }
    if (!activeUsername) {
        showToast("Select an accepted friend first.");
        return;
    }
    if (!stompClient || !stompClient.connected) {
        showToast("Not connected to server yet.");
        return;
    }
    const payload = { receiverUsername: activeUsername, content: text };
    stompClient.publish({ destination: "/app/chat.send", body: JSON.stringify(payload) });
    messageInput.value = "";
    updateComposer();
}
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/ogg",
    "audio/webm",
    "audio/ogg",
    "audio/mp4",
    "audio/x-m4a",
    "audio/aac",
    "audio/mpeg",
    "audio/wav",
]);
if (attachButton && fileInput) {
    attachButton.addEventListener("click", function () {
        if (!activeUsername) {
            showToast("Select an accepted friend first.");
            return;
        }
        fileInput.click();
    });
    fileInput.addEventListener("change", function () {
        const file = fileInput.files[0];
        fileInput.value = "";
        if (file) {
            sendAttachment(file);
        }
    });
}
async function sendAttachment(file) {
    if (!activeUsername) {
        return;
    }
    if (!stompClient || !stompClient.connected) {
        showToast("Not connected to server yet.");
        return;
    }
    const baseType = (file.type || "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_UPLOAD_TYPES.has(baseType)) {
        showToast("Please choose a JPG, PNG, GIF, WEBP image, an MP4 / WEBM / MOV / OGG video or a voice message.");
        return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
        showToast("File is too large (max 25 MB).");
        return;
    }
    const receiver = activeUsername;
    const isVoice = file.type.startsWith("audio/");
    const caption = !isVoice && messageInput ? messageInput.value.trim() : "";
    attachButton.disabled = true;
    sendButton.disabled = true;
    attachButton.classList.add("busy");
    if (micButton) {
        micButton.disabled = true;
    }
    try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch(`${API_BASE}/api/files`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` },
            body: formData,
        });
        let data = {};
        try {
            data = await response.json();
        } catch (e) {}
        if (!response.ok) {
            console.error("Upload failed:", response.status, data);
            let reason = data.error || "Upload failed (error " + response.status + ")";
            if (response.status === 401 || response.status === 403) {
                reason = "Your login has expired - please log in again.";
            } else if (isVoice && response.status === 400) {
                reason += " - restart the backend with the updated FileController.java.";
            }
            showToast(reason, 7000);
            return;
        }
        stompClient.publish({
            destination: "/app/chat.send",
            body: JSON.stringify({ receiverUsername: receiver, content: caption, attachment: data.name }),
        });
        if (messageInput && !isVoice) {
            messageInput.value = "";
            updateComposer();
        }
    } catch (error) {
        console.error(error);
        showToast("Could not reach the server. Is the backend running?", 6000);
    } finally {
        attachButton.disabled = false;
        sendButton.disabled = false;
        attachButton.classList.remove("busy");
        if (micButton) {
            micButton.disabled = false;
        }
    }
}
const micButton = document.getElementById("micButton");
const messageBar = document.getElementById("messageBar");
const recTimer = document.getElementById("recTimer");
const recCancel = document.getElementById("recCancel");
const recSend = document.getElementById("recSend");
function updateComposer() {
    const hasText = !!messageInput && messageInput.value.trim() !== "";
    if (sendButton) {
        sendButton.hidden = !hasText;
    }
    if (micButton) {
        micButton.hidden = hasText;
    }
}
if (messageInput) {
    messageInput.addEventListener("input", updateComposer);
}
updateComposer();
const MAX_VOICE_SECONDS = 300;
let recorder = null;
let recStream = null;
let recChunks = [];
let recStartedAt = 0;
let recInterval = null;
let recDiscard = false;
function pickVoiceType() {
    const options = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/webm"];
    for (const type of options) {
        if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) {
            return type;
        }
    }
    return "";
}
function releaseMic() {
    if (recStream) {
        recStream.getTracks().forEach(function (track) {
            track.stop();
        });
        recStream = null;
    }
}
async function startRecording() {
    if (recorder) {
        return;
    }
    if (!activeUsername) {
        showToast("Select an accepted friend first.");
        return;
    }
    if (!stompClient || !stompClient.connected) {
        showToast("Not connected to server yet.");
        return;
    }
    if (window.isSecureContext === false) {
        showToast(
            "The microphone is blocked on " +
                location.origin +
                " because it is not https. Open the page with http://localhost:... " +
                "or use https.",
            8000,
        );
        return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
        showToast("This browser can't record voice messages. Try the latest Chrome, Edge, Firefox or Safari.", 6000);
        return;
    }
    try {
        recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
        console.error("Microphone error:", error);
        let reason = "Could not open the microphone.";
        if (error && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
            reason =
                "Microphone is blocked. Click the lock icon in the address bar, " +
                "allow the microphone, then tap the mic again.";
        } else if (error && (error.name === "NotFoundError" || error.name === "OverconstrainedError")) {
            reason = "No microphone was found on this device.";
        } else if (error && error.name === "NotReadableError") {
            reason = "The microphone is being used by another app. Close it and try again.";
        }
        showToast(reason, 8000);
        return;
    }
    const mimeType = pickVoiceType();
    try {
        recorder = mimeType ? new MediaRecorder(recStream, { mimeType }) : new MediaRecorder(recStream);
    } catch (error) {
        releaseMic();
        recorder = null;
        console.error("MediaRecorder error:", error);
        showToast("Could not start recording in this browser", 6000);
        return;
    }
    recChunks = [];
    recDiscard = false;
    recorder.addEventListener("dataavailable", function (event) {
        if (event.data && event.data.size > 0) {
            recChunks.push(event.data);
        }
    });
    recorder.addEventListener("stop", finishRecording);
    recorder.start();
    recStartedAt = Date.now();
    recTimer.textContent = "0:00";
    messageBar.classList.add("recording");
    recInterval = setInterval(function () {
        const seconds = (Date.now() - recStartedAt) / 1000;
        recTimer.textContent = formatClock(seconds);
        if (seconds >= MAX_VOICE_SECONDS) {
            stopRecording(false);
        }
    }, 250);
}
function stopRecording(discard) {
    if (!recorder) {
        return;
    }
    recDiscard = !!discard;
    if (recorder.state !== "inactive") {
        recorder.stop();
    }
}
function cancelRecording() {
    if (recorder) {
        stopRecording(true);
    }
}
function finishRecording() {
    clearInterval(recInterval);
    recInterval = null;
    const seconds = (Date.now() - recStartedAt) / 1000;
    const type = (recorder && recorder.mimeType) || "audio/webm";
    const discard = recDiscard;
    const chunks = recChunks;
    recChunks = [];
    releaseMic();
    recorder = null;
    messageBar.classList.remove("recording");
    if (discard) {
        return;
    }
    if (seconds < 1) {
        showToast("Recording too short - tap the microphone and speak for a moment.");
        return;
    }
    const baseType = type.split(";")[0] || "audio/webm";
    const extension = baseType.includes("ogg") ? "ogg" : baseType.includes("mp4") ? "m4a" : "webm";
    const file = new File(chunks, "voice." + extension, { type: baseType });
    sendAttachment(file);
}
if (micButton) {
    micButton.addEventListener("click", startRecording);
}
if (recCancel) {
    recCancel.addEventListener("click", function () {
        stopRecording(true);
    });
}
if (recSend) {
    recSend.addEventListener("click", function () {
        stopRecording(false);
    });
}
document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        cancelRecording();
    }
});
window.addEventListener("pagehide", releaseMic);
function connectWebSocket() {
    stompClient = new StompJs.Client({
        webSocketFactory: () => new SockJS(WS_URL),
        connectHeaders: { Authorization: `Bearer ${token}` },
        reconnectDelay: 5000,
        onConnect: function () {
            console.log("WebSocket connected");
            stompClient.subscribe("/user/queue/messages", onMessageReceived);
            stompClient.subscribe("/user/queue/presence", function (frame) {
                try {
                    applyPresence(JSON.parse(frame.body));
                } catch (e) {}
            });
            stompClient.subscribe("/user/queue/receipts", onReceipt);
            stompClient.subscribe("/user/queue/deletions", onDeletion);
            stompClient.subscribe("/user/queue/errors", function (frame) {
                let reason = "Message could not be sent";
                try {
                    reason = JSON.parse(frame.body).error || reason;
                } catch (e) {}
                console.error("Send failed:", reason);
                showToast(reason);
            });
        },
        onStompError: function (frame) {
            console.error("STOMP error:", frame.headers["message"], frame.body);
            const m = (frame.headers["message"] || "").toLowerCase();
            if (m.includes("token") || m.includes("authorization")) {
                localStorage.removeItem("token");
                window.location.href = "login.html";
            }
        },
        onWebSocketError: function (error) {
            console.error("WebSocket error:", error);
        },
    });
    stompClient.activate();
}
function onMessageReceived(frame) {
    const msg = JSON.parse(frame.body);
    const belongsToOpenChat =
        activeUsername && (msg.senderUsername === activeUsername || msg.receiverUsername === activeUsername);
    if (belongsToOpenChat) {
        renderMessage(msg);
        scrollToBottom();
        if (msg.senderUsername === activeUsername) {
            markConversationRead(activeUsername);
        }
    }
}
function closeChatDropdown() {
    if (chatDropdown) {
        chatDropdown.classList.remove("show");
    }
}
if (chatMenuButton && chatDropdown) {
    chatMenuButton.addEventListener("click", function (event) {
        event.stopPropagation();
        chatDropdown.classList.toggle("show");
    });
}
document.addEventListener("click", function () {
    closeChatDropdown();
    if (dropdownMenu) {
        dropdownMenu.classList.remove("show");
    }
});
function resetChatArea() {
    cancelRecording();
    activeUsername = null;
    activeDisplayName = null;
    activeProfilePicture = null;
    if (chatHeaderName) {
        chatHeaderName.textContent = "Select a chat";
    }
    if (chatHeaderStatus) {
        chatHeaderStatus.textContent = "";
        const headerBar = document.querySelector(".chat-header");
        if (headerBar) {
            headerBar.classList.remove("is-online");
        }
    }
    updateChatHeaderImage(DEFAULT_PROFILE_IMAGE);
    if (messagesContainer) {
        messagesContainer.innerHTML = "";
    }
    if (chatMenu) {
        chatMenu.style.display = "none";
    }
    if (chatContainer) {
        chatContainer.classList.remove("chat-selected");
    }
    if (history.state && history.state.chatOpen) {
        history.back();
    } else {
        hideChatPanel();
    }
    closeChatDropdown();
}
async function apiRequest(path, method) {
    const response = await fetch(`${API_BASE}${path}`, {
        method: method,
        headers: { "Authorization": `Bearer ${token}` },
    });
    let data = {};
    try {
        data = await response.json();
    } catch (e) {}
    return { ok: response.ok, data: data };
}
async function deleteChat(targetUsername, targetDisplayName) {
    const username = targetUsername || activeUsername;
    const name = targetDisplayName || (username === activeUsername ? activeDisplayName : null) || username;
    if (!username) {
        return;
    }
    if (!confirm(`Delete your chat with ${name}?\n\n` + "Messages will be removed for you only.")) {
        return;
    }
    try {
        const result = await apiRequest(`/api/messages/${encodeURIComponent(username)}`, "DELETE");
        if (!result.ok) {
            showToast(result.data.error || "Could not delete chat");
            return;
        }
        if (username === activeUsername && messagesContainer) {
            messagesContainer.innerHTML = "";
        }
        showToast("Chat deleted");
    } catch (error) {
        console.error(error);
        showToast("Could not reach server");
    }
}
async function removeFriend(targetUsername, targetDisplayName) {
    const username = targetUsername || activeUsername;
    const name = targetDisplayName || (username === activeUsername ? activeDisplayName : null) || username;
    if (!username) {
        return;
    }
    if (!confirm(`Remove ${name} from your friends?`)) {
        return;
    }
    try {
        const result = await apiRequest(`/api/friends/${encodeURIComponent(username)}`, "DELETE");
        if (!result.ok) {
            showToast(result.data.error || "Could not remove friend");
            return;
        }
        if (username === activeUsername) {
            resetChatArea();
        }
        setActiveTab("chats");
        refreshSidebarList();
        showToast(`${name} removed from friends`);
    } catch (error) {
        console.error(error);
        showToast("Could not reach server");
    }
}
async function blockUser(targetUsername, targetDisplayName) {
    const username = targetUsername || activeUsername;
    const name = targetDisplayName || (username === activeUsername ? activeDisplayName : null) || username;
    if (!username) {
        return;
    }
    if (
        !confirm(
            `Block ${name}?\n\n` +
                "They will be removed from your friends and won't be able to " +
                "message you or send you friend requests.",
        )
    ) {
        return;
    }
    try {
        const result = await apiRequest(`/api/blocks/${encodeURIComponent(username)}`, "POST");
        if (!result.ok) {
            showToast(result.data.error || "Could not block user");
            return;
        }
        if (username === activeUsername) {
            resetChatArea();
        }
        setActiveTab("chats");
        refreshSidebarList();
        showToast(`${name} blocked`);
    } catch (error) {
        console.error(error);
        showToast("Could not reach server");
    }
}
let listMenuTarget = null;
const listMenu = document.createElement("div");
listMenu.className = "dropdown-menu list-menu";
listMenu.setAttribute("role", "menu");
listMenu.innerHTML = `
    <div class="list-menu-title" id="listMenuTitle"></div>
    <a href="#" data-action="profile" role="menuitem">
        <span class="mi">&#128100;</span>View profile
    </a>
    <a href="#" data-action="delete" role="menuitem">
        <span class="mi">&#128465;</span>Delete chat
    </a>
    <a href="#" data-action="remove" role="menuitem">
        <span class="mi">&#128100;</span>Remove friend
    </a>
    <a href="#" data-action="block" role="menuitem" class="danger">
        <span class="mi">&#128683;</span>Block user
    </a>
`;
document.body.appendChild(listMenu);
function closeListMenu() {
    listMenu.classList.remove("show");
    listMenuTarget = null;
}
function openListMenu(friend, x, y) {
    listMenuTarget = friend;
    document.getElementById("listMenuTitle").textContent = friend.displayName || friend.username;
    listMenu.classList.add("show");
    const width = listMenu.offsetWidth;
    const height = listMenu.offsetHeight;
    listMenu.style.left = Math.max(8, Math.min(x, window.innerWidth - width - 8)) + "px";
    listMenu.style.top = Math.max(8, Math.min(y, window.innerHeight - height - 8)) + "px";
}
listMenu.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    const link = event.target.closest("a[data-action]");
    if (!link || !listMenuTarget) {
        return;
    }
    const friend = listMenuTarget;
    const name = friend.displayName || friend.username;
    closeListMenu();
    if (link.dataset.action === "profile") {
        openProfile(friend.username, friend.displayName, friend.picture);
    } else if (link.dataset.action === "delete") {
        deleteChat(friend.username, name);
    } else if (link.dataset.action === "remove") {
        removeFriend(friend.username, name);
    } else if (link.dataset.action === "block") {
        blockUser(friend.username, name);
    }
});
function attachFriendMenu(item, friend) {
    let holdTimer = null;
    let startX = 0;
    let startY = 0;
    let heldOpen = false;
    function cancelHold() {
        clearTimeout(holdTimer);
        holdTimer = null;
    }
    item.addEventListener("contextmenu", function (event) {
        event.preventDefault();
        openListMenu(friend, event.clientX, event.clientY);
    });
    item.addEventListener("pointerdown", function (event) {
        if (event.pointerType === "mouse") {
            return;
        }
        heldOpen = false;
        startX = event.clientX;
        startY = event.clientY;
        cancelHold();
        holdTimer = setTimeout(function () {
            heldOpen = true;
            if (navigator.vibrate) {
                navigator.vibrate(15);
            }
            openListMenu(friend, startX - 20, startY + 28);
        }, 450);
    });
    item.addEventListener("pointermove", function (event) {
        if (Math.abs(event.clientX - startX) > 10 || Math.abs(event.clientY - startY) > 10) {
            cancelHold();
        }
    });
    item.addEventListener("pointerup", cancelHold);
    item.addEventListener("pointercancel", cancelHold);
    item.addEventListener("pointerleave", cancelHold);
    item.addEventListener("click", function (event) {
        if (heldOpen) {
            heldOpen = false;
            event.stopImmediatePropagation();
            event.preventDefault();
        }
    });
}
document.addEventListener("click", closeListMenu);
document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        closeListMenu();
    }
});
window.addEventListener("resize", closeListMenu);
if (chatList) {
    chatList.addEventListener("scroll", closeListMenu);
}
let toastTimer = null;
function showToast(message, duration) {
    let toast = document.getElementById("toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        toast.setAttribute("role", "status");
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
        toast.classList.remove("show");
    }, duration || 2600);
}
const welcomeName = document.getElementById("welcomeName");
const welcomeGreeting = document.getElementById("welcomeGreeting");
const welcomeFind = document.getElementById("welcomeFind");
const welcomeRequests = document.getElementById("welcomeRequests");
(function setupWelcome() {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    if (welcomeGreeting) {
        welcomeGreeting.textContent = greeting + ",";
    }
    if (welcomeName) {
        welcomeName.textContent = currentDisplayName || currentUsername;
    }
    if (welcomeFind && searchInput) {
        welcomeFind.addEventListener("click", function () {
            searchInput.focus();
        });
    }
    if (welcomeRequests && requestsTab) {
        welcomeRequests.addEventListener("click", function () {
            requestsTab.click();
        });
    }
})();
const chatContainer = document.getElementById("chatContainer");
const backButton = document.getElementById("backButton");
function showChatPanel() {
    if (!chatContainer) {
        return;
    }
    chatContainer.classList.add("chat-selected");
    if (chatContainer.classList.contains("chat-open")) {
        return;
    }
    chatContainer.classList.add("chat-open");
    if (window.matchMedia("(max-width: 768px)").matches && !(history.state && history.state.chatOpen)) {
        history.pushState({ chatOpen: true }, "");
    }
}
function hideChatPanel() {
    if (chatContainer) {
        chatContainer.classList.remove("chat-open");
    }
}
if (backButton) {
    backButton.addEventListener("click", function () {
        if (history.state && history.state.chatOpen) {
            history.back();
        } else {
            hideChatPanel();
        }
    });
}
window.addEventListener("popstate", function () {
    hideChatPanel();
});
async function unblockUser(username) {
    try {
        const result = await apiRequest(`/api/blocks/${encodeURIComponent(username)}`, "DELETE");
        if (!result.ok) {
            showToast(result.data.error || "Could not unblock user");
            return;
        }
        loadBlockedUsers();
    } catch (error) {
        console.error(error);
        showToast("Could not reach server");
    }
}
if (deleteChatLink) {
    deleteChatLink.addEventListener("click", function (event) {
        event.preventDefault();
        closeChatDropdown();
        deleteChat();
    });
}
if (removeFriendLink) {
    removeFriendLink.addEventListener("click", function (event) {
        event.preventDefault();
        closeChatDropdown();
        removeFriend();
    });
}
if (blockUserLink) {
    blockUserLink.addEventListener("click", function (event) {
        event.preventDefault();
        closeChatDropdown();
        blockUser();
    });
}
async function loadBlockedUsers() {
    try {
        const result = await apiRequest("/api/blocks", "GET");
        if (!result.ok) {
            console.error("Failed to load blocked users");
            return;
        }
        renderBlockedUsers(result.data);
    } catch (error) {
        console.error(error);
    }
}
function renderBlockedUsers(users) {
    if (!chatList) {
        return;
    }
    chatList.innerHTML = "";
    if (!users || users.length === 0) {
        chatList.innerHTML = `
            <p class="list-empty">
                You haven't blocked anyone.
            </p>
        `;
        return;
    }
    users.forEach(function (user) {
        const item = document.createElement("div");
        item.classList.add("chat-user");
        const picture = user.picture && user.picture.trim() !== "" ? user.picture : DEFAULT_PROFILE_IMAGE;
        item.innerHTML = `

                <div class="profile-image">
                    <img
                        src="${escapeHtml(picture)}"
                        alt="profile">
                </div>

                <div class="user-info">

                    <h3>
                        ${escapeHtml(user.displayName || user.username)}
                    </h3>

                    <button
                        type="button"
                        class="blocked-unblock-btn">
                        Unblock
                    </button>

                </div>
            `;
        const image = item.querySelector("img");
        if (image) {
            image.onerror = function () {
                this.onerror = null;
                this.src = DEFAULT_PROFILE_IMAGE;
            };
        }
        item.querySelector(".blocked-unblock-btn").addEventListener("click", function () {
            unblockUser(user.username);
        });
        chatList.appendChild(item);
    });
}
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text == null ? "" : text;
    return div.innerHTML;
}
loadCurrentUserProfile();
loadFriends();
connectWebSocket();
