import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const app = express();
const port = 3001;
const DATA_FILE = path.join(__dirname, 'teas.yaml');

app.use(cors());
app.use(express.json());

interface Tea {
  id: string;
  name: string;
  type: string;
  image: string;
  steepTimes: number[];
}

const readTeas = (): Tea[] => {
  if (!fs.existsSync(DATA_FILE)) {
    return [];
  }
  const fileContents = fs.readFileSync(DATA_FILE, 'utf8');
  return (yaml.load(fileContents) as Tea[]) || [];
};

const writeTeas = (teas: Tea[]) => {
  const yamlStr = yaml.dump(teas);
  fs.writeFileSync(DATA_FILE, yamlStr, 'utf8');
};

app.get('/api/teas', (req, res) => {
  try {
    const teas = readTeas();
    res.json(teas);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read teas' });
  }
});

app.post('/api/teas', (req, res) => {
  try {
    const teas = readTeas();
    const newTea = { ...req.body, id: Date.now().toString() };
    teas.push(newTea);
    writeTeas(teas);
    res.status(201).json(newTea);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save tea' });
  }
});

app.delete('/api/teas/:id', (req, res) => {
  try {
    const teas = readTeas();
    const filteredTeas = teas.filter(t => t.id !== req.params.id);
    writeTeas(filteredTeas);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete tea' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
