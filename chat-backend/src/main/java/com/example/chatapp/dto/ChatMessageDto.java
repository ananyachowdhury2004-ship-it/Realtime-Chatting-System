package com.example.chatapp.dto;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessageDto {

    private Long id;
    private String senderUsername;
    private String receiverUsername;
    private String content;
    private Instant timestamp;
    private String attachment;
    private String attachmentType;
    private String status;
    private Instant deliveredAt;
    private Instant readAt;
}
