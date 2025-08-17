const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Canvas size
const WIDTH = 500;
const HEIGHT = 500;

// Initialize empty canvas (2D array of hex colors)
let canvas = Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, () => "#FFFFFF"));

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
  console.log("Yeni kullanıcı bağlandı!");

  // Send current canvas to the new client
  socket.emit("init", canvas);

  // Handle pixel placement
  socket.on("placePixel", ({ x, y, color }) => {
    if (!Number.isInteger(x) || !Number.isInteger(y)) return;
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
    if (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color)) return;

    canvas[y][x] = color;
    io.emit("updatePixel", { x, y, color });
  });

  socket.on("disconnect", () => {
    console.log("Kullanıcı ayrıldı");
  });
});

server.listen(PORT, () => {
  console.log(`Server çalışıyor: http://localhost:${PORT}`);
});