const express = require("express");
const cors = require("cors");
const path = require("path");
const routes = require("./routes/routes");
const connectDB = require("./models/db");
const isServer = process.env.IS_SERVER === 'true';

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
if (isServer) {
  const https = require("https");
  const fs = require("fs");

  https
    .createServer(
      {
        cert: fs.readFileSync("ssl/certificate.crt"),
        key: fs.readFileSync("ssl/certificate.key"),
      },
      app.get("/", (req, res) => {
        res.writeHead(200);
        res.end("Hello from Node!\n");
      }),
    )
    .listen(3443);
}

// Permet fins a 50 MB per JSON i formularis
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use(cors());

// Exposa públicament la carpeta d’imatges
app.use("/imatges", express.static(path.join(process.env.IMATGE_RUTA)));

// Rutes de l'API
app.use("/api", routes);

connectDB()
  .then(() => {
    console.log(`🚀 Connexió a la base de dades establerta amb èxit!`);
    app.listen(PORT, () => {
      console.log(`🚀 Backend executant-se a https://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Error al connectar-se a la base de dades:", err);
    process.exit(1);
  });
