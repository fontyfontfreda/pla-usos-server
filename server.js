const express = require('express');
const cors = require('cors');
const routes = require('./routes/routes');
const connectDB = require('./models/db');  // Importar la funció de connexió a la base de dades
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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
