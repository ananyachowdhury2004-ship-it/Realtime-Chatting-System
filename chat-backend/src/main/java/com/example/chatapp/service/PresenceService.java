package com.example.chatapp.service;

import com.example.chatapp.entity.FriendRequest;
import com.example.chatapp.entity.Message;
import com.example.chatapp.entity.PresenceMode;
import com.example.chatapp.entity.RequestStatus;
import com.example.chatapp.entity.User;
import com.example.chatapp.repository.BlockedUserRepository;
import com.example.chatapp.repository.FriendRequestRepository;
import com.example.chatapp.repository.MessageRepository;
import com.example.chatapp.repository.UserRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@RequiredArgsConstructor
public class PresenceService {

    private final UserRepository userRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final BlockedUserRepository blockedUserRepository;
    private final MessageRepository messageRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final Map<String, Set<String>> sessions = new ConcurrentHashMap<>();

    @EventListener(ApplicationReadyEvent.class)
    public void resetOnlineFlagsOnStartup() {
        Instant now = Instant.now();
        for (User user : userRepository.findAll()) {
            if (user.isOnline()) {
                user.setOnline(false);
                if (user.getLastSeen() == null) {
                    user.setLastSeen(now);
                }
                userRepository.save(user);
            }
        }
    }

    public boolean isOnline(String username) {
        Set<String> open = sessions.get(username);
        return open != null && !open.isEmpty();
    }

    public synchronized void connected(String username, String sessionId) {
        Set<String> open = sessions.computeIfAbsent(username, k -> ConcurrentHashMap.newKeySet());
        boolean firstSession = open.isEmpty();
        open.add(sessionId);
        if (!firstSession) {
            return;
        }
        userRepository.findByUsername(username).ifPresent(user -> {
            user.setOnline(true);
            userRepository.save(user);
            publishPresence(user);
            markDelivered(user);
        });
    }

    public synchronized void disconnected(String username, String sessionId) {
        Set<String> open = sessions.get(username);
        if (open == null) {
            return;
        }
        open.remove(sessionId);
        if (!open.isEmpty()) {
            return;
        }
        sessions.remove(username);
        userRepository.findByUsername(username).ifPresent(user -> {
            user.setOnline(false);
            user.setLastSeen(Instant.now());
            userRepository.save(user);
            publishPresence(user);
        });
    }

    public Map<String, Object> viewOf(User user) {
        PresenceMode mode = user.effectivePresenceMode();
        Map<String, Object> view = new HashMap<>();
        view.put("username", user.getUsername());
        view.put("presenceMode", mode.name());
        view.put("online", mode != PresenceMode.NOTHING && user.isOnline());
        view.put(
            "lastSeen",
            mode == PresenceMode.LAST_SEEN && !user.isOnline() && user.getLastSeen() != null
                ? user.getLastSeen().toString()
                : null
        );
        return view;
    }

    public void publishPresence(String username) {
        userRepository.findByUsername(username).ifPresent(this::publishPresence);
    }

    private void publishPresence(User user) {
        Map<String, Object> view = viewOf(user);
        for (User friend : friendsOf(user)) {
            messagingTemplate.convertAndSendToUser(friend.getUsername(), "/queue/presence", view);
        }
    }

    private List<User> friendsOf(User user) {
        List<User> friends = new ArrayList<>();
        for (FriendRequest r : friendRequestRepository.findBySenderAndStatus(user, RequestStatus.ACCEPTED)) {
            friends.add(r.getReceiver());
        }
        for (FriendRequest r : friendRequestRepository.findByReceiverAndStatus(user, RequestStatus.ACCEPTED)) {
            friends.add(r.getSender());
        }
        friends.removeIf(
            f ->
                blockedUserRepository.existsByBlockerAndBlocked(user, f) ||
                blockedUserRepository.existsByBlockerAndBlocked(f, user)
        );
        return friends;
    }

    private void markDelivered(User receiver) {
        List<Message> waiting = messageRepository.findByReceiverAndDeliveredAtIsNull(receiver);
        if (waiting.isEmpty()) {
            return;
        }
        Instant now = Instant.now();
        Set<String> senders = new LinkedHashSet<>();
        for (Message message : waiting) {
            message.setDeliveredAt(now);
            senders.add(message.getSender().getUsername());
        }
        messageRepository.saveAll(waiting);
        for (String sender : senders) {
            messagingTemplate.convertAndSendToUser(
                sender,
                "/queue/receipts",
                Map.of("peer", receiver.getUsername(), "status", "DELIVERED", "at", now.toString())
            );
        }
    }
}
