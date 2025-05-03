const express = require('express');
const cors = require('cors');
const routes = require('./routes/routes');
const connectDB = require('./models/db');  // Importar la funció de connexió a la base de dades
require('dotenv').config();  // Carregar les variables d'entorn del fitxer .env

const app = express();
const PORT = process.env.PORT || 3000;

// Permet fins a 50 MB per JSON i formularis
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(cors());

connectDB()  // Intentar establir la connexió abans d'iniciar el servidor
  .then(() => {
    console.log(`🚀 Connexió a la base de dades establerta amb èxit!`);
    app.listen(PORT, () => {
      console.log(`🚀 Backend executant-se a http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Error al connectar-se a la base de dades:', err);
    process.exit(1);  // Finalitzar l'aplicació si no es pot establir la connexió
  });

// Rutes de l'API
app.use('/api', routes);
