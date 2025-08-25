const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bodyParser = require("body-parser");
const Iyzipay = require("iyzipay");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Iyzipay client
const iyzipay = new Iyzipay({
  apiKey: process.env.IYZI_API_KEY || "sandbox-LMP0QYqbwhGBzlPwbi4v8K2JDQOZnjBr",
  secretKey: process.env.IYZI_SECRET_KEY || "sandbox-YuP05RzF68VN4wyHFfdY4ViDOEAxvx1t",
  uri: process.env.IYZI_URI || "https://sandbox-api.iyzipay.com"
});

// Canvas size
const WIDTH = 500;
const HEIGHT = 500;

// Initialize empty canvas (2D array of hex colors)
let canvas = Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, () => "#FFFFFF"));

// Body parsers
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

// 3DS: Checkout initialize
app.post("/checkout", (req, res) => {
  const { cardNumber, expireMonth, expireYear, cvc } = req.body || {};

  const clientIpHeader = req.headers["x-forwarded-for"] || req.headers["x-real-ip"];
  const clientIp = Array.isArray(clientIpHeader)
    ? clientIpHeader[0]
    : (clientIpHeader || req.socket.remoteAddress || "").toString().split(",")[0].trim();

  const request = {
    locale: Iyzipay.LOCALE.TR,
    conversationId: "123456789",
    price: "1.00",
    paidPrice: "1.00",
    currency: Iyzipay.CURRENCY.TRY,
    basketId: "B12345",
    paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
    callbackUrl: `${process.env.PUBLIC_URL || `http://localhost:${PORT}`}/callback`,
    paymentCard: {
      cardHolderName: "John Doe",
      cardNumber,
      expireMonth,
      expireYear,
      cvc,
      registerCard: "0"
    },
    buyer: {
      id: "BY789",
      name: "John",
      surname: "Doe",
      identityNumber: "11111111111",
      email: "email@example.com",
      gsmNumber: "+905555555555",
      registrationDate: "2023-01-01 00:00:00",
      lastLoginDate: "2023-01-01 00:00:00",
      registrationAddress: "Test Address",
      city: "Istanbul",
      country: "Turkey",
      zipCode: "34000",
      ip: clientIp
    },
    shippingAddress: {
      contactName: "John Doe",
      city: "Istanbul",
      country: "Turkey",
      address: "Test Address",
      zipCode: "34000"
    },
    billingAddress: {
      contactName: "John Doe",
      city: "Istanbul",
      country: "Turkey",
      address: "Test Address",
      zipCode: "34000"
    },
    basketItems: [
      {
        id: "BI101",
        name: "Test Product",
        category1: "Test",
        itemType: Iyzipay.BASKET_ITEM_TYPE.PHYSICAL,
        price: "1.00"
      }
    ]
  };

  iyzipay.threedsInitialize.create(request, (err, result) => {
    if (err) {
      console.error("3DS initialize error:", err);
      return res.status(500).json(err);
    }

    if (result && result.status === "success") {
      const htmlContent = Buffer.from(result.threeDSHtmlContent || "", "base64").toString();
      return res.send(htmlContent);
    }

    console.error("3DS initialize failed:", result);
    return res.status(400).json(result);
  });
});

// 3DS: Callback finalize
app.post("/callback", (req, res) => {
  const { paymentId, conversationData } = req.body || {};

  if (!paymentId) {
    console.error("paymentId eksik");
    return res.status(400).send("paymentId eksik");
  }

  const finalizeRequest = {
    locale: Iyzipay.LOCALE.TR,
    conversationId: "123456789",
    paymentId,
    conversationData
  };

  iyzipay.threedsPayment.create(finalizeRequest, (err, result) => {
    if (err) {
      console.error("3DS finalize error:", err);
      return res.status(500).send("Sunucu hatası");
    }

    if (result && result.status === "success") {
      console.log("Ödeme başarılı:", result.paymentStatus, result.paymentId);
      return res.send("Başarılı");
    }

    console.error("Ödeme başarısız:", result);
    return res.send("Başarısız");
  });
});

server.listen(PORT, () => {
  console.log(`Server çalışıyor: http://localhost:${PORT}`);
});