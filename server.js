const express = require("express");
const http = require("http");
const { Server } = require("socket.io");


const app = express();
const server = http.createServer(app);
const io = new Server(server);

//PORT
const PORT = 3000;

//canvas boyutu
const WIDTH = 500;
const HEIGHT = 500;

//boş canvas
let canvas = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill("#FFFFFF"));

//Static dosyaları
app.use(express.static("public"));

//Client bağlandığında
io.on("connection", (socket) => {
    console.log("Yeni kullanıcı bağlandı!");

    //kullanıcıya mevcut canvas gösteriliyor
    socket.emit("init", canvas);

    //Kullanıcı pixel değiştirdiğinde
    socket.on("placePixel", ({ x, y, color }) => {
        if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
            canvas[y][x] = color;
            // Herkese güncelleme yay
            io.emit("updatePixel", { x, y, color });
        }
    });


})

server.listen(PORT, () => {
    console.log(`Server çalışıyor: http://localhost:${PORT}`);
});