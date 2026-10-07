package com.example.chatapp.controller;

import com.example.chatapp.entity.FriendRequest;
import com.example.chatapp.entity.RequestStatus;
import com.example.chatapp.entity.User;
import com.example.chatapp.repository.BlockedUserRepository;
import com.example.chatapp.repository.FriendRequestRepository;
import com.example.chatapp.repository.UserRepository;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/friend-requests")
@RequiredArgsConstructor
public class FriendRequestController {

    private final FriendRequestRepository friendRequestRepository;
    private final UserRepository userRepository;
    private final BlockedUserRepository blockedUserRepository;

    @PostMapping("/{username}")
    public ResponseEntity<?> sendFriendRequest(@PathVariable String username, Authentication authentication) {
        String currentUsername = authentication.getName();
        if (currentUsername.equals(username)) {
            return ResponseEntity.badRequest().body(Map.of("error", "You cannot add yourself"));
        }
        User sender = userRepository
            .findByUsername(currentUsername)
            .orElseThrow(() -> new IllegalArgumentException("Sender not found"));
        User receiver = userRepository
            .findByUsername(username)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (blockedUserRepository.existsByBlockerAndBlocked(sender, receiver)) {
            return ResponseEntity.badRequest().body(Map.of("error", "You have blocked this user. Unblock them first"));
        }
        if (blockedUserRepository.existsByBlockerAndBlocked(receiver, sender)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Unable to send a friend request to this user"));
        }
        var existingRequest = friendRequestRepository.findBySenderAndReceiver(sender, receiver);
        if (existingRequest.isPresent()) {
            FriendRequest request = existingRequest.get();
            if (request.getStatus() == RequestStatus.PENDING) {
                return ResponseEntity.badRequest().body(Map.of("error", "Friend request already sent"));
            }
            if (request.getStatus() == RequestStatus.ACCEPTED) {
                return ResponseEntity.badRequest().body(Map.of("error", "You are already friends"));
            }
            request.setStatus(RequestStatus.PENDING);
            friendRequestRepository.save(request);
            return ResponseEntity.ok(Map.of("message", "Friend request sent"));
        }
        var reverseRequest = friendRequestRepository.findBySenderAndReceiver(receiver, sender);
        if (reverseRequest.isPresent()) {
            FriendRequest request = reverseRequest.get();
            if (request.getStatus() == RequestStatus.PENDING) {
                return ResponseEntity.badRequest().body(
                    Map.of("error", "This user has already sent you a friend request")
                );
            }
            if (request.getStatus() == RequestStatus.ACCEPTED) {
                return ResponseEntity.badRequest().body(Map.of("error", "You are already friends"));
            }
        }
        FriendRequest friendRequest = new FriendRequest(sender, receiver, RequestStatus.PENDING);
        friendRequestRepository.save(friendRequest);
        return ResponseEntity.ok(Map.of("message", "Friend request sent"));
    }

    @GetMapping({ "", "/received" })
    public List<Map<String, Object>> getReceivedRequests(Authentication authentication) {
        String username = authentication.getName();
        User currentUser = userRepository
            .findByUsername(username)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return friendRequestRepository
            .findByReceiverAndStatus(currentUser, RequestStatus.PENDING)
            .stream()
            .map(request ->
                Map.<String, Object>of(
                    "id",
                    request.getId(),
                    "username",
                    request.getSender().getUsername(),
                    "senderUsername",
                    request.getSender().getUsername(),
                    "displayName",
                    request.getSender().getDisplayName() == null ? "" : request.getSender().getDisplayName(),
                    "senderDisplayName",
                    request.getSender().getDisplayName() == null ? "" : request.getSender().getDisplayName(),
                    "senderPicture",
                    request.getSender().getPicture() == null ? "" : request.getSender().getPicture()
                )
            )
            .toList();
    }

    @PutMapping("/{id}/accept")
    public ResponseEntity<?> acceptRequest(@PathVariable Long id, Authentication authentication) {
        String username = authentication.getName();
        User currentUser = userRepository
            .findByUsername(username)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
        FriendRequest request = friendRequestRepository
            .findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Friend request not found"));
        if (!request.getReceiver().getId().equals(currentUser.getId())) {
            return ResponseEntity.status(403).body(Map.of("error", "Not your friend request"));
        }
        if (request.getStatus() != RequestStatus.PENDING) {
            return ResponseEntity.badRequest().body(Map.of("error", "Request already processed"));
        }
        request.setStatus(RequestStatus.ACCEPTED);
        friendRequestRepository.save(request);
        return ResponseEntity.ok(Map.of("message", "Friend request accepted"));
    }

    @PutMapping("/{id}/reject")
    public ResponseEntity<?> rejectRequest(@PathVariable Long id, Authentication authentication) {
        String username = authentication.getName();
        User currentUser = userRepository
            .findByUsername(username)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
        FriendRequest request = friendRequestRepository
            .findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Friend request not found"));
        if (!request.getReceiver().getId().equals(currentUser.getId())) {
            return ResponseEntity.status(403).body(Map.of("error", "Not your friend request"));
        }
        request.setStatus(RequestStatus.REJECTED);
        friendRequestRepository.save(request);
        return ResponseEntity.ok(Map.of("message", "Friend request rejected"));
    }
}
