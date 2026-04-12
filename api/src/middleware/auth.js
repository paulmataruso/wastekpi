const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // Display board read-only bypass — dashboard summary only
  if (req.path === '/summary' && req.method === 'GET' && req.baseUrl.includes('dashboard')) {
    return next();
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
