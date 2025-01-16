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

const connectedUsers = {};

// Sandboxing setup (basic for now)
function executeCodeInSandbox(language, code, callback) {
  try {
    if (language === 'js') {
      // JavaScript execution in a sandbox (basic example, can use vm2 for more security)
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
      // Python execution
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

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // When a user joins a room
  socket.on("join-room", (roomId, userId) => {
    if (!connectedUsers[roomId]) {
      connectedUsers[roomId] = [];
    }
    connectedUsers[roomId].push(userId);
    socket.join(roomId);
    socket.to(roomId).emit("user-joined", userId);

    // When the user sends code updates
    socket.on("send-code", (code) => {
      socket.to(roomId).emit("receive-code", code);
    });

    // Handle user disconnection
    socket.on("disconnect", () => {
      connectedUsers[roomId] = connectedUsers[roomId].filter((id) => id !== userId);
      socket.to(roomId).emit("user-left", userId);
    });

    // Handle real-time comment sharing
    socket.on("send-comment", (comment) => {
      socket.to(roomId).emit("receive-comment", comment);
    });

    // Code execution request from a user
    socket.on("execute-code", (language, code) => {
      executeCodeInSandbox(language, code, (output) => {
        socket.emit("code-output", output);
      });
    });
  });

  // Handle file sharing from the frontend
  socket.on("share-file", (fileData) => {
    const { fileName, fileContent } = fileData;
    // Emit the file to other users in the same room
    socket.broadcast.emit("file-shared", { fileName, fileContent });
  });
});

server.listen(3001, () => {
  console.log("Socket.IO server running on http://localhost:3001");
});

// Create window
function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');  // Load the frontend HTML
}

app.whenReady().then(() => {
  createWindow();
});

// Quit the app when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
