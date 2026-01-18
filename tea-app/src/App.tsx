import { useState, useEffect } from 'react'
import './App.css'
import type { Tea } from './types'
import { getTeas, createTea, deleteTea, importTeaFromUrl } from './api'
import { TimerProvider, useTimer } from './TimerContext'
import { Clock, Trash2, Plus, X, Search, Coffee, ExternalLink } from 'lucide-react'

const TimerOverlay = () => {
  const { timeLeft, activeTeaName, stopTimer } = useTimer();

  if (timeLeft === null) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="timer-overlay">
      <div className="timer-info">
        <Clock size={24} className="text-primary" />
        <span>{activeTeaName}</span>
        <span style={{fontVariantNumeric: 'tabular-nums'}}>{minutes}:{seconds.toString().padStart(2, '0')}</span>
      </div>
      <button className="cancel-timer" onClick={stopTimer}>Stop</button>
    </div>
  );
};

const SidePanel = ({
  tea,
  onClose,
  usedSteepTimes,
  onSteepTimeClick,
  onResetUsed
}: {
  tea: Tea;
  onClose: () => void;
  usedSteepTimes: Set<number>;
  onSteepTimeClick: (idx: number, time: number, teaName: string) => void;
  onResetUsed: () => void;
}) => {
  return (
    <div className="side-panel">
      <div className="side-panel-header">
        <h2>{tea.name}</h2>
        <button onClick={onClose} className="close-btn">
          <X size={20} />
        </button>
      </div>

      <div className="side-panel-content">
        <img src={tea.image} alt={tea.name} className="side-panel-image" />

        <div className="side-panel-info">
          <div className="info-row">
            <span className="info-label">Type:</span>
            <span className="tea-type">{tea.type}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Caffeine:</span>
            <span className={`tea-caffeine ${tea.caffeineLevel.toLowerCase()}`}>
              {tea.caffeineLevel}
            </span>
          </div>
          {tea.website && (
            <div className="info-row">
              <a href={tea.website} target="_blank" rel="noopener noreferrer" className="website-link">
                <ExternalLink size={16} /> Visit Website
              </a>
            </div>
          )}
        </div>

        <div className="steep-times-section">
          <h3>Steep Times</h3>
          <div className={`steep-times ${tea.steepTimes.length >= 6 ? 'steep-times-many' : ''}`}>
            {tea.steepTimes.map((time, idx) => (
              <button
                key={idx}
                className={`steep-time-btn ${usedSteepTimes.has(idx) ? 'used' : ''}`}
                onClick={() => onSteepTimeClick(idx, time, tea.name)}
              >
                {time}s
              </button>
            ))}
          </div>
          {usedSteepTimes.size > 0 && (
            <button className="btn-reset-used" onClick={onResetUsed}>
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const TeaForm = ({ onTeaAdded, onClose }: { onTeaAdded: () => void, onClose: () => void }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [image, setImage] = useState('');
  const [steepTimes, setSteepTimes] = useState('');
  const [caffeine, setCaffeine] = useState('');
  const [caffeineLevel, setCaffeineLevel] = useState<'Low' | 'Medium' | 'High'>('Low');
  const [website, setWebsite] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const times = steepTimes.split(',').map(t => parseInt(t.trim())).filter(t => !isNaN(t));
    await createTea({
      name,
      type,
      image,
      steepTimes: times,
      caffeine,
      caffeineLevel,
      website
    });
    onTeaAdded();
    onClose();
  };

  const handleImport = async () => {
    if (!importUrl) return;
    setIsImporting(true);
    try {
      const data = await importTeaFromUrl(importUrl);
      setName(data.name);
      setType(data.type);
      setImage(data.image);
      setSteepTimes(data.steepTimes.join(', '));
      setCaffeine(data.caffeine || '');
      setCaffeineLevel(data.caffeineLevel as 'Low' | 'Medium' | 'High');
      setWebsite(data.website || '');
      setImportUrl('');
    } catch (error) {
      alert('Failed to import tea data.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="form-container">
        <div className="form-header">
          <h3>Add New Tea</h3>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>

        <div className="form-body">
          <div className="import-section">
            <div className="form-group">
              <label>Import from URL</label>
              <div className="input-group">
                <input 
                  value={importUrl} 
                  onChange={e => setImportUrl(e.target.value)} 
                  placeholder="https://www.teavivre.com/..." 
                />
                <button 
                  type="button" 
                  onClick={handleImport} 
                  disabled={isImporting}
                  className="btn-primary"
                  style={{minWidth: '100px'}}
                >
                  {isImporting ? '...' : 'Auto-fill'}
                </button>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="form-fields">
            <div className="form-group">
              <label>Name</label>
              <input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Dragon Well" />
            </div>
            <div className="form-group">
              <label>Type</label>
              <input value={type} onChange={e => setType(e.target.value)} required placeholder="e.g. Green" />
            </div>
            <div className="form-group">
              <label>Image URL</label>
              <input value={image} onChange={e => setImage(e.target.value)} required placeholder="https://..." />
            </div>
            <div className="form-group">
              <label>Steep Times (seconds)</label>
              <input value={steepTimes} onChange={e => setSteepTimes(e.target.value)} placeholder="60, 120, 180" required />
            </div>
            <div className="form-group">
              <label>Caffeine Content</label>
              <input value={caffeine} onChange={e => setCaffeine(e.target.value)} placeholder="e.g. 25mg or Low caffeine" required />
            </div>
            <div className="form-group">
              <label>Caffeine Level</label>
              <select value={caffeineLevel} onChange={e => setCaffeineLevel(e.target.value as 'Low' | 'Medium' | 'High')} required>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div className="form-group">
              <label>Website</label>
              <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://example.com" required />
            </div>
            <button type="submit" className="btn-primary" style={{marginTop: '0.5rem', width: '100%'}}>Save Tea</button>
          </form>
        </div>
      </div>
    </div>
  );
};

const TeaDashboard = () => {
  const [teas, setTeas] = useState<Tea[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedCaffeineLevel, setSelectedCaffeineLevel] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'name-asc' | 'name-desc' | 'type' | 'caffeine-asc' | 'caffeine-desc'>('date');
  const [usedSteepTimes, setUsedSteepTimes] = useState<Map<string, Set<number>>>(new Map());
  const [selectedTeaId, setSelectedTeaId] = useState<string | null>(null);
  const { startTimer } = useTimer();

  const fetchTeas = async () => {
    const data = await getTeas();
    setTeas(data);
  };

  useEffect(() => {
    fetchTeas();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this tea?')) {
      await deleteTea(id);
      setUsedSteepTimes(prev => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
      if (selectedTeaId === id) {
        setSelectedTeaId(null);
      }
      fetchTeas();
    }
  };

  const handleSteepTimeClick = (timeIdx: number, teaId: string, time: number, teaName: string) => {
    startTimer(time, teaName);
    setUsedSteepTimes(prev => {
      const newMap = new Map(prev);
      const usedSet = newMap.get(teaId) || new Set<number>();
      usedSet.add(timeIdx);
      newMap.set(teaId, usedSet);
      return newMap;
    });
  };


  const uniqueTypes = Array.from(new Set(teas.map(tea => tea.type))).sort();

  const caffeineLevelValue = (level: string) => {
    if (level === 'Low') return 1;
    if (level === 'Medium') return 2;
    if (level === 'High') return 3;
    return 0;
  };

  const filteredTeas = teas.filter(tea => {
    const matchesSearch = tea.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tea.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === null || tea.type === selectedType;
    const matchesCaffeine = selectedCaffeineLevel === null || tea.caffeineLevel === selectedCaffeineLevel;
    return matchesSearch && matchesType && matchesCaffeine;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'name-desc':
        return b.name.localeCompare(a.name);
      case 'type':
        return a.type.localeCompare(b.type);
      case 'caffeine-asc':
        return caffeineLevelValue(a.caffeineLevel) - caffeineLevelValue(b.caffeineLevel);
      case 'caffeine-desc':
        return caffeineLevelValue(b.caffeineLevel) - caffeineLevelValue(a.caffeineLevel);
      case 'date':
      default:
        return parseInt(b.id) - parseInt(a.id);
    }
  });

  useEffect(() => {
    // Close side panel if the selected tea is filtered out
    if (selectedTeaId && !filteredTeas.find(t => t.id === selectedTeaId)) {
      setSelectedTeaId(null);
    }
  }, [filteredTeas, selectedTeaId]);

  return (
    <div className="dashboard">
      <div className="header-actions">
        <div className="header-title">
          <div className="logo-icon">
            <Coffee size={24} />
          </div>
          <h1>Tea Collection</h1>
        </div>
        
        <div className="header-controls">
           <div className="search-container">
             <Search size={18} className="search-icon" />
             <input
               placeholder="Search teas..."
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
             />
           </div>
           <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="sort-select">
             <option value="date">Recently Added</option>
             <option value="name-asc">Name (A-Z)</option>
             <option value="name-desc">Name (Z-A)</option>
             <option value="type">Tea Type</option>
             <option value="caffeine-asc">Caffeine (Low to High)</option>
             <option value="caffeine-desc">Caffeine (High to Low)</option>
           </select>
           <button onClick={() => setShowForm(true)} className="btn-primary btn-add-tea">
             <Plus size={18} /> Add Tea
           </button>
        </div>
      </div>

      {showForm && <TeaForm onTeaAdded={fetchTeas} onClose={() => setShowForm(false)} />}

      <div className="filters-combined">
        <div className="filter-group">
          <button
            className={`filter-btn ${selectedType === null ? 'active' : ''}`}
            onClick={() => setSelectedType(null)}
          >
            All Types
          </button>
          {uniqueTypes.map(type => (
            <button
              key={type}
              className={`filter-btn ${selectedType === type ? 'active' : ''}`}
              onClick={() => setSelectedType(type)}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="filter-separator"></div>

        <div className="filter-group">
          <button
            className={`filter-btn ${selectedCaffeineLevel === null ? 'active' : ''}`}
            onClick={() => setSelectedCaffeineLevel(null)}
          >
            All Levels
          </button>
          <button
            className={`filter-btn ${selectedCaffeineLevel === 'Low' ? 'active' : ''}`}
            onClick={() => setSelectedCaffeineLevel('Low')}
          >
            Low
          </button>
          <button
            className={`filter-btn ${selectedCaffeineLevel === 'Medium' ? 'active' : ''}`}
            onClick={() => setSelectedCaffeineLevel('Medium')}
          >
            Medium
          </button>
          <button
            className={`filter-btn ${selectedCaffeineLevel === 'High' ? 'active' : ''}`}
            onClick={() => setSelectedCaffeineLevel('High')}
          >
            High
          </button>
        </div>
      </div>

      <div className="main-layout">
        {teas.length === 0 ? (
          <div className="empty-state">
            <h2>No teas yet</h2>
            <p>Add your first tea to get started.</p>
            <button onClick={() => setShowForm(true)} className="btn-primary" style={{marginTop: '1rem'}}>Add Tea</button>
          </div>
        ) : (
          <div className="tea-grid-container">
            <div className="tea-grid">
              {filteredTeas.map(tea => (
                <div
                  key={tea.id}
                  className={`tea-card ${selectedTeaId === tea.id ? 'selected' : ''}`}
                  onClick={() => setSelectedTeaId(tea.id)}
                >
                  <div className="tea-image-container">
                    <img src={tea.image} alt={tea.name} loading="lazy" />
                    <div className="image-buttons">
                      {tea.website && (
                        <a
                          href={tea.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-website-top"
                          title="Visit website"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={18} />
                        </a>
                      )}
                      <button
                        className="btn-delete"
                        onClick={(e) => handleDelete(tea.id, e)}
                        title="Delete Tea"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="tea-content">
                    <div className="tea-header">
                      <div className="tea-title">
                        <h2>{tea.name}</h2>
                        <div className="tea-meta">
                          <span className="tea-type">{tea.type}</span>
                          {tea.caffeineLevel && <span className={`tea-caffeine ${tea.caffeineLevel.toLowerCase()}`}>{tea.caffeineLevel} Caffeine</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedTeaId && filteredTeas.find(t => t.id === selectedTeaId) && (
          <SidePanel
            tea={filteredTeas.find(t => t.id === selectedTeaId)!}
            onClose={() => setSelectedTeaId(null)}
            usedSteepTimes={usedSteepTimes.get(selectedTeaId) || new Set()}
            onSteepTimeClick={(idx, time, teaName) => {
              handleSteepTimeClick(idx, selectedTeaId, time, teaName);
            }}
            onResetUsed={() => {
              setUsedSteepTimes(prev => {
                const newMap = new Map(prev);
                newMap.delete(selectedTeaId);
                return newMap;
              });
            }}
          />
        )}
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