# Chat Backend (Spring Boot, 1-on-1 chat)

A Java Spring Boot backend for private 1-on-1 chat:
JWT auth, STOMP-over-WebSocket for real-time delivery, message
persistence, conversation history, and basic online-presence tracking.

## Stack
- Java 17, Spring Boot 3.3
- Spring WebSocket (STOMP + SockJS fallback)
- Spring Security + JWT (jjwt)
- Spring Data JPA + H2 (in-memory — swap for Postgres/MySQL for real use)

## Run it

```bash
mvn spring-boot:run
```

Server starts on `http://localhost:8080`.
H2 console (dev only): `http://localhost:8080/h2-console` (JDBC URL: `jdbc:h2:mem:chatdb`).

**Before deploying:** change `jwt.secret` in `application.yml` to a long random
value pulled from an environment variable / secrets manager, and lock down CORS
in `SecurityConfig` to your real frontend origin instead of `*`.

## REST API

| Method | Endpoint                     | Auth | Description                          |
|--------|-------------------------------|------|--------------------------------------|
| POST   | `/api/auth/register`          | No   | `{ username, password, displayName }` → token |
| POST   | `/api/auth/login`             | No   | `{ username, password }` → token     |
| GET    | `/api/users`                  | Yes  | List other users + online status     |
| GET    | `/api/messages/{otherUser}`   | Yes  | Full conversation history, oldest first |

All authenticated endpoints expect:
```
Authorization: Bearer <token>
```

## Real-time (STOMP over WebSocket)

**Connect:** `ws://localhost:8080/ws` (or `withSockJS()` fallback at the same path).
Pass the JWT as a STOMP CONNECT header (most STOMP JS clients let you set
`connectHeaders`):

```js
const stompClient = new StompJs.Client({
  brokerURL: 'ws://localhost:8080/ws',
  connectHeaders: { Authorization: `Bearer ${token}` },
});

stompClient.onConnect = () => {
  // Subscribe to your own private queue for incoming messages
  stompClient.subscribe('/user/queue/messages', (msg) => {
    console.log(JSON.parse(msg.body));
  });

  stompClient.subscribe('/user/queue/typing', (msg) => {
    console.log('typing:', JSON.parse(msg.body));
  });

  stompClient.subscribe('/topic/presence', (msg) => {
    console.log('presence:', JSON.parse(msg.body));
  });
};

stompClient.activate();
```

**Send a message:**
```js
stompClient.publish({
  destination: '/app/chat.send',
  body: JSON.stringify({ receiverUsername: 'bob', content: 'hey!' }),
});
```

**Send a typing indicator:**
```js
stompClient.publish({
  destination: '/app/chat.typing',
  body: JSON.stringify({ receiverUsername: 'bob' }),
});
```

The server ignores any `senderUsername` the client sends — it's always taken
from the authenticated session, so a client can't spoof another user.

## Project layout

```
src/main/java/com/example/chatapp/
├── ChatBackendApplication.java
├── config/          # Security, WebSocket, CORS, exception handling
├── controller/       # REST + STOMP (@MessageMapping) controllers
├── dto/              # Request/response payloads
├── entity/           # User, Message JPA entities
├── repository/       # Spring Data repositories
├── security/         # JWT service, filter, UserDetailsService
├── service/          # Auth + message business logic
└── websocket/        # Online/offline presence event listener
```

## Notes / next steps
- Swap H2 for Postgres/MySQL: add the driver dependency and update
  `spring.datasource.url` in `application.yml`.
- Add pagination to `/api/messages/{otherUser}` once history grows large.
- Add read-receipt endpoint (mark messages as read) if the frontend needs it.
- Rate-limit `/api/auth/register` and `/api/auth/login` in production.
