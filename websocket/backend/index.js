const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const app = express();
const server = http.createServer(app);

const cors = require("cors");

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});
app.use(express.static("public"));

app.use(cors());
const PORT = 3000;
const roomMessages = {};

let currentPlayerSymbol = "R";
const players = {};
let currentPlayerId = null;
let board = Array(6)
  .fill(null)
  .map(() => Array(7).fill(null));

function resetGame() {
  currentPlayerSymbol = "R";
  currentPlayerId = null;
  board = Array(6)
    .fill(null)
    .map(() => Array(7).fill(null));
}

function checkWin(symbol) {
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 4; col++) {
      if (
        board[row][col] === symbol &&
        board[row][col + 1] === symbol &&
        board[row][col + 2] === symbol &&
        board[row][col + 3] === symbol
      ) {
        return true;
      }
    }
  }

  for (let col = 0; col < 7; col++) {
    for (let row = 0; row < 3; row++) {
      if (
        board[row][col] === symbol &&
        board[row + 1][col] === symbol &&
        board[row + 2][col] === symbol &&
        board[row + 3][col] === symbol
      ) {
        return true;
      }
    }
  }

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      if (
        board[row][col] === symbol &&
        board[row + 1][col + 1] === symbol &&
        board[row + 2][col + 2] === symbol &&
        board[row + 3][col + 3] === symbol
      ) {
        return true;
      }
    }
  }

  for (let row = 0; row < 3; row++) {
    for (let col = 3; col < 7; col++) {
      if (
        board[row][col] === symbol &&
        board[row + 1][col - 1] === symbol &&
        board[row + 2][col - 2] === symbol &&
        board[row + 3][col - 3] === symbol
      ) {
        return true;
      }
    }
  }
  return false;
}

io.on("connection", (socket) => {
  socket.on("disconnect", () => {
    console.log("user disconnected", socket.id);
  });

  socket.on("message", (msg) => {
    if (currentRoom) {
      io.to(currentRoom).emit("message", `${socket.username}: ${msg}`);
    }
  });

  socket.on("room", (room, msg) => {
    if (!roomMessages[room]) {
      roomMessages[room] = [];
    }

    roomMessages[room].push({
      userId: socket.id,
      message: msg,
    });
    io.to(room).emit("message", { room, message: msg, userId: socket.id });
  });

  socket.on("privateMessage", ({ recipientId, message }) => {
    const recipientSocket = io.sockets.sockets.get(recipientId);
    if (recipientSocket) {
      const salon = "private";
      recipientSocket.emit("privateMessage", {
        senderId: socket.id,
        message,
        salon,
      });
      socket.emit("privateMessageConfirmation", {
        recipientId,
        message,
        salon,
      });
    } else {
      socket.emit("privateMessageError", {
        recipientId,
        message,
        error: "Recipient is not connected",
      });
    }
  });

  function getUsersInRoom(room) {
    const users = [];
    const roomSockets = io.sockets.adapter.rooms.get(room);
    if (roomSockets) {
      roomSockets.forEach((socketId) => {
        const userSocket = io.sockets.sockets.get(socketId);
        if (userSocket) {
          users.push(userSocket.id);
        }
      });
    }
    return users;
  }

  socket.on("join", (room) => {
    if (socket.room) {
      socket.leave(socket.room);
    }

    socket.join(room);
    socket.room = room;

    io.to(room).emit("updateUsersList", getUsersInRoom(room));

    if (io.sockets.adapter.rooms.has(room)) {
      const usersInRoom = Array.from(io.sockets.adapter.rooms.get(room));
      socket.emit("usersInRoom", usersInRoom);
    }
    io.emit("player-connected", socket.id);
  });

  socket.on("leave", (room) => {
    socket.leave(room);
    io.to(room).emit("updateUsersList", getUsersInRoom(room));
  });

  const room = io.sockets.adapter.rooms.get(socket.room);
  if (room) {
    const usersInRoom = "";
    if (room.sockets !== undefined) {
      usersInRoom = Array.from(room.sockets);
    }
    socket.emit("usersInRoom", usersInRoom);
  }

  socket.on("requestMessageHistory", (room) => {
    const messageHistory = roomMessages[room] || [];
    socket.emit("messageHistory", messageHistory);
  });

  socket.on("join", () => {
    if (Object.keys(players).length < 2) {
      if (!currentPlayerId) {
        currentPlayerId = socket.id;
      }

      players[socket.id] = currentPlayerSymbol;
      currentPlayerSymbol = currentPlayerSymbol === "R" ? "Y" : "R";
      if (Object.keys(players).length === 2) {
        io.emit("init", { symbol: players[socket.id] });
      }
    } else {
      socket.emit("full");
    }
  });

  socket.on("play", (data) => {
    const { row, column } = data;
    if (socket.id !== currentPlayerId) {
      return;
    }

    if (Object.keys(players).length <= 2) {
      if (Object.keys(players).length === 1) {
        players[socket.id].symbol = "R";
      } else {
        players[socket.id].symbol = "Y";
      }
      players[socket.id].ready = true;

      if (
        Object.values(players).filter((player) => player.ready).length === 2
      ) {
        io.emit("init", { players });
        io.to(
          Object.keys(players).find((id) => players[id].symbol === "R")
        ).emit("yourTurn");
      }
    }
    socket.on("playerReload", (id) => {
      if (players[id]) {
        delete players[id];
        resetGame();
      }
    });

    if (
      row >= 0 &&
      row < 6 &&
      column >= 0 &&
      column < 7 &&
      !board[row][column]
    ) {
      board[row][column] = players[socket.id];
      io.emit("play", { row, column, symbol: players[socket.id] });

      if (checkWin(players[socket.id])) {
        io.emit("win", { symbol: players[socket.id] });
      } else {
        currentPlayerId = Object.keys(players).find((id) => id !== socket.id);
      }
    }
  });
  socket.on("leave-game", () => {
    delete players[socket.id];
    resetGame();
    io.emit("player-disconnected", { playerId: socket.id });
  });

  socket.on("reset", () => {
    currentPlayerId = null;
    resetGame();
    io.emit("reset");
    io.emit("init", { symbol: currentPlayerSymbol });
    io.emit("gameReset");
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    if (socket.id === currentPlayerId) {
      currentPlayerId = Object.keys(players)[0] || null;
    }
  });
});

server.listen(PORT, () => {
  console.log(`Serveur en cours d'exécution sur le port ${PORT}`);
});
