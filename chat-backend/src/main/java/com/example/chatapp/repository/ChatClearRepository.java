package com.example.chatapp.repository;

import com.example.chatapp.entity.ChatClear;
import com.example.chatapp.entity.User;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatClearRepository extends JpaRepository<ChatClear, Long> {
    Optional<ChatClear> findByUserAndOtherUser(User user, User otherUser);
}
