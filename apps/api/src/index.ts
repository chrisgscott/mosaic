import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Mosaic API' });
});

app.listen(port, () => {
  console.log(`API is running on port ${port}`);
});