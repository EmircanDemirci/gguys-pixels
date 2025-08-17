const socket = io();

function showPage(pageId) {
  document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
  document.getElementById(pageId).classList.remove("hidden");
}

// Canvas setup
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

const WIDTH = 500;
const HEIGHT = 500;
const PIXEL_SIZE = 5; // size of each logical pixel

// Physical canvas size
canvas.width = WIDTH * PIXEL_SIZE;
canvas.height = HEIGHT * PIXEL_SIZE;

// Transform state
let scale = 1; // zoom factor
let offsetX = 0; // pan X in pixels
let offsetY = 0; // pan Y in pixels
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

// Board state
let board = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill("#FFFFFF"));

// Socket events
socket.on("init", (serverBoard) => {
  board = serverBoard;
  draw();
});

socket.on("updatePixel", ({ x, y, color }) => {
  if (y >= 0 && y < HEIGHT && x >= 0 && x < WIDTH) {
    board[y][x] = color;
    drawPixel(x, y, color);
  }
});

function applyTransform() {
  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
}

function clearTransformedCanvas() {
  // Clear the full visible area in world coordinates
  ctx.clearRect(-offsetX / scale, -offsetY / scale, canvas.width / scale, canvas.height / scale);
}

// Draw entire board
function draw() {
  applyTransform();
  clearTransformedCanvas();

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      ctx.fillStyle = board[y][x];
      ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    }
  }
}

// Draw a single pixel (respects current transform)
function drawPixel(x, y, color) {
  applyTransform();
  ctx.fillStyle = color;
  ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
}

// Convert screen (canvas) coordinates to world coordinates considering pan/zoom
function screenToWorld(mouseX, mouseY) {
  const worldX = (mouseX - offsetX) / scale;
  const worldY = (mouseY - offsetY) / scale;
  return { worldX, worldY };
}

// Place pixel on click
canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const { worldX, worldY } = screenToWorld(mouseX, mouseY);

  const x = Math.floor(worldX / PIXEL_SIZE);
  const y = Math.floor(worldY / PIXEL_SIZE);

  if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
    const color = "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0");
    socket.emit("placePixel", { x, y, color });
  }
});

// Zoom (mouse wheel, zoom towards cursor)
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const { worldX, worldY } = screenToWorld(mouseX, mouseY);

  const zoomFactor = 1.1;
  const zoomIn = e.deltaY < 0;
  const newScale = zoomIn ? scale * zoomFactor : scale / zoomFactor;

  // Clamp scale to reasonable bounds
  scale = Math.min(8, Math.max(0.2, newScale));

  // Keep the cursor's world point stationary
  offsetX = mouseX - worldX * scale;
  offsetY = mouseY - worldY * scale;

  draw();
});

// Pan (drag)
canvas.addEventListener("mousedown", (e) => {
  isDragging = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});

canvas.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  const dx = e.clientX - lastMouseX;
  const dy = e.clientY - lastMouseY;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  offsetX += dx;
  offsetY += dy;
  draw();
});

canvas.addEventListener("mouseup", () => {
  isDragging = false;
});
canvas.addEventListener("mouseleave", () => {
  isDragging = false;
});

// Initial draw
draw();