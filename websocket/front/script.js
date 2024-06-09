let currentRoom = "";
let socketid = "";
let messages = {};
let currentPlayerSymbol = null;
let gameInitialized = false;
let isJoiningGame = false; // Nouvelle variable pour suivre l'état de la tentative de rejoindre une partie

const roomArea = document.querySelector("#room");
roomArea.value = "room1";

const messageArea = document.querySelector("#message");
const listMessage = document.querySelector("#list-message");
const game = document.getElementById("game");
const cells = [];
const joinButton = document.getElementById("joinButton");
const resetButton = document.getElementById("resetButton");

//const socket = io("http://localhost:3000");
const socket = io("https://websocket-egie.onrender.com");
changeRoom("room1");
socket.on("connect", () => {
  const userconnected = document.getElementById("userconnected");
  userconnected.innerHTML = `Utilisateur connecté : ${socket.id}`;
  socketid = socket.id;
});

socket.on("disconnect", () => {
  const userDisconnected = document.getElementById("userconnected");
  userDisconnected.innerHTML = `Utilisateur déconnecté : ${socket.id}`;
});

socket.on("messageHistory", (history) => {
  messages[currentRoom] = history;
  updateMessageList();
});

socket.on("message", (data) => {
  addMessage(data.room, data.message, data.userId);

  updateMessageList();
});

socket.on("usersInRoom", (users) => {
  const recipientSelect = document.getElementById("recipient");
  recipientSelect.innerHTML =
    '<option value="">Sélectionner un destinataire</option>';
  if (users) {
    users.forEach((userId) => {
      if (userId !== socket.id) {
        const option = document.createElement("option");
        option.value = userId;
        option.textContent = userId;
        recipientSelect.appendChild(option);
      }
    });
  }
});

function addMessage(room, message, userId) {
  if (!messages[room]) {
    messages[room] = [];
  }
  messages[room].push({ room: room, message: message, userId: userId });
  updateMessageList();
}

function send() {
  if (currentRoom) {
    const message = messageArea.value.trim();
    socket.emit("room", currentRoom, message);
    messageArea.value = "";
  } else {
    console.log("Veuillez d'abord rejoindre une salle");
  }
}

roomArea.addEventListener("change", (e) => {
  changeRoom(e.target.value);
});

messageArea.addEventListener("keypress", function (e) {
  if (e.key === "Enter") {
    send();
  }
});

const cards = document.querySelectorAll(".card");
cards.forEach((card) => {
  if (card.id !== "private-room-card") {
    card.addEventListener("click", (e) => {
      const room = e.currentTarget.getAttribute("data-room");
      if (room !== currentRoom) {
        changeRoom(room);
      }
    });
  }
});

function changeRoom(newRoom) {
  if (currentRoom) {
    socket.emit("leave", currentRoom);
  }
  socket.emit("join", newRoom);
  currentRoom = newRoom;
  roomArea.value = newRoom;
  document.querySelector(".data").textContent =
    "Vous êtes dans le salon: " + newRoom;
  updateMessageList(newRoom);
  isJoiningGame = false;
}

function sendPrivateMessage(recipientId, salon) {
  if (currentRoom && recipientId) {
    const message = messageArea.value;
    if (message.trim() !== "") {
      socket.emit("privateMessage", { recipientId, message, salon });
      messageArea.value = "";
    } else {
      console.log("Veuillez saisir un message");
    }
  } else {
    console.log(
      "Veuillez d'abord rejoindre une salle et sélectionner un destinataire"
    );
  }
}

let privateMessageCount = 0;
const privateMessageList = document.getElementById("private-message-list");

function updatePrivateMessages(data) {
  privateMessageCount++;
  updatePrivateMessageCount();

  const messageItem = document.createElement("li");
  messageItem.textContent = `From: ${data.senderId}, Message: ${data.message}`;

  messageItem.addEventListener("click", () => {
    document.getElementById("recipientId").value = data.senderId;
    document.getElementById("replyMessageArea").focus(); // Met le focus sur la zone de réponse
  });
  privateMessageList.appendChild(messageItem);
}

function updatePrivateMessageCount() {
  const privateMessageCountElement = document.getElementById(
    "private-message-count"
  );
  privateMessageCountElement.textContent =
    "Nombre de messages : " + privateMessageCount;
}

socket.on("privateMessage", (data) => {
  if (data.salon === "private") {
    updatePrivateMessages(data);
  }
});

