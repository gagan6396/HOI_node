// server.js
const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/connection");
const routes = require("./routes/index");

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Connect DB
connectDB();

// Routes
app.use("/v1", routes);

app.get("/", (req, res) => {
  res.send("API running");
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

const PORT = process.env.PORT || 8000;

// 👇 Change this line
app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
