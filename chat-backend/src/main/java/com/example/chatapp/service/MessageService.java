package com.example.chatapp.service;

import com.example.chatapp.controller.FileController;
import com.example.chatapp.dto.MessageHistoryDto;
import com.example.chatapp.entity.ChatClear;
import com.example.chatapp.entity.Message;
import com.example.chatapp.entity.User;
import com.example.chatapp.repository.ChatClearRepository;
import com.example.chatapp.repository.MessageRepository;
import com.example.chatapp.repository.UserRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class MessageService {

    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final EncryptionService encryptionService;
    private final FriendshipService friendshipService;
    private final ChatClearRepository chatClearRepository;
    private final PresenceService presenceService;
    private final SimpMessagingTemplate messagingTemplate;
    private final FileController fileController;

    public MessageService(
        MessageRepository messageRepository,
        UserRepository userRepository,
        EncryptionService encryptionService,
        FriendshipService friendshipService,
        ChatClearRepository chatClearRepository,
        PresenceService presenceService,
        SimpMessagingTemplate messagingTemplate,
        FileController fileController
    ) {
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.encryptionService = encryptionService;
        this.friendshipService = friendshipService;
        this.chatClearRepository = chatClearRepository;
        this.presenceService = presenceService;
        this.messagingTemplate = messagingTemplate;
        this.fileController = fileController;
    }

    public Message sendMessage(String senderUsername, String receiverUsername, String content, String attachment) {
        if (senderUsername == null || senderUsername.isBlank()) {
            throw new IllegalArgumentException("Sender username cannot be empty");
        }
        if (receiverUsername == null || receiverUsername.isBlank()) {
            throw new IllegalArgumentException("Receiver username cannot be empty");
        }
        boolean hasAttachment = attachment != null && !attachment.isBlank();
        if (hasAttachment && !FileController.isValidStoredName(attachment)) {
            throw new IllegalArgumentException("Invalid attachment");
        }
        if (!hasAttachment && (content == null || content.isBlank())) {
            throw new IllegalArgumentException("Message cannot be empty");
        }
        if (content == null) {
            content = "";
        }
        User sender = userRepository
            .findByUsername(senderUsername)
            .orElseThrow(() -> new RuntimeException("Sender not found"));
        User receiver = userRepository
            .findByUsername(receiverUsername)
            .orElseThrow(() -> new RuntimeException("Receiver not found"));
        if (friendshipService.isBlockedEitherWay(sender, receiver)) {
            throw new IllegalArgumentException("You can't send messages to this user");
        }
        if (!friendshipService.areFriends(sender, receiver)) {
            throw new IllegalArgumentException("You can only message your friends");
        }
        String encryptedContent = encryptionService.encrypt(content);
        Instant now = Instant.now();
        boolean receiverOnline = presenceService.isOnline(receiver.getUsername());
        Message message = Message.builder()
            .sender(sender)
            .receiver(receiver)
            .content(encryptedContent)
            .attachmentName(hasAttachment ? attachment : null)
            .attachmentType(hasAttachment ? FileController.kindOf(attachment) : null)
            .timestamp(now)
            .deliveredAt(receiverOnline ? now : null)
            .build();
        return messageRepository.save(message);
    }

    @Transactional(readOnly = true)
    public List<MessageHistoryDto> getConversation(String username1, String username2) {
        if (username1 == null || username2 == null) {
            throw new IllegalArgumentException("Both usernames are required");
        }
        User user1 = userRepository
            .findByUsername(username1)
            .orElseThrow(() -> new RuntimeException("User not found: " + username1));
        User user2 = userRepository
            .findByUsername(username2)
            .orElseThrow(() -> new RuntimeException("User not found: " + username2));
        java.time.Instant clearedAt = chatClearRepository
            .findByUserAndOtherUser(user1, user2)
            .map(ChatClear::getClearedAt)
            .orElse(null);
        return messageRepository
            .findConversation(user1.getId(), user2.getId())
            .stream()
            .filter(m -> clearedAt == null || m.getTimestamp().isAfter(clearedAt))
            .filter(m -> !isHiddenFor(m, user1))
            .map(this::toDto)
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<MessageHistoryDto> getAllMessages() {
        return messageRepository.findAll().stream().map(this::toDto).collect(Collectors.toList());
    }

    public void markConversationRead(String me, String otherUsername) {
        User reader = userRepository
            .findByUsername(me)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
        User sender = userRepository
            .findByUsername(otherUsername)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
        List<Message> unread = messageRepository.findByReceiverAndSenderAndReadAtIsNull(reader, sender);
        if (unread.isEmpty()) {
            return;
        }
        Instant now = Instant.now();
        for (Message message : unread) {
            message.setReadAt(now);
            if (message.getDeliveredAt() == null) {
                message.setDeliveredAt(now);
            }
        }
        messageRepository.saveAll(unread);
        messagingTemplate.convertAndSendToUser(
            sender.getUsername(),
            "/queue/receipts",
            Map.of("peer", reader.getUsername(), "status", "READ", "at", now.toString())
        );
    }

    public void deleteMessage(String me, Long messageId, String scope) {
        User user = userRepository.findByUsername(me).orElseThrow(() -> new IllegalArgumentException("User not found"));
        Message message = messageRepository
            .findById(messageId)
            .orElseThrow(() -> new IllegalArgumentException("Message not found"));
        boolean isSender = message.getSender().getId().equals(user.getId());
        boolean isReceiver = message.getReceiver().getId().equals(user.getId());
        if (!isSender && !isReceiver) {
            throw new IllegalArgumentException("You can't delete this message");
        }
        String otherUsername = isSender ? message.getReceiver().getUsername() : message.getSender().getUsername();
        if ("everyone".equalsIgnoreCase(scope)) {
            if (!isSender) {
                throw new IllegalArgumentException("Only the sender can delete a message for everyone");
            }
            if (message.isDeletedForEveryone()) {
                return;
            }
            String file = message.getAttachmentName();
            message.setDeletedForEveryone(true);
            message.setContent(encryptionService.encrypt(""));
            message.setAttachmentName(null);
            message.setAttachmentType(null);
            messageRepository.save(message);
            if (file != null) {
                fileController.deleteStored(file);
            }
            messagingTemplate.convertAndSendToUser(
                otherUsername,
                "/queue/deletions",
                Map.of("id", message.getId(), "peer", me)
            );
            messagingTemplate.convertAndSendToUser(
                me,
                "/queue/deletions",
                Map.of("id", message.getId(), "peer", otherUsername)
            );
            return;
        }
        if (isSender) {
            message.setDeletedBySender(true);
        } else {
            message.setDeletedByReceiver(true);
        }
        if (message.isDeletedBySender() && message.isDeletedByReceiver() && message.getAttachmentName() != null) {
            fileController.deleteStored(message.getAttachmentName());
        }
        messageRepository.save(message);
    }

    private boolean isHiddenFor(Message message, User viewer) {
        boolean viewerIsSender = message.getSender().getId().equals(viewer.getId());
        return viewerIsSender ? message.isDeletedBySender() : message.isDeletedByReceiver();
    }

    private MessageHistoryDto toDto(Message message) {
        boolean deleted = message.isDeletedForEveryone();
        String text;
        if (deleted) {
            text = "";
        } else {
            try {
                text = encryptionService.decrypt(message.getContent());
            } catch (RuntimeException e) {
                text = "[message could not be decrypted]";
            }
        }
        String status = message.getReadAt() != null ? "READ" : message.getDeliveredAt() != null ? "DELIVERED" : "SENT";
        return new MessageHistoryDto(
            message.getId(),
            message.getSender().getUsername(),
            message.getReceiver().getUsername(),
            text,
            message.getTimestamp(),
            message.getReadAt() != null,
            deleted ? null : message.getAttachmentName(),
            deleted ? null : message.getAttachmentType(),
            status,
            deleted,
            deleted ? null : message.getDeliveredAt(),
            deleted ? null : message.getReadAt()
        );
    }
}
