const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const { exec } = require('child_process');

// Create HTTP server and set up Socket.IO
const server = http.createServer();
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// In-memory storage for connected users in each room
const rooms = {};

// Helper function to generate a unique room ID
function generateRoomId() {
  return 'room_' + Math.random().toString(36).substr(2, 9); // Generate a random room ID
}

// Sandboxing setup (basic for now)
function executeCodeInSandbox(language, code, callback) {
  try {
    if (language === 'js') {
      exec(`node -e "${code}"`, (error, stdout, stderr) => {
        if (error) {
          callback(`Error: ${error.message}`);
          return;
        }
        if (stderr) {
          callback(`stderr: ${stderr}`);
          return;
        }
        callback(stdout);
      });
    } else if (language === 'python') {
      exec(`python3 -c "${code}"`, (error, stdout, stderr) => {
        if (error) {
          callback(`Error: ${error.message}`);
          return;
        }
        if (stderr) {
          callback(`stderr: ${stderr}`);
          return;
        }
        callback(stdout);
      });
    } else {
      callback('Unsupported language');
    }
  } catch (err) {
    callback(`Execution failed: ${err.message}`);
  }
}

// Setup Socket.IO listeners
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Handle room creation
  socket.on("create-room", () => {
    const roomId = generateRoomId(); // Generate a new unique room ID
    rooms[roomId] = [];  // Initialize an empty array for the users in this room
    socket.emit("room-created", roomId); // Send the room ID to the user who created the room
  });

  // Handle user joining a room
  socket.on("join-room", (roomId, userId) => {
    if (!rooms[roomId]) {
      socket.emit("error", "Room does not exist");
      return;
    }
    rooms[roomId].push(userId);
    socket.join(roomId);
    socket.to(roomId).emit("user-joined", userId);

    // Listen for code updates
    socket.on("send-code", (code) => {
      socket.to(roomId).emit("receive-code", code);
    });

    // Handle user disconnection
    socket.on("disconnect", () => {
      rooms[roomId] = rooms[roomId].filter((id) => id !== userId);
      socket.to(roomId).emit("user-left", userId);
    });

    // Handle comments
    socket.on("send-comment", (comment) => {
      socket.to(roomId).emit("receive-comment", comment);
    });

    // Handle code execution requests
    socket.on("execute-code", (language, code) => {
      executeCodeInSandbox(language, code, (output) => {
        socket.emit("code-output", output);
      });
    });
  });

  // Handle file sharing from the frontend
  socket.on("share-file", (fileData) => {
    const { fileName, fileContent } = fileData;
    socket.broadcast.emit("file-shared", { fileName, fileContent });
  });
});

server.listen(3001, () => {
  console.log("Socket.IO server running on http://localhost:3001");
});

// Create window
let mainWindow;
app.on('ready', () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
});

// Quit the app when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
