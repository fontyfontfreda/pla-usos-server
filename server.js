const express = require('express');
const cors = require('cors');
const routes = require('./routes/routes');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api', routes);  // Aquí s'inclou la ruta per la càrrega de fitxers

app.listen(PORT, () => {
  console.log(`🚀 Backend executant-se a http://localhost:${PORT}`);
});
