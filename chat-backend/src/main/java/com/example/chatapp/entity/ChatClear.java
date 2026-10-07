package com.example.chatapp.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "chat_clears", uniqueConstraints = @UniqueConstraint(columnNames = { "user_id", "other_user_id" }))
public class ChatClear {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "other_user_id", nullable = false)
    private User otherUser;

    @Column(nullable = false)
    private Instant clearedAt;

    public ChatClear() {}

    public ChatClear(User user, User otherUser, Instant clearedAt) {
        this.user = user;
        this.otherUser = otherUser;
        this.clearedAt = clearedAt;
    }

    public Long getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public User getOtherUser() {
        return otherUser;
    }

    public Instant getClearedAt() {
        return clearedAt;
    }

    public void setClearedAt(Instant clearedAt) {
        this.clearedAt = clearedAt;
    }
}
