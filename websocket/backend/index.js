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
  console.log("a user connected", socket.id);
  socket.on("disconnect", () => {
    console.log("user disconnected", socket.id);
  });

  socket.on("message", (msg) => {
    console.log("message: " + msg);
    if (currentRoom) {
      io.to(currentRoom).emit("message", `${socket.username}: ${msg}`);
    }
  });

  socket.on("room", (room, msg) => {
    console.log("room: " + room + " message: " + msg);
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
    console.log("private message to: " + recipientId + " message: " + message);
    // Vérifier si le destinataire est connecté
    const recipientSocket = io.sockets.sockets.get(recipientId);
    if (recipientSocket) {
      const salon = "private";
      recipientSocket.emit("privateMessage", {
        senderId: socket.id,
        message,
        salon,
      });
      console.log("Recipient is connected");
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
          users.push(userSocket.id); // Ou toute autre information sur l'utilisateur que vous souhaitez retourner
        }
      });
    }
    return users;
  }

  socket.on("join", (room) => {
    console.log("join room: " + room);
    if (socket.room) {
      socket.leave(socket.room);
    }

    socket.join(room);
    socket.room = room;

    io.to(room).emit("updateUsersList", getUsersInRoom(room));

    if (io.sockets.adapter.rooms.has(room)) {
      const usersInRoom = Array.from(io.sockets.adapter.rooms.get(room));
      console.log("users in room", usersInRoom);
      socket.emit("usersInRoom", usersInRoom);
    }
    // Émettre l'événement player-connected avec l'identifiant du joueur
    io.emit("player-connected", socket.id);
  });

  socket.on("leave", (room) => {
    console.log("leave room: " + room);
    socket.leave(room);
    io.to(room).emit("updateUsersList", getUsersInRoom(room));
  });

  // Envoyer la liste des utilisateurs dans le salon au nouvel utilisateur
  const room = io.sockets.adapter.rooms.get(socket.room);
  if (room) {
    console.log("room", room);
    console.log("sockets", room.sockets);
    const usersInRoom = "";
    if (room.sockets !== undefined) {
      usersInRoom = Array.from(room.sockets);
      console.log("users in room", usersInRoom);
    }
    console.log("users in room", usersInRoom);
    socket.emit("usersInRoom", usersInRoom);
  }

  socket.on("requestMessageHistory", (room) => {
    // Récupérer l'historique des messages pour le salon spécifié
    const messageHistory = roomMessages[room] || [];
    console.log("Message History:", messageHistory); // Ajoutez cette ligne pour déboguer
    // Envoyer l'historique des messages à l'utilisateur
    socket.emit("messageHistory", messageHistory);
  });

  //////////////////////////////////////////////////////////////////////
  console.log("Nouveau client connecté", socket.id);

  // socket.on('join', () => {
  //      // Définir le joueur dont c'est le tour (si pas déjà défini)
  // if (!currentPlayerId) {
  //     currentPlayerId = socket.id;
  // }
  //     if (Object.keys(players).length < 2) {
  //         players[socket.id] = currentPlayerSymbol;
  //         currentPlayerSymbol = currentPlayerSymbol === 'R' ? 'Y' : 'R';
  //         socket.emit('init', { symbol: players[socket.id] });

  //         if (!currentPlayerId) {
  //             currentPlayerId = socket.id;
  //         }
  //     } else {
  //         socket.emit('full');
  //     }
  // });
  socket.on("join", () => {
    console.log("Joueur rejoint la partie", players);
    if (Object.keys(players).length < 2) {
      if (!currentPlayerId) {
        currentPlayerId = socket.id;
      }
      console.log("Joueur toto la partie", Object.keys(players).length < 2);
      console.log("Joueur rejoint la partie", socket.id);
      console.log(players);
      players[socket.id] = currentPlayerSymbol;
      currentPlayerSymbol = currentPlayerSymbol === "R" ? "Y" : "R";
      console.log("Joueur rejoint la ok", currentPlayerSymbol);
      if (Object.keys(players).length === 2) {
        io.emit("init", { symbol: players[socket.id] }); // Émettre uniquement pour le premier joueur qui rejoint
      }
    } else {
      socket.emit("full");
    }
  });

  socket.on("play", (data) => {
    const { row, column } = data;
    if (socket.id !== currentPlayerId) {
      // Si ce n'est pas le tour du joueur
      return;
    }
    console.log("Joueur joue", socket.id, row, column);
    console.log(data);
    ///////////////test
    if (Object.keys(players).length <= 2) {
      if (Object.keys(players).length === 1) {
        players[socket.id].symbol = "R";
      } else {
        players[socket.id].symbol = "Y";
      }
      players[socket.id].ready = true;

      // Si les deux joueurs sont prêts, initialiser la partie
      if (
        Object.values(players).filter((player) => player.ready).length === 2
      ) {
        io.emit("init", { players });
        // Envoyer un événement indiquant que le joueur "R" commence
        io.to(
          Object.keys(players).find((id) => players[id].symbol === "R")
        ).emit("yourTurn");
      }
    }
    socket.on("playerReload", (id) => {
      if (players[id]) {
        delete players[id];
        resetGame();
        console.log("Partie réinitialisée à cause du rechargement d'un joueur");
      }
      console.log(players);
    });
    ///////////
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
        // Changement de tour
        currentPlayerId = Object.keys(players).find((id) => id !== socket.id);
      }
    }
  });
  ////////////////////////////////////////////////////////////////////////////
  // Écoute de l'événement de déconnexion du joueur
  socket.on("leave-game", () => {
    console.log("Joueur déconnecté de la partie");

    // Supprimer le joueur de la liste des participants à la partie
    delete players[socket.id];

    // Réinitialiser l'état du jeu si nécessaire
    resetGame();

    // Vous pouvez également émettre un événement pour informer les autres joueurs de la déconnexion
    io.emit("player-disconnected", { playerId: socket.id });
  });

  //////////////////////////////////////////////
  // socket.on('reset', () => {
  //     if (!currentPlayerId) {
  //         currentPlayerId = socket.id;
  //     }
  //     resetGame();
  //     io.emit('reset');
  //     io.emit('init', { symbol: currentPlayerSymbol });
  //     io.emit('gameReset');
  // });

  // socket.on('reset', resetGame);
  socket.on("reset", () => {
    currentPlayerId = null; // Réinitialiser l'identifiant du joueur actuel
    resetGame();
    io.emit("reset");
    io.emit("init", { symbol: currentPlayerSymbol });
    io.emit("gameReset");
  });

  socket.on("disconnect", () => {
    console.log("Client déconnecté", socket.id);
    delete players[socket.id];
    if (socket.id === currentPlayerId) {
      currentPlayerId = Object.keys(players)[0] || null; // Choisir un nouveau joueur au hasard
    }
  });
});

server.listen(PORT, () => {
  console.log(`Serveur en cours d'exécution sur le port ${PORT}`);
});
