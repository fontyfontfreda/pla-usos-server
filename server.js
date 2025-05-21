const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes/routes');
const connectDB = require('./models/db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Permet fins a 50 MB per JSON i formularis
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(cors());

// Exposa públicament la carpeta d’imatges
app.use('/imatges', express.static(path.join('C:/Users/AIT/Documents/IMATGES')));

// Rutes de l'API
app.use('/api', routes);

connectDB()
  .then(() => {
    console.log(`🚀 Connexió a la base de dades establerta amb èxit!`);
    app.listen(PORT, () => {
      console.log(`🚀 Backend executant-se a http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Error al connectar-se a la base de dades:', err);
    process.exit(1);
  });
