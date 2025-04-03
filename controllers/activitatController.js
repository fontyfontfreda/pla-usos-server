const db = require('../models/db');

const getActivitats = async (req, res) => {
  try {
    // Consulta per saber si l'adreça pertany a una area
    const [rows] = await db.promise().query('SELECT a.zona_id, a.area_tractament_id FROM ecpu_adreca a WHERE a.DOMCOD = ?', [req.params.domcod]);

    condicions = [];

    // Si no hi ha resultats, retornem un error 404
    if (rows.length === 0) {
      return res.status(404).send('No s\'ha trobat l\'adreça');
    }else {
        if (rows[0].area_tractament_id === null){
            // L'adreça no pertany a cap àrea, fem cerca de condicions per zona
            [condicions] = await db.promise().query('SELECT ga.codi AS codi_grup, ga.descripcio AS descripcio_grup, sa.codi AS codi_subgrup, sa.descripcio AS descripcio_subgrup, da.codi AS codi_descripcio_activitat, da.descripcio AS descripcio_descripcio_activitat, c.id AS id_condicio, zac.valor AS valor_condicio, c.descripcio AS condicio FROM ecpu_zona_activitat_condicio zac JOIN pla_usos.ecpu_condicio c on zac.condicio_id = c.id JOIN pla_usos.ecpu_descripcio_activitat da on zac.descripcio_activitat_id = da.id JOIN pla_usos.ecpu_subgrup_activitat sa on da.id_subgrup_activitat = sa.id JOIN pla_usos.ecpu_grup_activitat ga on sa.codi_grup_activitat = ga.codi WHERE zona_id = ?', [rows[0].zona_id]);
        } else{
            // L'adreça pertany a una àrea, fem cerca de condicions per àrea
            [condicions] = await db.promise().query('SELECT ga.codi AS codi_grup, ga.descripcio AS descripcio_grup, sa.codi AS codi_subgrup, sa.descripcio AS descripcio_subgrup, da.codi AS codi_descripcio_activitat, da.descripcio AS descripcio_descripcio_activitat, c.id AS id_condicio, aac.valor AS valor_condicio, c.descripcio AS condicio FROM ecpu_area_activitat_condicio aac JOIN pla_usos.ecpu_condicio c on aac.condicio_id = c.id JOIN pla_usos.ecpu_descripcio_activitat da on aac.descripcio_activitat_id = da.id JOIN pla_usos.ecpu_subgrup_activitat sa on da.id_subgrup_activitat = sa.id JOIN pla_usos.ecpu_grup_activitat ga on sa.codi_grup_activitat = ga.codi WHERE aac.area_id = ?', [rows[0].area_tractament_id]);
        }
    }

    // Retornem les dades de les adreces
    res.status(200).json(condicions);
  } catch (error) {
    console.error('❌ Error obtenint les activitats:', error);
    res.status(500).send('❌ Error en obtenir les activitats');
  }
};

module.exports = {
    getActivitats
};
