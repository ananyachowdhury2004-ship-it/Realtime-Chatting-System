package com.example.chatapp.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "users", uniqueConstraints = @UniqueConstraint(columnNames = "username"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(unique = true, length = 20)
    private String mobile;

    @Column(nullable = false)
    private String password;

    private String displayName;

    @Lob
    @Column(name = "picture", columnDefinition = "LONGTEXT")
    private String picture;

    @Builder.Default
    private boolean online = false;

    private Instant lastSeen;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private PresenceMode presenceMode;

    public PresenceMode effectivePresenceMode() {
        return presenceMode == null ? PresenceMode.LAST_SEEN : presenceMode;
    }

    @Builder.Default
    private Instant createdAt = Instant.now();
}
