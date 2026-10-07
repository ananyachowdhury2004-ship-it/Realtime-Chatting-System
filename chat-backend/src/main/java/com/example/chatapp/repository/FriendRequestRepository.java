package com.example.chatapp.repository;

import com.example.chatapp.entity.FriendRequest;
import com.example.chatapp.entity.RequestStatus;
import com.example.chatapp.entity.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FriendRequestRepository extends JpaRepository<FriendRequest, Long> {
    Optional<FriendRequest> findBySenderAndReceiver(User sender, User receiver);
    List<FriendRequest> findByReceiverAndStatus(User receiver, RequestStatus status);
    List<FriendRequest> findBySenderAndStatus(User sender, RequestStatus status);
    List<FriendRequest> findByStatus(RequestStatus status);

    @Query(
        "SELECT f FROM FriendRequest f WHERE (f.sender = :a AND f.receiver = :b) OR (f.sender = :b AND f.receiver = :a)"
    )
    List<FriendRequest> findBetween(@Param("a") User a, @Param("b") User b);
}
