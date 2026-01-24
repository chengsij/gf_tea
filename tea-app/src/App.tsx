import { useState, useEffect, useMemo } from 'react'
import './App.css'
import type { Tea, CaffeineLevel, TeaType } from './types'
import { getTeas, createTea, deleteTea, importTeaFromUrl, updateTea } from './api'
import { TimerProvider, useTimer } from './TimerContext'
import { Clock, Plus, X, Coffee, ExternalLink, Star } from 'lucide-react'
import { CAFFEINE_LEVELS, TEA_TYPES } from './types'
import { Toaster } from 'sonner'
import { showSuccess, showError, showInfo } from './utils/toast'
import { TeaCard, FilterBar, SortControls } from './components'

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
  onResetUsed,
  onTeaUpdated
}: {
  tea: Tea;
  onClose: () => void;
  usedSteepTimes: Set<number>;
  onSteepTimeClick: (idx: number, time: number, teaName: string) => void;
  onResetUsed: () => void;
  onTeaUpdated: () => void;
}) => {
  const [isUpdatingRating, setIsUpdatingRating] = useState(false);

  const handleRatingClick = async (rating: number | null) => {
    setIsUpdatingRating(true);
    try {
      await updateTea(tea.id, { rating });
      showSuccess(rating ? `Rating set to ${rating}/10` : 'Rating cleared');
      onTeaUpdated();
    } catch (error) {
      console.error('Failed to update rating:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showError(`Failed to update rating: ${errorMessage}`);
    } finally {
      setIsUpdatingRating(false);
    }
  };

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
          {tea.brewingTemperature && (
            <div className="info-row">
              <span className="info-label">Brewing Temp:</span>
              <span>{tea.brewingTemperature}</span>
            </div>
          )}
          {tea.teaWeight && (
            <div className="info-row">
              <span className="info-label">Tea Weight:</span>
              <span>{tea.teaWeight}</span>
            </div>
          )}
          {tea.website && (
            <div className="info-row">
              <a href={tea.website} target="_blank" rel="noopener noreferrer" className="website-link">
                <ExternalLink size={16} /> Visit Website
              </a>
            </div>
          )}
        </div>

        <div className="rating-section">
          <h3>Rating</h3>
          <div className="stars-container">
            <div className="stars">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(star => (
                <button
                  key={star}
                  className="star-btn"
                  onClick={() => handleRatingClick(star)}
                  disabled={isUpdatingRating}
                  title={`Rate ${star}/10`}
                >
                  <Star
                    size={20}
                    fill={star <= (tea.rating || 0) ? 'currentColor' : 'none'}
                    className={star <= (tea.rating || 0) ? 'star-filled' : 'star-empty'}
                  />
                </button>
              ))}
            </div>
            {tea.rating && (
              <span className="rating-text">
                {tea.rating}/10
              </span>
            )}
          </div>
          {tea.rating && (
            <button
              className="btn-clear-rating"
              onClick={() => handleRatingClick(null)}
              disabled={isUpdatingRating}
            >
              Clear Rating
            </button>
          )}
        </div>

        <div className="steep-times-section">
          <h3>Steep Times</h3>
          <div className={`steep-times ${tea.steepTimes.length >= 6 ? 'steep-times-many' : ''}`}>
            {tea.steepTimes.map((time: number, idx: number) => (
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
  const [type, setType] = useState<TeaType>('Green');
  const [image, setImage] = useState('');
  const [steepTimes, setSteepTimes] = useState('');
  const [caffeine, setCaffeine] = useState('');
  const [caffeineLevel, setCaffeineLevel] = useState<CaffeineLevel>('Low');
  const [website, setWebsite] = useState('');
  const [brewingTemperature, setBrewingTemperature] = useState('');
  const [teaWeight, setTeaWeight] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const times = steepTimes.split(',').map(t => parseInt(t.trim())).filter(t => !isNaN(t));

      if (times.length === 0) {
        showError('Please enter at least one steep time.');
        return;
      }

      await createTea({
        name,
        type,
        image,
        steepTimes: times,
        caffeine,
        caffeineLevel,
        website,
        brewingTemperature,
        teaWeight
      });

      showSuccess('Tea added successfully!');
      onTeaAdded();
      onClose();
    } catch (error) {
      console.error('Failed to create tea:', error);
      if (error instanceof Error) {
        showError(`Failed to save tea: ${error.message}`);
      } else {
        showError('Failed to save tea. Please check your input and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImport = async () => {
    if (!importUrl) return;

    setIsImporting(true);

    try {
      const data = await importTeaFromUrl(importUrl);
      setName(data.name);
      setType(data.type as TeaType);
      setImage(data.image);
      setSteepTimes(data.steepTimes.join(', '));
      setCaffeine(data.caffeine || '');
      setCaffeineLevel(data.caffeineLevel);
      setWebsite(data.website || '');
      setBrewingTemperature(data.brewingTemperature);
      setTeaWeight(data.teaWeight);
      setImportUrl('');
      showInfo('Tea information imported');
    } catch (error) {
      console.error('Failed to import tea data:', error);
      if (error instanceof Error) {
        showError(`Import failed: ${error.message}`);
      } else {
        showError('Failed to import tea data from URL. Please check the URL and try again.');
      }
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
                  {isImporting ? 'Importing...' : 'Auto-fill'}
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
              <select value={type} onChange={e => setType(e.target.value as TeaType)} required>
                {TEA_TYPES.map(teaType => (
                  <option key={teaType} value={teaType}>{teaType}</option>
                ))}
              </select>
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
              <select value={caffeineLevel} onChange={e => setCaffeineLevel(e.target.value as CaffeineLevel)} required>
                {CAFFEINE_LEVELS.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Website</label>
              <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://example.com" required />
            </div>
            <div className="form-group">
              <label>Brewing Temperature (Gongfu Method)</label>
              <input value={brewingTemperature} onChange={e => setBrewingTemperature(e.target.value)} placeholder="e.g. 185℉ / 85℃" required />
            </div>
            <div className="form-group">
              <label>Tea Weight (Gongfu Method)</label>
              <input value={teaWeight} onChange={e => setTeaWeight(e.target.value)} placeholder="e.g. 5g Tea" required />
            </div>
            <button type="submit" className="btn-primary" disabled={isSubmitting} style={{marginTop: '0.5rem', width: '100%'}}>
              {isSubmitting ? 'Saving...' : 'Save Tea'}
            </button>
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
  const [sortBy, setSortBy] = useState<'date' | 'name-asc' | 'name-desc' | 'type' | 'caffeine-asc' | 'caffeine-desc' | 'steeps-asc' | 'steeps-desc'>('date');
  const [usedSteepTimes, setUsedSteepTimes] = useState<Map<string, Set<number>>>(new Map());
  const [selectedTeaId, setSelectedTeaId] = useState<string | null>(null);
  const [deletingTeaId, setDeletingTeaId] = useState<string | null>(null);
  const { startTimer } = useTimer();

  const fetchTeas = async () => {
    try {
      const data = await getTeas();
      setTeas(data);
    } catch (error) {
      console.error('Failed to load teas:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showError(`Failed to load tea collection: ${errorMessage}`);
      setTeas([]);
    }
  };

  useEffect(() => {
    fetchTeas();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this tea?')) {
      setDeletingTeaId(id);
      try {
        await deleteTea(id);
        setUsedSteepTimes(prev => {
          const newMap = new Map(prev);
          newMap.delete(id);
          return newMap;
        });
        if (selectedTeaId === id) {
          setSelectedTeaId(null);
        }
        await fetchTeas();
        showSuccess('Tea deleted successfully');
      } catch (error) {
        console.error('Failed to delete tea:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        showError(`Failed to delete tea: ${errorMessage}`);
      } finally {
        setDeletingTeaId(null);
      }
    }
  };

  const handleSteepTimeClick = (timeIdx: number, teaId: string, time: number, teaName: string) => {
    startTimer(time, teaName, timeIdx);
    setUsedSteepTimes(prev => {
      const newMap = new Map(prev);
      const usedSet = newMap.get(teaId) || new Set<number>();
      usedSet.add(timeIdx);
      newMap.set(teaId, usedSet);
      return newMap;
    });
  };


  const uniqueTypes = useMemo(() => {
    return Array.from(new Set(teas.map(tea => tea.type))).sort();
  }, [teas]);

  const caffeineLevelValue = (level: string) => {
    if (level === 'Low') return 1;
    if (level === 'Medium') return 2;
    if (level === 'High') return 3;
    return 0;
  };

  const filteredTeas = useMemo(() => {
    return teas.filter(tea => {
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
        case 'steeps-asc':
          return a.steepTimes.length - b.steepTimes.length;
        case 'steeps-desc':
          return b.steepTimes.length - a.steepTimes.length;
        case 'date':
        default:
          return parseInt(b.id) - parseInt(a.id);
      }
    });
  }, [teas, searchTerm, selectedType, selectedCaffeineLevel, sortBy]);

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
          <SortControls sortBy={sortBy} onSortChange={setSortBy} />
          <button onClick={() => setShowForm(true)} className="btn-primary btn-add-tea">
            <Plus size={18} /> Add Tea
          </button>
        </div>
      </div>

      {showForm && <TeaForm onTeaAdded={fetchTeas} onClose={() => setShowForm(false)} />}

      <FilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
        selectedCaffeineLevel={selectedCaffeineLevel}
        onCaffeineLevelChange={setSelectedCaffeineLevel}
        uniqueTypes={uniqueTypes}
      />

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
                <TeaCard
                  key={tea.id}
                  tea={tea}
                  usedSteepTimes={usedSteepTimes.get(tea.id) || new Set()}
                  onTeaClick={() => setSelectedTeaId(tea.id)}
                  onSteepClick={() => {}}
                  onDeleteClick={handleDelete}
                  deletingTeaId={deletingTeaId}
                  isSelected={selectedTeaId === tea.id}
                />
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
            onTeaUpdated={fetchTeas}
          />
        )}
      </div>
    </div>
  );
};

function App() {
  return (
    <TimerProvider>
      <Toaster position="top-right" richColors />
      <TimerOverlay />
      <TeaDashboard />
    </TimerProvider>
  )
}

export default App