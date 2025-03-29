const express = require('express');
const multer = require('multer');
const condicioController = require('../controllers/condicioController');
const adrecaController = require('../controllers/adrecaController');

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

//ADRECES
router.get('/adreces',  adrecaController.getAdreces);

//CONDICIONS
router.post('/upload', upload.single('file'), condicioController.processUpload);



module.exports = router;
