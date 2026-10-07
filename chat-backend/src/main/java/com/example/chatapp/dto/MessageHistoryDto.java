package com.example.chatapp.dto;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class MessageHistoryDto {

    private Long id;
    private String senderUsername;
    private String receiverUsername;
    private String content;
    private Instant timestamp;
    private boolean read;
    private String attachment;
    private String attachmentType;
    private String status;
    private boolean deleted;
    private Instant deliveredAt;
    private Instant readAt;
}
