const express = require('express');
const multer = require('multer');
const condicioController = require('../controllers/condicioController');
const adrecaController = require('../controllers/adrecaController');
const zonaController = require('../controllers/zonaController');

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

//ADRECES
router.get('/adreces',  adrecaController.getAdreces);

//CONDICIONS
router.post('/upload', upload.single('file'), condicioController.processUpload);

//ZONES/ÀREES
router.get('/zones', zonaController.getZones);
router.delete('/zones/area', zonaController.deleteArea);
router.delete('/zones/zona', zonaController.deleteZona);



module.exports = router;
