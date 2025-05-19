require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "intruder-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

// Database simulation (replace with real DB in production)
const DB_FILE = "intruders.json";

function readDatabase() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE)) || [];
  } catch {
    return [];
  }
}

function writeDatabase(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// API endpoints
app.post("/api/intruders", upload.single("image"), async (req, res) => {
  try {
    const { ip, location, city, country, attempts } = req.body;

    if (!ip || !location) {
      return res.status(400).json({ error: "IP and location are required" });
    }

    const intruderData = {
      id: Date.now().toString(),
      ip,
      location,
      city: city || "",
      country: country || "",
      attempts: parseInt(attempts) || 1,
      timestamp: new Date().toISOString(),
      imagePath: req.file ? req.file.path.replace(/\\/g, "/") : null,
    };

    const intruders = readDatabase();
    intruders.push(intruderData);
    writeDatabase(intruders);

    res.status(201).json(intruderData);
  } catch (error) {
    console.error("Error saving intruder:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/intruders", (req, res) => {
  try {
    const intruders = readDatabase();
    res.json(intruders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/intruders/:id", (req, res) => {
  try {
    const { id } = req.params;
    let intruders = readDatabase();

    const index = intruders.findIndex((i) => i.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Intruder not found" });
    }

    // Remove image file if exists
    if (intruders[index].imagePath) {
      try {
        fs.unlinkSync(intruders[index].imagePath);
      } catch (err) {
        console.error("Error deleting image:", err);
      }
    }

    intruders = intruders.filter((i) => i.id !== id);
    writeDatabase(intruders);

    res.json({ message: "Intruder deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve static files
app.use("/uploads", express.static("uploads"));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Upload directory: ${path.join(__dirname, "uploads")}`);
});
