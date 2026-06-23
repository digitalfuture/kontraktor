import express from 'express';

const app = express();
const apiRouter = express.Router();
apiRouter.get('/logout', (req, res) => {
  res.json({ ok: true, path: '/api/auth/logout' });
});

app.use('/api/auth', apiRouter);

const server = app.listen(3099, () => {
  console.log('test server on 3099');
});