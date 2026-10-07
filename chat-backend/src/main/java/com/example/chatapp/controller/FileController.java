package com.example.chatapp.controller;

import com.example.chatapp.util.FileSignature;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
public class FileController {

    private static final Map<String, String> IMAGE_TYPES = Map.of(
        "image/jpeg",
        "jpg",
        "image/png",
        "png",
        "image/gif",
        "gif",
        "image/webp",
        "webp"
    );
    private static final Map<String, String> VIDEO_TYPES = Map.of(
        "video/mp4",
        "mp4",
        "video/webm",
        "webm",
        "video/quicktime",
        "mov",
        "video/ogg",
        "ogv"
    );
    private static final Map<String, String> AUDIO_TYPES = Map.of(
        "audio/webm",
        "weba",
        "audio/ogg",
        "oga",
        "audio/mp4",
        "m4a",
        "audio/x-m4a",
        "m4a",
        "audio/aac",
        "aac",
        "audio/mpeg",
        "mp3",
        "audio/wav",
        "wav"
    );
    private static final Map<String, String> MIME_BY_EXTENSION = Map.ofEntries(
        Map.entry("jpg", "image/jpeg"),
        Map.entry("png", "image/png"),
        Map.entry("gif", "image/gif"),
        Map.entry("webp", "image/webp"),
        Map.entry("mp4", "video/mp4"),
        Map.entry("webm", "video/webm"),
        Map.entry("mov", "video/quicktime"),
        Map.entry("ogv", "video/ogg"),
        Map.entry("weba", "audio/webm"),
        Map.entry("oga", "audio/ogg"),
        Map.entry("m4a", "audio/mp4"),
        Map.entry("aac", "audio/aac"),
        Map.entry("mp3", "audio/mpeg"),
        Map.entry("wav", "audio/wav")
    );
    private static final Pattern STORED_NAME = Pattern.compile(
        "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}" +
            "\\.(jpg|png|gif|webp|mp4|webm|mov|ogv|weba|oga|m4a|aac|mp3|wav)$"
    );
    private final Path uploadDir;

    public FileController(@Value("${app.upload-dir:uploads}") String dir) throws IOException {
        this.uploadDir = Paths.get(dir).toAbsolutePath().normalize();
        Files.createDirectories(this.uploadDir);
    }

    public static boolean isValidStoredName(String name) {
        return name != null && STORED_NAME.matcher(name).matches();
    }

    public static String kindOf(String name) {
        if (!isValidStoredName(name)) {
            return null;
        }
        String ext = name.substring(name.lastIndexOf('.') + 1);
        String mime = MIME_BY_EXTENSION.get(ext);
        if (mime != null && mime.startsWith("image/")) {
            return "IMAGE";
        }
        if (mime != null && mime.startsWith("audio/")) {
            return "AUDIO";
        }
        return "VIDEO";
    }

    public void deleteStored(String name) {
        if (!isValidStoredName(name)) {
            return;
        }
        try {
            Path file = uploadDir.resolve(name).normalize();
            if (file.startsWith(uploadDir)) {
                Files.deleteIfExists(file);
            }
        } catch (IOException e) {}
    }

    @PostMapping("/api/files")
    public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No file selected"));
        }
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
        int semicolon = contentType.indexOf(';');
        if (semicolon >= 0) {
            contentType = contentType.substring(0, semicolon).trim();
        }
        String extension = IMAGE_TYPES.get(contentType);
        if (extension == null) {
            extension = VIDEO_TYPES.get(contentType);
        }
        if (extension == null) {
            extension = AUDIO_TYPES.get(contentType);
        }
        if (extension == null) {
            return ResponseEntity.badRequest().body(
                Map.of(
                    "error",
                    "Only images (JPG, PNG, GIF, WEBP), videos (MP4, WEBM, MOV, OGG) and voice messages are allowed"
                )
            );
        }
        byte[] head;
        try (InputStream in = file.getInputStream()) {
            head = in.readNBytes(FileSignature.HEAD_BYTES);
        }
        String detected = FileSignature.detectExtension(head, contentType);
        if (detected == null) {
            return ResponseEntity.badRequest().body(
                Map.of("error", "This file's contents don't match an allowed image, video or voice format")
            );
        }
        try (InputStream in = file.getInputStream()) {
            if (!FileSignature.imageDimensionsOk(in, detected)) {
                return ResponseEntity.badRequest().body(Map.of("error", "This image is damaged or too large"));
            }
        }
        String storedName = UUID.randomUUID() + "." + detected;
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, uploadDir.resolve(storedName));
        }
        return ResponseEntity.ok(Map.of("name", storedName, "type", kindOf(storedName)));
    }

    @GetMapping("/files/{name:.+}")
    public ResponseEntity<Resource> serve(@PathVariable String name) throws IOException {
        if (!isValidStoredName(name)) {
            return ResponseEntity.notFound().build();
        }
        Path file = uploadDir.resolve(name).normalize();
        if (!file.startsWith(uploadDir) || !Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS)) {
            return ResponseEntity.notFound().build();
        }
        String ext = name.substring(name.lastIndexOf('.') + 1);
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(MIME_BY_EXTENSION.get(ext)))
            .header("X-Content-Type-Options", "nosniff")
            .header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; sandbox")
            .header("Content-Disposition", ContentDisposition.inline().filename(name).build().toString())
            .cacheControl(CacheControl.maxAge(7, TimeUnit.DAYS).cachePrivate())
            .body(new UrlResource(file.toUri()));
    }
}
