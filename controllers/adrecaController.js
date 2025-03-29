const db = require('../models/db');

const getAdreces = async (req, res) => {
  try {
    // Consulta per obtenir totes les adreces
    const [rows] = await db.promise().query('SELECT * FROM ecpu_adreca');
    
    // Si no hi ha resultats, retornem un error 404
    if (rows.length === 0) {
      return res.status(404).send('No s\'han trobat adreces');
    }

    // Retornem les dades de les adreces
    res.status(200).json(rows);
  } catch (error) {
    console.error('❌ Error obtenint les adreces:', error);
    res.status(500).send('❌ Error en obtenir les adreces');
  }
};

module.exports = {
  getAdreces
};
