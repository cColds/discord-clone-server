const express = require("express");
const http = require("http");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
app.use(
  cors({
    origin: process.env.URL,
    methods: ["GET", "POST"],
  })
);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const server = http.createServer(app);

import { Server } from "socket.io";
import { updateFriendList } from "./utils/updateFriendsList";
import { updateOnlineStatus } from "./utils/updateOnlineStatus";

const io = new Server(server, {
  cors: {
    origin: process.env.URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
  path: "/socket",
});

let activeUsers: Record<string, { username: string; socketId: string }> = {};
let socketToUserMap: Record<string, { userId: string }> = {};

io.on("connection", (socket) => {
  console.log("A user has connected", socket.id);

  socket.on("new-user-add", async (newUserId, username) => {
    const userExists = activeUsers[newUserId];

    if (!userExists) {
      activeUsers[newUserId] = { username, socketId: socket.id };
      socketToUserMap[socket.id] = { userId: newUserId };
    }

    console.log(
      `User ${username} connected. Current Active Users: `,
      activeUsers
    );

    const user = await updateOnlineStatus(newUserId, true);
    if (!user) {
      console.log("User does not exist: ", user);
      return;
    }

    io.emit("get-users", activeUsers);
    io.to(socket.id).emit("update-online-status", true);

    user.social.friends.forEach((friendId: string) => {
      const friend = activeUsers[friendId];
      if (friend) {
        socket.to(friend.socketId).emit("update-friends-online-status", true);
      }
    });
  });

  socket.on("send-friend-request", ({ senderId, recipientId }) => {
    updateFriendList({ io, senderId, recipientId, activeUsers });
  });

  socket.on("accept-friend-request", ({ senderId, recipientId }) => {
    updateFriendList({ io, senderId, recipientId, activeUsers });
  });

  socket.on("unfriend-user", ({ senderId, recipientId }) => {
    updateFriendList({ io, senderId, recipientId, activeUsers });
  });

  socket.on("cancel-pending-request", ({ senderId, recipientId }) => {
    updateFriendList({ io, senderId, recipientId, activeUsers });
  });

  socket.on("unblock-user", ({ senderId, recipientId }) => {
    updateFriendList({ io, senderId, recipientId, activeUsers });
  });

  socket.on("join-channel", (channelId) => {
    console.log("joining channel", channelId);
    socket.join(channelId);
  });

  socket.on("send-message", (channelId) => {
    io.to(channelId).emit("received-message");
  });

  socket.on(
    "typing-indicator",
    (channelId, userInfo: { userId: string; displayName: string }) => {
      socket.broadcast.to(channelId).emit("show-typing-indicator", userInfo);
    }
  );

  socket.on(
    "stop-typing",
    (channelId, userInfo: { userId: string; displayName: string }) => {
      socket.broadcast.to(channelId).emit("stop-typing-indicator", userInfo);
    }
  );

  socket.on("create-channel", (channelId) => {
    io.to(channelId).emit("create-channel");
  });

  socket.on("join-server", (userId) => {
    const user = activeUsers[userId];
    if (user.socketId) {
      io.to(user.socketId).emit("join-server");
    } else {
      console.log("Could not find user socket id", user);
    }
  });

  socket.on("create-server", (userId) => {
    const user = activeUsers[userId];

    if (user.socketId) {
      io.to(user.socketId).emit("create-server");
    } else {
      console.log("Could not find user socket id", user);
    }
  });

  socket.on("update-dms-list", (recipientId, senderId) => {
    const senderSocket = activeUsers[senderId];
    const recipientSocket = activeUsers[recipientId];

    if (recipientSocket) {
      io.to(recipientSocket.socketId).emit("update-dms-list");
    }

    if (senderSocket) {
      io.to(senderSocket.socketId).emit("update-dms-list");
    }
  });

  socket.on("disconnect", async () => {
    const userMapping = socketToUserMap[socket.id];
    if (userMapping) {
      const { userId } = userMapping;
      const user = await updateOnlineStatus(userId, false);
      delete activeUsers[userId];
      delete socketToUserMap[socket.id];
      console.log(
        `User ${user} disconnected. Current Active Users: `,
        activeUsers
      );
      io.emit("get-users", activeUsers);

      if (user) {
        user.social.friends.forEach((friendId: string) => {
          const friend = activeUsers[friendId];
          if (friend) {
            socket
              .to(friend.socketId)
              .emit("update-friends-online-status", false);
          }
        });
      }
    } else {
      console.log("User disconnected but mapping not found");
    }
  });
});

server.listen(3001, () => {
  console.log("Server listening on port 3001");
});
