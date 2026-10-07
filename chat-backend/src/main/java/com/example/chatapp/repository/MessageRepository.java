package com.example.chatapp.repository;

import com.example.chatapp.entity.Message;
import com.example.chatapp.entity.User;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MessageRepository extends JpaRepository<Message, Long> {
    @Query(
        """
        SELECT m
        FROM Message m
        WHERE
            (m.sender.id = :user1Id
             AND m.receiver.id = :user2Id)
        OR
            (m.sender.id = :user2Id
             AND m.receiver.id = :user1Id)
        ORDER BY m.timestamp ASC
        """
    )
    List<Message> findConversation(@Param("user1Id") Long user1Id, @Param("user2Id") Long user2Id);

    List<Message> findByReceiverAndDeliveredAtIsNull(User receiver);
    List<Message> findByReceiverAndSenderAndReadAtIsNull(User receiver, User sender);
}
