package com.example.chatapp.controller;

import com.example.chatapp.entity.FriendRequest;
import com.example.chatapp.entity.PresenceMode;
import com.example.chatapp.entity.RequestStatus;
import com.example.chatapp.entity.User;
import com.example.chatapp.repository.BlockedUserRepository;
import com.example.chatapp.repository.FriendRequestRepository;
import com.example.chatapp.repository.UserRepository;
import com.example.chatapp.service.PresenceService;
import com.example.chatapp.util.FileSignature;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final BlockedUserRepository blockedUserRepository;
    private final PresenceService presenceService;

    @GetMapping("/search")
    public List<Map<String, Object>> searchUsers(@RequestParam String query, Authentication authentication) {
        String currentUsername = authentication.getName();
        User currentUser = userRepository
            .findByUsername(currentUsername)
            .orElseThrow(() -> new RuntimeException("User not found"));
        return userRepository
            .findAll()
            .stream()
            .filter(user -> !user.getUsername().equals(currentUsername))
            .filter(
                user ->
                    !blockedUserRepository.existsByBlockerAndBlocked(currentUser, user) &&
                    !blockedUserRepository.existsByBlockerAndBlocked(user, currentUser)
            )
            .filter(user -> {
                String username = user.getUsername() == null ? "" : user.getUsername().toLowerCase();
                String displayName = user.getDisplayName() == null ? "" : user.getDisplayName().toLowerCase();
                String search = query == null ? "" : query.toLowerCase();
                return username.contains(search) || displayName.contains(search);
            })
            .map(user -> {
                String status = "NONE";
                var request1 = friendRequestRepository.findBySenderAndReceiver(currentUser, user);
                var request2 = friendRequestRepository.findBySenderAndReceiver(user, currentUser);
                if (request1.isPresent()) {
                    status = request1.get().getStatus().name();
                }
                if (request2.isPresent()) {
                    status = request2.get().getStatus().name();
                }
                Map<String, Object> row = new HashMap<>();
                row.put("username", user.getUsername());
                row.put("displayName", user.getDisplayName() == null ? "" : user.getDisplayName());
                row.put("friendStatus", status);
                row.put("picture", user.getPicture() == null ? "" : user.getPicture());
                row.put("mobileHint", maskMobile(user.getMobile()));
                if ("ACCEPTED".equals(status)) {
                    row.putAll(presenceService.viewOf(user));
                } else {
                    row.put("online", false);
                    row.put("lastSeen", null);
                    row.put("presenceMode", PresenceMode.NOTHING.name());
                }
                return row;
            })
            .toList();
    }

    private static String maskMobile(String mobile) {
        if (mobile == null || mobile.length() < 4) {
            return "";
        }
        return "\u2022\u2022\u2022\u2022 " + mobile.substring(mobile.length() - 4);
    }

    @GetMapping("/friends")
    public List<Map<String, Object>> getFriends(Authentication authentication) {
        String currentUsername = authentication.getName();
        User currentUser = userRepository
            .findByUsername(currentUsername)
            .orElseThrow(() -> new RuntimeException("User not found"));
        List<FriendRequest> requests = friendRequestRepository.findByStatus(RequestStatus.ACCEPTED);
        return requests
            .stream()
            .filter(
                request ->
                    request.getSender().getId().equals(currentUser.getId()) ||
                    request.getReceiver().getId().equals(currentUser.getId())
            )
            .filter(request -> {
                User other = request.getSender().getId().equals(currentUser.getId())
                    ? request.getReceiver()
                    : request.getSender();
                return (
                    !blockedUserRepository.existsByBlockerAndBlocked(currentUser, other) &&
                    !blockedUserRepository.existsByBlockerAndBlocked(other, currentUser)
                );
            })
            .map(request -> {
                User friend;
                if (request.getSender().getId().equals(currentUser.getId())) {
                    friend = request.getReceiver();
                } else {
                    friend = request.getSender();
                }
                Map<String, Object> row = new HashMap<>();
                row.put("username", friend.getUsername());
                row.put("displayName", friend.getDisplayName() == null ? "" : friend.getDisplayName());
                row.put("picture", friend.getPicture() == null ? "" : friend.getPicture());
                row.put("mobileHint", maskMobile(friend.getMobile()));
                row.putAll(presenceService.viewOf(friend));
                return row;
            })
            .toList();
    }

    @GetMapping("/me")
    public Map<String, Object> getCurrentUser(Authentication authentication) {
        String currentUsername = authentication.getName();
        User user = userRepository
            .findByUsername(currentUsername)
            .orElseThrow(() -> new RuntimeException("User not found"));
        return Map.of(
            "id",
            user.getId(),
            "username",
            user.getUsername(),
            "displayName",
            user.getDisplayName() == null ? "" : user.getDisplayName(),
            "online",
            user.isOnline(),
            "picture",
            user.getPicture() == null ? "" : user.getPicture(),
            "mobile",
            user.getMobile() == null ? "" : user.getMobile(),
            "presenceMode",
            user.effectivePresenceMode().name()
        );
    }

    @GetMapping("/{username}/profile")
    public Map<String, Object> getProfile(@PathVariable String username, Authentication authentication) {
        User viewer = userRepository
            .findByUsername(authentication.getName())
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
        User target = userRepository
            .findByUsername(username)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
        boolean self = viewer.getId().equals(target.getId());
        if (
            !self &&
            (blockedUserRepository.existsByBlockerAndBlocked(viewer, target) ||
                blockedUserRepository.existsByBlockerAndBlocked(target, viewer))
        ) {
            throw new IllegalArgumentException("User not found");
        }
        String relation = "NONE";
        if (self) {
            relation = "SELF";
        } else {
            for (FriendRequest request : friendRequestRepository.findBetween(viewer, target)) {
                if (request.getStatus() == RequestStatus.ACCEPTED) {
                    relation = "FRIENDS";
                    break;
                }
                if (request.getStatus() == RequestStatus.PENDING) {
                    relation = "PENDING";
                }
            }
        }
        Map<String, Object> profile = new HashMap<>();
        profile.put("id", target.getId());
        profile.put("username", target.getUsername());
        profile.put("displayName", target.getDisplayName() == null ? "" : target.getDisplayName());
        profile.put("picture", target.getPicture() == null ? "" : target.getPicture());
        profile.put(
            "mobileHint",
            self ? (target.getMobile() == null ? "" : target.getMobile()) : maskMobile(target.getMobile())
        );
        profile.put("memberSince", target.getCreatedAt() == null ? null : target.getCreatedAt().toString());
        profile.put("relation", relation);
        if (self || "FRIENDS".equals(relation)) {
            profile.putAll(presenceService.viewOf(target));
        } else {
            profile.put("online", false);
            profile.put("lastSeen", null);
            profile.put("presenceMode", PresenceMode.NOTHING.name());
        }
        return profile;
    }

    @PutMapping("/privacy")
    public Map<String, Object> updatePrivacy(@RequestBody Map<String, String> request, Authentication authentication) {
        User user = userRepository
            .findByUsername(authentication.getName())
            .orElseThrow(() -> new RuntimeException("User not found"));
        String raw = request.get("presenceMode");
        PresenceMode mode;
        try {
            mode = PresenceMode.valueOf(raw == null ? "" : raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Choose Last seen, Online / offline or Nothing");
        }
        user.setPresenceMode(mode);
        userRepository.save(user);
        presenceService.publishPresence(user.getUsername());
        return Map.of("presenceMode", mode.name());
    }

    @PutMapping("/profile-picture")
    public Map<String, Object> updateProfilePicture(
        @RequestBody Map<String, String> request,
        Authentication authentication
    ) {
        String currentUsername = authentication.getName();
        User user = userRepository
            .findByUsername(currentUsername)
            .orElseThrow(() -> new RuntimeException("User not found"));
        String picture = request.get("picture");
        if (picture == null || picture.isBlank()) {
            user.setPicture(null);
        } else {
            FileSignature.validateProfilePicture(picture);
            user.setPicture(picture);
        }
        userRepository.save(user);
        return Map.of(
            "message",
            picture == null || picture.isBlank()
                ? "Profile picture removed successfully"
                : "Profile picture updated successfully",
            "picture",
            user.getPicture() == null ? "" : user.getPicture()
        );
    }
}
