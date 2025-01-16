const { contextBridge } = require('electron');
const io = require('socket.io-client');

// Initialize the Socket.IO client
const socket = io("http://localhost:3001");

contextBridge.exposeInMainWorld("api", {
  // Join a room
  joinRoom: (roomId, userId) => socket.emit("join-room", roomId, userId),
  
  // Listen for user joining
  onUserJoined: (callback) => socket.on("user-joined", callback),
  
  // Send code updates
  sendCode: (code) => socket.emit("send-code", code),
  
  // Listen for code updates
  onReceiveCode: (callback) => socket.on("receive-code", callback),
  
  // Send comments
  sendComment: (comment) => socket.emit("send-comment", comment),
  
  // Listen for comments
  onReceiveComment: (callback) => socket.on("receive-comment", callback),
  
  // Execute code (send to server)
  executeCode: (language, code) => socket.emit("execute-code", language, code),
  
  // Listen for execution results
  onCodeOutput: (callback) => socket.on("code-output", callback),
});
