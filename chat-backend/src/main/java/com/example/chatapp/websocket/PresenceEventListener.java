package com.example.chatapp.websocket;

import com.example.chatapp.service.PresenceService;
import java.security.Principal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

@Slf4j
@Component
@RequiredArgsConstructor
public class PresenceEventListener {

    private final PresenceService presenceService;

    @EventListener
    public void handleConnect(SessionConnectedEvent event) {
        Principal user = event.getUser();
        if (user == null) return;
        String sessionId = StompHeaderAccessor.wrap(event.getMessage()).getSessionId();
        presenceService.connected(user.getName(), sessionId);
        log.info("User connected: {}", user.getName());
    }

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        Principal user = event.getUser();
        if (user == null) return;
        presenceService.disconnected(user.getName(), event.getSessionId());
        log.info("User disconnected: {}", user.getName());
    }
}