function updateMessageList() {
  listMessage.innerHTML = "";
  if (messages[currentRoom]) {
    messages[currentRoom].forEach(function (message) {
      if (!message.salon || message.salon !== "private") {
        var listItem = document.createElement("li");

        listItem.textContent =
          "Salon: " +
          currentRoom +
          ", utilisateur: " +
          message.userId +
          ", Message: " +
          message.message;
        listMessage.appendChild(listItem);
      }
    });
  }
}

socket.on("updateUsersList", (users) => {
  const recipientSelect = document.getElementById("recipient");
  recipientSelect.innerHTML =
    '<option value="">Sélectionner un destinataire</option>';
  users.forEach((userId) => {
    if (userId !== socket.id) {
      const option = document.createElement("option");
      option.value = userId;
      option.textContent = userId;
      recipientSelect.appendChild(option);
    }
  });
});

socket.on("join", (room) => {
  if (socket.room) {
    socket.leave(socket.room);
  }
  socket.join(room);
  socket.room = room;
  socket.emit("requestMessageHistory", room);
});

// Gestion du jeu Puissance 4
function initializeGame() {
  console.log("Initializing game");
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 7; j++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = i;
      cell.dataset.column = j;
      cell.addEventListener("click", () => {
        const row = parseInt(cell.dataset.row);
        const column = parseInt(cell.dataset.column);
        socket.emit("play", { row, column });
      });
      game.appendChild(cell);
      cells.push(cell);
    }
  }

  joinButton.addEventListener("click", () => {
    isJoiningGame = true;
    socket.emit("join");
    joinButton.disabled = true;
  });

  resetButton.addEventListener("click", () => {
    socket.emit("reset");
  });

  gameInitialized = true;
}

initializeGame();

socket.on("init", (data) => {
  if (!currentPlayerSymbol) {
    currentPlayerSymbol = data.symbol;
    const playerName = document.getElementById("playerName");
    const player = currentPlayerSymbol === "R" ? "Joueur 1" : "Joueur 2";
    playerName.textContent = `Vous êtes le ${player}.`;
    if (!gameInitialized) {
      alert(`Vous êtes le ${player}`);
    }
  } else {
    console.log(
      `Vous êtes déjà le ${
        currentPlayerSymbol === "R" ? "Joueur 1" : "Joueur 2"
      }`
    );
  }
});

socket.on("full", () => {
  if (isJoiningGame) {
    alert("La partie est pleine. Réessayez plus tard.");
    isJoiningGame = false;
  }
});

socket.on("init", (data) => {
  console.log("Received init event:", data);
});

socket.on("play", (data) => {
  const { row, column, symbol } = data;
  const index = row * 7 + column;
  cells[index].classList.add(symbol);
});
window.addEventListener("beforeunload", () => {
  socket.emit("playerReload", socket.id);
  socket.emit("reset");
});

const disconnectButton = document.getElementById("disconnectButton");

disconnectButton.addEventListener("click", () => {
  socket.emit("leave-game");
});

document.addEventListener("DOMContentLoaded", function () {
  const joinButton = document.getElementById("joinButton");
  joinButton.addEventListener("click", () => {
    socket.emit("join-game");
  });
 
  socket.on("player-connected", (data) => {
    const playerId = data;
    const playersList = document.getElementById("presentPlayers");

    if (playersList) {
      const playerItem = document.createElement("li");
      playerItem.textContent = `Joueur ID: ${playerId}`;
      playerItem.id = `player-${playerId}`;
      playersList.appendChild(playerItem);
    }
  });

  socket.on("player-disconnected", (data) => {
    const playerId = data.playerId;
    const playerElement = document.getElementById(`player-${playerId}`);
    if (playerElement) {
      playerElement.remove();
    }
    const playersList = document.getElementById("presentPlayers");
    if (playersList) {
      const message = document.createElement("li");
      message.textContent = `Le joueur avec l'ID ${playerId} a quitté la partie`;
      playersList.appendChild(message);
      cells.forEach((cell) => {
        cell.classList.remove("R", "Y");
      });
    }
    joinButton.disabled = false;
  });
});

socket.on("win", (data) => {
  alert(`Le joueur ${data.symbol} a gagné !`);
});

socket.on("reset", () => {
  cells.forEach((cell) => {
    cell.classList.remove("R", "Y");
  });
});
