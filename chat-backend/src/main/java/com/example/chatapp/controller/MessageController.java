package com.example.chatapp.controller;

import com.example.chatapp.dto.MessageHistoryDto;
import com.example.chatapp.service.FriendshipService;
import com.example.chatapp.service.MessageService;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;
    private final FriendshipService friendshipService;

    @GetMapping("/{otherUsername}")
    public List<MessageHistoryDto> getConversation(@PathVariable String otherUsername, Authentication authentication) {
        return messageService.getConversation(authentication.getName(), otherUsername);
    }

    @DeleteMapping("/{otherUsername}")
    public ResponseEntity<?> deleteChat(@PathVariable String otherUsername, Authentication authentication) {
        friendshipService.deleteChat(authentication.getName(), otherUsername);
        return ResponseEntity.ok(Map.of("message", "Chat deleted"));
    }

    @PostMapping("/{otherUsername}/read")
    public ResponseEntity<?> markRead(@PathVariable String otherUsername, Authentication authentication) {
        messageService.markConversationRead(authentication.getName(), otherUsername);
        return ResponseEntity.ok(Map.of("message", "Marked as read"));
    }

    @DeleteMapping("/by-id/{id}")
    public ResponseEntity<?> deleteMessage(
        @PathVariable Long id,
        @RequestParam(defaultValue = "me") String scope,
        Authentication authentication
    ) {
        messageService.deleteMessage(authentication.getName(), id, scope);
        return ResponseEntity.ok(Map.of("message", "Message deleted"));
    }
}
