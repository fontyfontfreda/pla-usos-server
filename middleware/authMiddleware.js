const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', ''); // El token es passa com a "Bearer token"

  if (!token) {
    return res.status(403).send('Accés prohibit. No s\'ha trobat cap token');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    req.user = decoded; // Afegim la informació decodificada a la sol·licitud
    next(); // Continuar amb la petició
  } catch (error) {
    res.status(401).send('Token invàlid o caducat');
  }
};

module.exports = { verifyToken };
