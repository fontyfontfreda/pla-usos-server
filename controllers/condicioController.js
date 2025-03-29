const xlsx = require('xlsx');
const db = require('../models/db');

const processUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No s\'ha proporcionat cap fitxer');
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    for (const row of data) {
      if (!row || row.length < 4 || !row[0]) continue; 

      const codiParts = row[0].toString().split('.');

      let idDescripcioActivitat = null;

      idDescripcioActivitat = (
        await db.promise().query(
          'SELECT da.id FROM ecpu_grup_activitat ga JOIN ecpu_subgrup_activitat sa on ga.codi = sa.codi_grup_activitat JOIN ecpu_descripcio_activitat da on sa.id = da.id_subgrup_activitat WHERE ga.codi = ? AND sa.codi = ? AND da.codi = ?',
          [codiParts[0], codiParts[1], codiParts[2]]
        )
      )[0][0]?.id;

      if (idDescripcioActivitat) {
        for (let index = 2; index <= 12; index++) {
          const condicions = row[index].toString().split('-');
          for (const condicio of condicions) {
            let condicioId = condicio.replace(/\s+/g, "");
            let valor = "";
            
            if (condicioId.length > 3) {
              const match = condicioId.match(/(\d+)\((\d+)\)/);
              if (match) {
                condicioId = match[1];
                valor = match[2];
              }
            }

            const zones = {
              2: 1,
              9: 2,
              11: 3,
              12: 4
            };

            const arees = {
              3: 1,
              4: 2,
              5: 3,
              6: 4,
              7: 5,
              8: 6,
              10: 7
            };

            if (index == 2 || index == 9 || index == 11 || index == 12) {
              await db.promise().query(
                'INSERT INTO ecpu_zona_activitat_condicio (zona_id, descripcio_activitat_id, condicio_id, valor) VALUES (?, ?, ?, ?)',
                [zones[index], idDescripcioActivitat, condicioId, valor == "" ? null : valor]
              );
            } else {
              await db.promise().query(
                'INSERT INTO ecpu_area_activitat_condicio (area_id, descripcio_activitat_id, condicio_id, valor) VALUES (?, ?, ?, ?)',
                [arees[index], idDescripcioActivitat, condicioId, valor == "" ? null : valor]
              );
            }
          }
        }
      }
    }
    res.send('✅ Dades importades correctament');
  } catch (error) {
    console.error('❌ Error processant l\'Excel:', error);
    res.status(500).send('❌ Error en processar el fitxer');
  }
};

module.exports = {
  processUpload
};
