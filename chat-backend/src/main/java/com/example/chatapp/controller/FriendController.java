package com.example.chatapp.controller;

import com.example.chatapp.service.FriendshipService;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/friends")
@RequiredArgsConstructor
public class FriendController {

    private final FriendshipService friendshipService;

    @DeleteMapping("/{username}")
    public ResponseEntity<?> removeFriend(@PathVariable String username, Authentication authentication) {
        friendshipService.removeFriend(authentication.getName(), username);
        return ResponseEntity.ok(Map.of("message", "Friend removed"));
    }
}
