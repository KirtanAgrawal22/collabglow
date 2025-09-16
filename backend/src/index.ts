import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { executeJavaScript } from './execution/javascript-service';
import { executeCode } from './execution/piston-service'; 
import { executionLimiter } from './middleware/security';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// Simple in-memory room registry
const rooms = new Set<string>();
// In-memory room state (persists while server is running)
type RoomState = { code?: string; language?: string; whiteboard?: string };
const roomStates = new Map<string, RoomState>();

app.use(cors());
app.use(express.json());

// Socket.IO for realtime collaboration
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  const socketState: { roomId?: string; name?: string } = {};

  socket.on('join_room', ({ roomId }: { roomId: string }) => {
    if (!roomId || !rooms.has(roomId)) {
      socket.emit('room_error', { error: 'Invalid room id' });
      return;
    }
    socket.join(roomId);
    socketState.roomId = roomId;
    socket.emit('joined_room', { roomId });
    // Send current room state to the newly joined client
    const state = roomStates.get(roomId) || {};
    socket.emit('room_state', state);
    io.to(roomId).emit('participants_update', getParticipants(roomId));
  });

  socket.on('set_name', ({ name }: { name: string }) => {
    if (!socketState.roomId) return;
    setParticipant(socketState.roomId, socket.id, name);
    io.to(socketState.roomId).emit('participants_update', getParticipants(socketState.roomId));
  });

  socket.on('code_change', ({ roomId, code, language }: { roomId: string; code: string; language: string }) => {
    if (!roomId) return;
    // persist latest code state
    const state = roomStates.get(roomId) || {};
    state.code = code;
    state.language = language;
    roomStates.set(roomId, state);
    socket.to(roomId).emit('code_update', { code, language });
  });

  socket.on('whiteboard_change', ({ roomId, drawing }: { roomId: string; drawing: any }) => {
    if (!roomId) return;
    // persist latest whiteboard image (dataURL)
    const state = roomStates.get(roomId) || {};
    if (drawing?.dataURL) state.whiteboard = drawing.dataURL;
    roomStates.set(roomId, state);
    socket.to(roomId).emit('whiteboard_update', { drawing });
  });

  socket.on('disconnect', () => {
    const { roomId } = socketState;
    if (!roomId) return;
    removeParticipant(roomId, socket.id);
    io.to(roomId).emit('participants_update', getParticipants(roomId));
  });
});

// Room management endpoints
app.post('/api/rooms', (req, res) => {
  // Generate a short, readable room id: 6 chars, base36
  let id = '';
  do {
    id = Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (rooms.has(id));
  rooms.add(id);
  roomStates.set(id, { code: '', language: 'python', whiteboard: '' });
  res.json({ roomId: id });
});

app.get('/api/rooms/:id', (req, res) => {
  const { id } = req.params;
  res.json({ valid: rooms.has(id) });
});

app.post('/api/execute', executionLimiter, async (req, res) => {
  try {
    const { code, language, stdin = '' } = req.body;
    
    if (!code || !language) {
      return res.status(400).json({ error: 'Code and language are required' });
    }

    let result;
    switch (language) {
      case 'javascript':
        result = executeJavaScript(code, stdin);
        break;
      default:
        result = await executeCode(code, language, stdin);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Execution error:', error);
    res.status(500).json({ 
      error: 'Execution failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

server.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
});

// Participants registry
const participantsByRoom = new Map<string, Map<string, string>>();
function getOrCreateRoomParticipants(roomId: string) {
  if (!participantsByRoom.has(roomId)) participantsByRoom.set(roomId, new Map());
  return participantsByRoom.get(roomId)!;
}
function setParticipant(roomId: string, socketId: string, name: string) {
  const room = getOrCreateRoomParticipants(roomId);
  room.set(socketId, name || 'Anonymous');
}
function removeParticipant(roomId: string, socketId: string) {
  const room = getOrCreateRoomParticipants(roomId);
  room.delete(socketId);
}
function getParticipants(roomId: string) {
  const room = getOrCreateRoomParticipants(roomId);
  return Array.from(room.entries()).map(([id, name]) => ({ id, name }));
}