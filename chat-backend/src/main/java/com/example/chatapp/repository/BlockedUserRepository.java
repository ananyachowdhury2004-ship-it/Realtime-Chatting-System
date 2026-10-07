package com.example.chatapp.repository;

import com.example.chatapp.entity.BlockedUser;
import com.example.chatapp.entity.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BlockedUserRepository extends JpaRepository<BlockedUser, Long> {
    Optional<BlockedUser> findByBlockerAndBlocked(User blocker, User blocked);
    boolean existsByBlockerAndBlocked(User blocker, User blocked);
    List<BlockedUser> findByBlocker(User blocker);
}
