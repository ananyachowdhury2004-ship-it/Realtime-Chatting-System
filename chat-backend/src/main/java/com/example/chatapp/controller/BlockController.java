package com.example.chatapp.controller;

import com.example.chatapp.service.FriendshipService;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/blocks")
@RequiredArgsConstructor
public class BlockController {

    private final FriendshipService friendshipService;

    @GetMapping
    public List<Map<String, Object>> getBlockedUsers(Authentication authentication) {
        return friendshipService.getBlockedUsers(authentication.getName());
    }

    @PostMapping("/{username}")
    public ResponseEntity<?> block(@PathVariable String username, Authentication authentication) {
        friendshipService.block(authentication.getName(), username);
        return ResponseEntity.ok(Map.of("message", "User blocked"));
    }

    @DeleteMapping("/{username}")
    public ResponseEntity<?> unblock(@PathVariable String username, Authentication authentication) {
        friendshipService.unblock(authentication.getName(), username);
        return ResponseEntity.ok(Map.of("message", "User unblocked"));
    }
}
