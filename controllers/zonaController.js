const db = require('../models/db');

const getZones = async (req, res) => {
  try {
    // Consulta per obtenir totes les zones
    const [rows] = await db.promise().query('SELECT z.codi AS codi_zona, z.descripcio AS descripcio_zona, (SELECT CONCAT(ez.codi, \'.\', ea.codi) FROM ecpu_area_tractament ea JOIN pla_usos.ecpu_zona ez on ez.id = ea.id_zona WHERE ea.id = a.id) as codi_area, a.descripcio AS descripcio_area FROM ecpu_zona z LEFT JOIN ecpu_area_tractament a on z.id = a.id_zona');

    // Si no hi ha resultats, retornem un error 404
    if (rows.length === 0) {
      return res.status(404).send('No s\'han trobat zones ni àrees');
    }

    // Agrupar les dades per zona
    const result = [];
    rows.forEach(row => {
      // Comprovar si la zona ja existeix al resultat
      let zona = result.find(z => z.codi_zona === row.codi_zona);

      // Si no existeix, la creem
      if (!zona) {
        zona = {
          codi_zona: row.codi_zona,
          descripcio_zona: row.descripcio_zona,
          arees: []
        };
        result.push(zona);
      }

      // Si hi ha àrea, afegim-la a la zona
      if (row.codi_area && row.descripcio_area) {
        zona.arees.push({
          codi_area: row.codi_area,
          descripcio_area: row.descripcio_area
        });
      }
    });

    // Retornem les dades agrupades
    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error obtenint les zones/arees:', error);
    res.status(500).send('❌ Error en obtenir les zones/arees');
  }
};

const createZona = async (req, res) => {
  try {
    const { zona } = req.body.zona; // Rebem la zona en format {codi_zona: 0, descripcio_zona: '', arees: []}

    if (!zona) {
      return res.status(400).send('Falten dades: zona');
    }

    // Executa la consulta per inserir la zona
    const [result] = await db.promise().query(
      'INSERT INTO ecpu_zona (codi, descripcio) VALUES (?, ?)',
      [zona.codi_zona, zona.descripcio_zona]
    );

    if (result.affectedRows === 0) {
      return res.status(404).send('No s\'ha pogut crear la zona');
    }

    res.status(200).send('Zona creada correctament');
  } catch (error) {
    console.error('❌ Error creant la zona:', error);
    res.status(500).send('Error al crear la zona');
  }
};

const createArea = async (req, res) => {
  try {
    const { area } = req.body.area; // Rebem l'area' en format {codi_area: 0, descripcio_area: ''}

    if (!area) {
      return res.status(400).send('Falten dades: area');
    }

    // Consulta per obtenir totes les zones
    const [rows] = await db.promise().query('SELECT z.id FROM ecpu_zona z WHERE z.codi = ?',
      [+area.codi_area.split(".")[0]]
    );
    
    // Si no hi ha resultats, retornem un error 404
    if (rows.length === 0) {
      return res.status(404).send('No s\'ha trobat la zona');
    } 
    
    // Executa la consulta per inserir l'àrea
    const [result] = await db.promise().query(
      'INSERT INTO ecpu_area_tractament (id_zona, codi, descripcio) VALUES (?, ?, ?)',
      [rows[0].id, +area.codi_area.split(".")[1], area.descripcio_area]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).send('No s\'ha pogut crear l\'àrea');
    }
    
    res.status(200).send('Àrea creada correctament');
  } catch (error) {
    console.error('❌ Error creant l\'àrea:', error);
    res.status(500).send('Error al crear l\'àrea');
  }
};

const deleteZona = async (req, res) => {
  try {
    const { codi_zona } = req.body; // Rebem el codi en format "1"

    if (!codi_zona) {
      return res.status(400).send('Falten dades: codi_zona');
    }

    if (isNaN(codi_zona)) {
      return res.status(400).send('El codi ha de ser numèric');
    }

    // Executa la consulta per eliminar la zona
    const [result] = await db.promise().query(
      'DELETE FROM ecpu_zona WHERE codi = ?',
      [codi_zona]
    );

    if (result.affectedRows === 0) {
      return res.status(404).send('No s\'ha trobat zona especificada');
    }

    res.status(200).send('Zona eliminada correctament');
  } catch (error) {
    console.error('❌ Error eliminant la zona:', error);
    if (error.errno == 1451)
      res.status(500).send('No s\'ha pogut eliminar, hi han activitats amb condicions o àrees relacionades amb aquesta zona');
    else
      res.status(500).send('Error en eliminar la zona');
  }
};

const deleteArea = async (req, res) => {
  try {
    const { codi_area } = req.body; // Rebem el codi en format "1.5"

    if (!codi_area || typeof codi_area !== 'string' || !codi_area.includes('.')) {
      return res.status(400).send('Format incorrecte. Ha de ser "codi_zona.codi_area"');
    }

    // Separem el codi en codi_zona i codi_area
    const [codiZona, codiArea] = codi_area.split('.');

    if (!codiZona || !codiArea) {
      return res.status(400).send('Falten dades: codi_zona o codi_area');
    }

    // Convertim a números per evitar errors a la base de dades
    const zona = parseInt(codiZona, 10);
    const area = parseInt(codiArea, 10);

    if (isNaN(zona) || isNaN(area)) {
      return res.status(400).send('Els codis han de ser numèrics');
    }

    // Consulta per obtenir l'id de la zona
    const [rows] = await db.promise().query('SELECT z.id FROM ecpu_zona z WHERE z.codi = ?',
      [zona]
    );

    // Si no hi ha resultats, retornem un error 404
    if (rows.length === 0) {
      return res.status(404).send('No s\'ha trobat la zona');
    }     

    // Executa la consulta per eliminar l'àrea
    const [result] = await db.promise().query(
      'DELETE FROM ecpu_area_tractament WHERE codi = ? AND id_zona = ?',
      [area, rows[0].id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).send('No s\'ha trobat l\'àrea o la zona especificada');
    }

    res.status(200).send('Àrea eliminada correctament');
  } catch (error) {
    console.error('❌ Error eliminant l\'àrea:', error);
    if (error.errno == 1451)
      res.status(500).send('No s\'ha pogut eliminar, hi han activitats amb condicions relacionades amb aquesta àrea');
    else
      res.status(500).send('Error en eliminar l\'àrea');
  }
};


module.exports = {
  getZones, deleteArea, deleteZona, createZona, createArea
};
