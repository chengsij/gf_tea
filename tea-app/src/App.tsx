import { useState, useEffect } from 'react'
import './App.css'
import type { Tea } from './types'
import { getTeas, createTea, deleteTea } from './api'
import { TimerProvider, useTimer } from './TimerContext'
import { Clock, Trash2, Plus } from 'lucide-react'

const TimerOverlay = () => {
  const { timeLeft, activeTeaName, stopTimer } = useTimer();

  if (timeLeft === null) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="timer-overlay">
      <Clock size={24} />
      <span>{activeTeaName}: {minutes}:{seconds.toString().padStart(2, '0')}</span>
      <button className="cancel-timer" onClick={stopTimer}>Cancel</button>
    </div>
  );
};

const TeaForm = ({ onTeaAdded }: { onTeaAdded: () => void }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [image, setImage] = useState('');
  const [steepTimes, setSteepTimes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const times = steepTimes.split(',').map(t => parseInt(t.trim())).filter(t => !isNaN(t));
    await createTea({ name, type, image, steepTimes: times });
    setName('');
    setType('');
    setImage('');
    setSteepTimes('');
    onTeaAdded();
  };

  return (
    <form className="form-container" onSubmit={handleSubmit}>
      <h3>Add New Tea</h3>
      <div className="form-group">
        <label>Name</label>
        <input value={name} onChange={e => setName(e.target.value)} required />
      </div>
      <div className="form-group">
        <label>Type (e.g. Green, Black)</label>
        <input value={type} onChange={e => setType(e.target.value)} required />
      </div>
      <div className="form-group">
        <label>Image URL</label>
        <input value={image} onChange={e => setImage(e.target.value)} required />
      </div>
      <div className="form-group">
        <label>Steep Times (seconds, comma separated)</label>
        <input value={steepTimes} onChange={e => setSteepTimes(e.target.value)} placeholder="60, 120, 180" required />
      </div>
      <button type="submit">Add Tea</button>
    </form>
  );
};

const TeaDashboard = () => {
  const [teas, setTeas] = useState<Tea[]>([]);
  const { startTimer } = useTimer();

  const fetchTeas = async () => {
    const data = await getTeas();
    setTeas(data);
  };

  useEffect(() => {
    fetchTeas();
  }, []);

  const handleDelete = async (id: string) => {
    await deleteTea(id);
    fetchTeas();
  };

  return (
    <div className="dashboard">
      <h1>Tea Steeping Dashboard</h1>
      <TeaForm onTeaAdded={fetchTeas} />
      <div className="tea-grid">
        {teas.map(tea => (
          <div key={tea.id} className="tea-card">
            <img src={tea.image} alt={tea.name} />
            <h2>{tea.name}</h2>
            <p><strong>Type:</strong> {tea.type}</p>
            <div className="steep-times">
              {tea.steepTimes.map((time, idx) => (
                <button 
                  key={idx} 
                  className="steep-time-btn"
                  onClick={() => startTimer(time, tea.name)}
                >
                  {time}s
                </button>
              ))}
            </div>
            <button 
              onClick={() => handleDelete(tea.id)}
              style={{marginTop: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#dc3545'}}
            >
              <Trash2 size={20} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

function App() {
  return (
    <TimerProvider>
      <TimerOverlay />
      <TeaDashboard />
    </TimerProvider>
  )
}

export default App