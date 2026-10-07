package com.example.chatapp.util;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Base64;
import java.util.Iterator;
import java.util.Locale;
import java.util.Set;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;

public final class FileSignature {

    public static final int HEAD_BYTES = 32;
    private static final long MAX_PIXELS = 40_000_000L;
    private static final int MAX_SIDE = 12_000;
    public static final long MAX_PROFILE_PICTURE_BYTES = 5L * 1024 * 1024;
    private static final Set<String> PROFILE_PICTURE_MIMES = Set.of(
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp"
    );

    private FileSignature() {}

    public static String detectExtension(byte[] head, String declared) {
        if (head == null || head.length < 4 || declared == null) {
            return null;
        }
        String type = declared.toLowerCase(Locale.ROOT);
        if (startsWith(head, 0xFF, 0xD8, 0xFF)) {
            return type.equals("image/jpeg") ? "jpg" : null;
        }
        if (startsWith(head, 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A)) {
            return type.equals("image/png") ? "png" : null;
        }
        if (ascii(head, 0, "GIF87a") || ascii(head, 0, "GIF89a")) {
            return type.equals("image/gif") ? "gif" : null;
        }
        if (ascii(head, 0, "RIFF") && head.length >= 12) {
            if (ascii(head, 8, "WEBP")) {
                return type.equals("image/webp") ? "webp" : null;
            }
            if (ascii(head, 8, "WAVE")) {
                return type.equals("audio/wav") ? "wav" : null;
            }
            return null;
        }
        if (head.length >= 12 && ascii(head, 4, "ftyp")) {
            boolean quickTime = ascii(head, 8, "qt  ");
            boolean audioBrand = ascii(head, 8, "M4A ") || ascii(head, 8, "M4B ");
            if (quickTime) {
                return type.equals("video/quicktime") ? "mov" : null;
            }
            if (type.equals("audio/mp4") || type.equals("audio/x-m4a")) {
                return "m4a";
            }
            if (!audioBrand && type.equals("video/mp4")) {
                return "mp4";
            }
            return null;
        }
        if (startsWith(head, 0x1A, 0x45, 0xDF, 0xA3)) {
            if (type.equals("video/webm")) {
                return "webm";
            }
            return type.equals("audio/webm") ? "weba" : null;
        }
        if (ascii(head, 0, "OggS")) {
            if (type.equals("video/ogg")) {
                return "ogv";
            }
            return type.equals("audio/ogg") ? "oga" : null;
        }
        if (ascii(head, 0, "ID3")) {
            return type.equals("audio/mpeg") ? "mp3" : null;
        }
        int b0 = head[0] & 0xFF;
        int b1 = head[1] & 0xFF;
        if (b0 == 0xFF && (b1 & 0xE0) == 0xE0) {
            boolean adts = (b1 & 0xF6) == 0xF0;
            if (adts) {
                return type.equals("audio/aac") ? "aac" : null;
            }
            return type.equals("audio/mpeg") ? "mp3" : null;
        }
        return null;
    }

    public static boolean imageDimensionsOk(InputStream in, String extension) throws IOException {
        if (!Set.of("jpg", "png", "gif").contains(extension)) {
            return true;
        }
        try (ImageInputStream stream = ImageIO.createImageInputStream(in)) {
            if (stream == null) {
                return false;
            }
            Iterator<ImageReader> readers = ImageIO.getImageReaders(stream);
            if (!readers.hasNext()) {
                return false;
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(stream, true, true);
                long width = reader.getWidth(0);
                long height = reader.getHeight(0);
                return (
                    width > 0 && height > 0 && width <= MAX_SIDE && height <= MAX_SIDE && width * height <= MAX_PIXELS
                );
            } finally {
                reader.dispose();
            }
        } catch (IOException | RuntimeException e) {
            return false;
        }
    }

    public static void validateProfilePicture(String dataUrl) {
        final String bad = "Please choose a valid JPG, PNG, GIF or WEBP image";
        if (dataUrl == null || dataUrl.length() > 7_000_000) {
            throw new IllegalArgumentException(dataUrl == null ? bad : "Image must be less than 5 MB");
        }
        int comma = dataUrl.indexOf(',');
        if (!dataUrl.regionMatches(true, 0, "data:", 0, 5) || comma < 0 || comma > 60) {
            throw new IllegalArgumentException(bad);
        }
        String meta = dataUrl.substring(5, comma).toLowerCase(Locale.ROOT);
        if (!meta.endsWith(";base64")) {
            throw new IllegalArgumentException(bad);
        }
        String mime = meta.substring(0, meta.length() - ";base64".length());
        if (!PROFILE_PICTURE_MIMES.contains(mime)) {
            throw new IllegalArgumentException(bad);
        }
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(dataUrl.substring(comma + 1));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(bad);
        }
        if (bytes.length > MAX_PROFILE_PICTURE_BYTES) {
            throw new IllegalArgumentException("Image must be less than 5 MB");
        }
        byte[] head = java.util.Arrays.copyOf(bytes, Math.min(bytes.length, HEAD_BYTES));
        String ext = detectExtension(head, mime);
        if (ext == null) {
            throw new IllegalArgumentException(bad);
        }
        try {
            if (!imageDimensionsOk(new ByteArrayInputStream(bytes), ext)) {
                throw new IllegalArgumentException(bad);
            }
        } catch (IOException e) {
            throw new IllegalArgumentException(bad);
        }
    }

    private static boolean startsWith(byte[] data, int... expected) {
        if (data.length < expected.length) {
            return false;
        }
        for (int i = 0; i < expected.length; i++) {
            if ((data[i] & 0xFF) != expected[i]) {
                return false;
            }
        }
        return true;
    }

    private static boolean ascii(byte[] data, int offset, String text) {
        if (data.length < offset + text.length()) {
            return false;
        }
        for (int i = 0; i < text.length(); i++) {
            if (data[offset + i] != (byte) text.charAt(i)) {
                return false;
            }
        }
        return true;
    }
}
