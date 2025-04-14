const db = require('../models/db');

const getActivitats = async (req, res) => {
  try {
    // Consulta per saber si l'adreça pertany a una area
    const [rows] = await db.promise().query('SELECT a.zona_id, a.area_tractament_id FROM ecpu_adreca a WHERE a.DOMCOD = ?', [req.params.domcod]);

    condicions = [];

    // Si no hi ha resultats, retornem un error 404
    if (rows.length === 0) {
      return res.status(404).send('No s\'ha trobat l\'adreça');
    } else {
      if (rows[0].area_tractament_id === null) {
        // L'adreça no pertany a cap àrea, fem cerca de condicions per zona
        [condicions] = await db.promise().query('SELECT ga.codi AS codi_grup, ga.descripcio AS descripcio_grup, sa.codi AS codi_subgrup, sa.descripcio AS descripcio_subgrup, da.id AS codi_descripcio_activitat, da.descripcio AS descripcio_descripcio_activitat, c.id AS id_condicio, zac.valor AS valor_condicio, c.descripcio AS condicio FROM ecpu_zona_activitat_condicio zac JOIN pla_usos.ecpu_condicio c on zac.condicio_id = c.id JOIN pla_usos.ecpu_descripcio_activitat da on zac.descripcio_activitat_id = da.id JOIN pla_usos.ecpu_subgrup_activitat sa on da.id_subgrup_activitat = sa.id JOIN pla_usos.ecpu_grup_activitat ga on sa.codi_grup_activitat = ga.codi WHERE zona_id = ?', [rows[0].zona_id]);
      } else {
        // L'adreça pertany a una àrea, fem cerca de condicions per àrea
        [condicions] = await db.promise().query('SELECT ga.codi AS codi_grup, ga.descripcio AS descripcio_grup, sa.codi AS codi_subgrup, sa.descripcio AS descripcio_subgrup, da.id AS codi_descripcio_activitat, da.descripcio AS descripcio_descripcio_activitat, c.id AS id_condicio, aac.valor AS valor_condicio, c.descripcio AS condicio FROM ecpu_area_activitat_condicio aac JOIN pla_usos.ecpu_condicio c on aac.condicio_id = c.id JOIN pla_usos.ecpu_descripcio_activitat da on aac.descripcio_activitat_id = da.id JOIN pla_usos.ecpu_subgrup_activitat sa on da.id_subgrup_activitat = sa.id JOIN pla_usos.ecpu_grup_activitat ga on sa.codi_grup_activitat = ga.codi WHERE aac.area_id = ?', [rows[0].area_tractament_id]);
      }
    }

    // Retornem les dades de les adreces
    res.status(200).json(condicions);
  } catch (error) {
    console.error('❌ Error obtenint les activitats:', error);
    res.status(500).send('❌ Error en obtenir les activitats');
  }
};

const consultaActivitat = async (req, res) => {
  try {
    const { dades } = req.body.dades;

    const usuari = dades.usuari;
    const adreca = dades.adreca;
    const activitat = dades.activitat;

    // Executa la consulta per inserir la cosulta a la bdd
    const [result] = await db.promise().query(
      'INSERT INTO ecpu_consulta (DNI_interessat, nom_interessat, actuacio_interessat, DOMCOD, activitat_id, is_altres, descripcio_altres) VALUES (?,?,?,?,?,?,?)',
      [usuari.dni, usuari.nom, usuari.actuaComA, adreca.DOMCOD, !activitat.is_altres ? activitat.codi_descripcio_activitat : 1, activitat.is_altres, !activitat.is_altres ? null : activitat.descripcio_activitat]
    );

    if (result.affectedRows === 0) {
      return res.status(404).send('No s\'ha pogut crear la consulta');
    }

    if (activitat.is_altres) {
      // Enviar correu a consorci
      
    } else {
      let is_apte;
      // Mirar condicions
      switch (activitat.id_condicio) {
        case 1:
          is_apte = false;
          break;
        case 2:
          is_apte = true;
          break;
        case 3:
          is_apte = true;
          break;
        case 4:
          
          break;
        case 5:
          
          break;
        case 6:
          
          break;
        case 7:
          is_apte = dades.adreca.amplada_carrer >= dades.activitat.valor_condicio;
          break;
        case 8:
          
          break;
        case 9:
          is_apte = dades.adreca.pis == +1;
          break;
        case 10:
          
          break;
        case 11:
          
          break;
      
        default:
          break;
      }
        generarPDF();
    }

    res.status(200).send('Zona creada correctament');
  } catch (error) {
    console.error('❌ Error creant la zona:', error);
    res.status(500).send('Error al crear la zona');
  }
};

function generarPDF() {
  
}

module.exports = {
  getActivitats, consultaActivitat
};
