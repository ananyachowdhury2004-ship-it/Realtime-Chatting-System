package com.example.chatapp.controller;

import com.example.chatapp.dto.ChatMessageDto;
import com.example.chatapp.entity.Message;
import com.example.chatapp.repository.UserRepository;
import com.example.chatapp.service.FriendshipService;
import com.example.chatapp.service.MessageService;
import java.security.Principal;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
public class ChatController {

    private final MessageService messageService;
    private final SimpMessagingTemplate messagingTemplate;
    private final FriendshipService friendshipService;
    private final UserRepository userRepository;

    @MessageMapping("/chat.send")
    public void sendMessage(ChatMessageDto incoming, Principal principal) {
        if (principal == null) {
            throw new IllegalStateException("Not authenticated");
        }
        String senderUsername = principal.getName();
        String receiverUsername = incoming.getReceiverUsername();
        String content = incoming.getContent();
        String attachment = incoming.getAttachment();
        Message saved = messageService.sendMessage(senderUsername, receiverUsername, content, attachment);
        ChatMessageDto outgoing = new ChatMessageDto(
            saved.getId(),
            saved.getSender().getUsername(),
            saved.getReceiver().getUsername(),
            content == null ? "" : content,
            saved.getTimestamp(),
            saved.getAttachmentName(),
            saved.getAttachmentType(),
            saved.getDeliveredAt() != null ? "DELIVERED" : "SENT",
            saved.getDeliveredAt(),
            saved.getReadAt()
        );
        messagingTemplate.convertAndSendToUser(saved.getReceiver().getUsername(), "/queue/messages", outgoing);
        messagingTemplate.convertAndSendToUser(saved.getSender().getUsername(), "/queue/messages", outgoing);
    }

    @MessageExceptionHandler
    @SendToUser("/queue/errors")
    public java.util.Map<String, String> handleException(Exception ex) {
        String msg = ex.getMessage() != null ? ex.getMessage() : "Message could not be sent";
        return java.util.Map.of("error", msg);
    }

    @MessageMapping("/chat.typing")
    public void typing(ChatMessageDto incoming, Principal principal) {
        String senderUsername = principal.getName();
        var sender = userRepository.findByUsername(senderUsername).orElse(null);
        var receiver = userRepository.findByUsername(incoming.getReceiverUsername()).orElse(null);
        if (
            sender == null ||
            receiver == null ||
            friendshipService.isBlockedEitherWay(sender, receiver) ||
            !friendshipService.areFriends(sender, receiver)
        ) {
            return;
        }
        messagingTemplate.convertAndSendToUser(
            incoming.getReceiverUsername(),
            "/queue/typing",
            java.util.Map.of("from", senderUsername)
        );
    }
}
