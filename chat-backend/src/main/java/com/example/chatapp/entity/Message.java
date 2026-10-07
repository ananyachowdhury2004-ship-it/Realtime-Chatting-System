package com.example.chatapp.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "messages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id", nullable = false)
    private User sender;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "receiver_id", nullable = false)
    private User receiver;

    @Lob
    @Column(name = "content", columnDefinition = "LONGTEXT", nullable = false)
    private String content;

    @Column(name = "attachment_name")
    private String attachmentName;

    @Column(name = "attachment_type", length = 10)
    private String attachmentType;

    @Builder.Default
    @Column(nullable = false)
    private Instant timestamp = Instant.now();

    @Column(name = "delivered_at")
    private Instant deliveredAt;

    @Column(name = "read_at")
    private Instant readAt;

    @Builder.Default
    @Column(name = "deleted_by_sender", nullable = false, columnDefinition = "TINYINT(1) NOT NULL DEFAULT 0")
    private boolean deletedBySender = false;

    @Builder.Default
    @Column(name = "deleted_by_receiver", nullable = false, columnDefinition = "TINYINT(1) NOT NULL DEFAULT 0")
    private boolean deletedByReceiver = false;

    @Builder.Default
    @Column(name = "deleted_for_everyone", nullable = false, columnDefinition = "TINYINT(1) NOT NULL DEFAULT 0")
    private boolean deletedForEveryone = false;
}
