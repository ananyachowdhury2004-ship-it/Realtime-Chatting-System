package com.example.chatapp.service;

import com.example.chatapp.entity.BlockedUser;
import com.example.chatapp.entity.ChatClear;
import com.example.chatapp.entity.FriendRequest;
import com.example.chatapp.entity.RequestStatus;
import com.example.chatapp.entity.User;
import com.example.chatapp.repository.BlockedUserRepository;
import com.example.chatapp.repository.ChatClearRepository;
import com.example.chatapp.repository.FriendRequestRepository;
import com.example.chatapp.repository.UserRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class FriendshipService {

    private final UserRepository userRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final BlockedUserRepository blockedUserRepository;
    private final ChatClearRepository chatClearRepository;

    public FriendshipService(
        UserRepository userRepository,
        FriendRequestRepository friendRequestRepository,
        BlockedUserRepository blockedUserRepository,
        ChatClearRepository chatClearRepository
    ) {
        this.userRepository = userRepository;
        this.friendRequestRepository = friendRequestRepository;
        this.blockedUserRepository = blockedUserRepository;
        this.chatClearRepository = chatClearRepository;
    }

    private User find(String username) {
        return userRepository
            .findByUsername(username)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    private User findOther(String me, String other) {
        if (me.equals(other)) {
            throw new IllegalArgumentException("You cannot do this to yourself");
        }
        return find(other);
    }

    @Transactional(readOnly = true)
    public boolean areFriends(User a, User b) {
        return friendRequestRepository
            .findBetween(a, b)
            .stream()
            .anyMatch(r -> r.getStatus() == RequestStatus.ACCEPTED);
    }

    @Transactional(readOnly = true)
    public boolean isBlockedEitherWay(User a, User b) {
        return (
            blockedUserRepository.existsByBlockerAndBlocked(a, b) ||
            blockedUserRepository.existsByBlockerAndBlocked(b, a)
        );
    }

    public void removeFriend(String me, String otherUsername) {
        User user = find(me);
        User other = findOther(me, otherUsername);
        List<FriendRequest> accepted = friendRequestRepository
            .findBetween(user, other)
            .stream()
            .filter(r -> r.getStatus() == RequestStatus.ACCEPTED)
            .toList();
        if (accepted.isEmpty()) {
            throw new IllegalArgumentException("You are not friends with this user");
        }
        friendRequestRepository.deleteAll(accepted);
    }

    public void block(String me, String otherUsername) {
        User user = find(me);
        User other = findOther(me, otherUsername);
        if (blockedUserRepository.existsByBlockerAndBlocked(user, other)) {
            throw new IllegalArgumentException("User is already blocked");
        }
        blockedUserRepository.save(new BlockedUser(user, other));
    }

    public void unblock(String me, String otherUsername) {
        User user = find(me);
        User other = findOther(me, otherUsername);
        BlockedUser block = blockedUserRepository
            .findByBlockerAndBlocked(user, other)
            .orElseThrow(() -> new IllegalArgumentException("User is not blocked"));
        blockedUserRepository.delete(block);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getBlockedUsers(String me) {
        User user = find(me);
        return blockedUserRepository
            .findByBlocker(user)
            .stream()
            .map(b ->
                Map.<String, Object>of(
                    "username",
                    b.getBlocked().getUsername(),
                    "displayName",
                    b.getBlocked().getDisplayName() == null ? "" : b.getBlocked().getDisplayName(),
                    "picture",
                    b.getBlocked().getPicture() == null ? "" : b.getBlocked().getPicture()
                )
            )
            .toList();
    }

    public void deleteChat(String me, String otherUsername) {
        User user = find(me);
        User other = findOther(me, otherUsername);
        ChatClear clear = chatClearRepository
            .findByUserAndOtherUser(user, other)
            .orElseGet(() -> new ChatClear(user, other, Instant.now()));
        clear.setClearedAt(Instant.now());
        chatClearRepository.save(clear);
    }
}
