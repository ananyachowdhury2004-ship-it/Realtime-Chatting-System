package com.example.chatapp.service;

import com.example.chatapp.dto.AuthResponse;
import com.example.chatapp.dto.LoginRequest;
import com.example.chatapp.dto.RegisterRequest;
import com.example.chatapp.entity.User;
import com.example.chatapp.repository.UserRepository;
import com.example.chatapp.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final org.springframework.security.core.userdetails.UserDetailsService userDetailsService;

    public AuthResponse register(RegisterRequest request) {
        String username = request.getUsername() == null ? "" : request.getUsername().trim().toLowerCase();
        if (username.isEmpty()) {
            throw new IllegalArgumentException("Email is required");
        }
        String mobile = normalizeMobile(request.getMobile());
        if (userRepository.existsByUsernameIgnoreCase(username)) {
            throw new IllegalArgumentException("This email is already registered");
        }
        if (userRepository.existsByMobileEndingWith(mobile.substring(mobile.length() - 10))) {
            throw new IllegalArgumentException("This mobile number is already registered");
        }
        String displayName = request.getDisplayName() == null ? "" : request.getDisplayName().trim();
        if (displayName.isEmpty()) {
            displayName = username;
        }
        if (displayName.length() > 50) {
            displayName = displayName.substring(0, 50);
        }
        User user = User.builder()
            .username(username)
            .mobile(mobile)
            .password(passwordEncoder.encode(request.getPassword()))
            .displayName(displayName)
            .build();
        try {
            userRepository.save(user);
        } catch (DataIntegrityViolationException e) {
            throw new IllegalArgumentException("This email or mobile number is already registered");
        }
        UserDetails userDetails = userDetailsService.loadUserByUsername(user.getUsername());
        String token = jwtService.generateToken(userDetails);
        return new AuthResponse(token, user.getUsername(), user.getDisplayName());
    }

    private String normalizeMobile(String raw) {
        String digits = raw == null ? "" : raw.replaceAll("\\D", "");
        if (digits.length() < 10 || digits.length() > 15) {
            throw new IllegalArgumentException("Enter a valid mobile number (10 to 15 digits)");
        }
        return digits;
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository
            .findByUsernameIgnoreCase(request.getUsername() == null ? "" : request.getUsername().trim())
            .orElseThrow(() -> new BadCredentialsException("Invalid username or password"));
        authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(user.getUsername(), request.getPassword())
        );
        UserDetails userDetails = userDetailsService.loadUserByUsername(user.getUsername());
        String token = jwtService.generateToken(userDetails);
        return new AuthResponse(token, user.getUsername(), user.getDisplayName());
    }
}
