import { config } from "dotenv";
import jwt from "jsonwebtoken";
import { WebSocketServer, type WebSocket } from "ws";

config();

type AccessLevel = "view" | "edit" | "owner";

type RealtimeEvent =
  | "note.join"
  | "note.leave"
  | "note.patch"
  | "note.cursor"
  | "checklist.item.update"
  | "collaboration.presence";

interface RealtimeTokenPayload {
  sub: string;
  email: string;
  noteId: string;
  accessLevel: AccessLevel;
  type: "realtime";
}

interface ClientContext {
  socket: WebSocket;
  userId: string;
  email: string;
  noteId: string;
  accessLevel: AccessLevel;
}

interface IncomingMessage {
  event: RealtimeEvent;
  noteId: string;
  payload: unknown;
}

const realtimePort = Number(process.env.REALTIME_PORT ?? 4010);
const realtimeSecret = process.env.REALTIME_JWT_SECRET;

if (!realtimeSecret || realtimeSecret.length < 16) {
  throw new Error("REALTIME_JWT_SECRET must be configured and at least 16 characters long.");
}

const wss = new WebSocketServer({ port: realtimePort });
const rooms = new Map<string, Set<ClientContext>>();

function emit(socket: WebSocket, event: RealtimeEvent, noteId: string, payload: unknown): void {
  socket.send(JSON.stringify({ event, noteId, payload }));
}

function broadcast(
  noteId: string,
  event: RealtimeEvent,
  payload: unknown,
  options?: { excludeUserId?: string }
): void {
  const clients = rooms.get(noteId);
  if (!clients) {
    return;
  }

  for (const client of clients) {
    if (client.socket.readyState !== client.socket.OPEN) {
      continue;
    }

    if (options?.excludeUserId && client.userId === options.excludeUserId) {
      continue;
    }

    emit(client.socket, event, noteId, payload);
  }
}

function sendPresence(noteId: string): void {
  const clients = rooms.get(noteId);
  if (!clients) {
    return;
  }

  const presence = Array.from(clients).map((client) => ({
    userId: client.userId,
    email: client.email,
    accessLevel: client.accessLevel
  }));

  broadcast(noteId, "collaboration.presence", { users: presence });
}

function removeClient(context: ClientContext): void {
  const clients = rooms.get(context.noteId);
  if (!clients) {
    return;
  }

  clients.delete(context);

  broadcast(
    context.noteId,
    "note.leave",
    {
      userId: context.userId,
      email: context.email
    },
    { excludeUserId: context.userId }
  );

  if (clients.size === 0) {
    rooms.delete(context.noteId);
    return;
  }

  sendPresence(context.noteId);
}

wss.on("connection", (socket, request) => {
  try {
    const url = new URL(request.url ?? "", `http://${request.headers.host}`);
    const token = url.searchParams.get("token");
    const noteId = url.searchParams.get("noteId");

    if (!token || !noteId) {
      socket.close(1008, "Missing token or noteId");
      return;
    }

    const parsed = jwt.verify(token, realtimeSecret) as RealtimeTokenPayload;

    if (parsed.type !== "realtime" || parsed.noteId !== noteId || !parsed.sub || !parsed.email) {
      socket.close(1008, "Invalid realtime token");
      return;
    }

    const context: ClientContext = {
      socket,
      userId: parsed.sub,
      email: parsed.email,
      noteId,
      accessLevel: parsed.accessLevel
    };

    if (!rooms.has(noteId)) {
      rooms.set(noteId, new Set());
    }

    rooms.get(noteId)!.add(context);

    emit(socket, "note.join", noteId, {
      userId: context.userId,
      email: context.email,
      accessLevel: context.accessLevel
    });

    broadcast(
      noteId,
      "note.join",
      {
        userId: context.userId,
        email: context.email,
        accessLevel: context.accessLevel
      },
      { excludeUserId: context.userId }
    );

    sendPresence(noteId);

    socket.on("message", (buffer) => {
      let incoming: IncomingMessage;

      try {
        incoming = JSON.parse(buffer.toString()) as IncomingMessage;
      } catch {
        emit(socket, "note.cursor", context.noteId, { error: "Invalid payload format." });
        return;
      }

      if (incoming.noteId !== context.noteId) {
        emit(socket, "note.cursor", context.noteId, { error: "Mismatched note room." });
        return;
      }

      if (incoming.event === "note.patch" || incoming.event === "checklist.item.update") {
        if (context.accessLevel === "view") {
          emit(socket, "note.cursor", context.noteId, {
            error: "Read-only access cannot modify note content."
          });
          return;
        }
      }

      if (incoming.event === "collaboration.presence") {
        sendPresence(context.noteId);
        return;
      }

      broadcast(context.noteId, incoming.event, {
        userId: context.userId,
        payload: incoming.payload,
        at: new Date().toISOString()
      });
    });

    socket.on("close", () => {
      removeClient(context);
    });
  } catch {
    socket.close(1008, "Auth failed");
  }
});

console.log(`Realtime collaboration gateway listening on port ${realtimePort}`);
