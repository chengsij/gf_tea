import type { Tea } from '../types'
import { Trash2, ExternalLink } from 'lucide-react'
import { formatLastConsumedDate } from '../utils/dateFormat'

interface TeaCardProps {
  tea: Tea
  usedSteepTimes: Set<number>
  onTeaClick: () => void
  onSteepClick: (teaId: string) => void
  onDeleteClick: (teaId: string, e: React.MouseEvent) => void
  deletingTeaId: string | null
  isSelected: boolean
}

export const TeaCard = ({
  tea,
  onTeaClick,
  onDeleteClick,
  deletingTeaId,
  isSelected,
}: TeaCardProps) => {
  return (
    <div
      className={`tea-card ${isSelected ? 'selected' : ''}`}
      onClick={onTeaClick}
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
            onClick={(e) => onDeleteClick(tea.id, e)}
            title="Delete Tea"
            disabled={deletingTeaId === tea.id}
          >
            {deletingTeaId === tea.id ? '...' : <Trash2 size={18} />}
          </button>
        </div>
      </div>
      <div className="tea-content">
        <div className="tea-header">
          <div className="tea-title">
            <h2>{tea.name}</h2>
            <div className="tea-meta">
              <span className="tea-type">{tea.type}</span>
              {tea.caffeineLevel && (
                <span className={`tea-caffeine ${tea.caffeineLevel.toLowerCase()}`}>
                  {tea.caffeineLevel} Caffeine
                </span>
              )}
            </div>
            <div className="tea-stats">
              <span className="stat-text">
                Drunk {tea.timesConsumed || 0} times | Last: {formatLastConsumedDate(tea.lastConsumedDate || null)}
              </span>
            </div>
            <div className="tea-brewing-info">
              {tea.brewingTemperature && (
                <span className="brewing-temp">{tea.brewingTemperature}</span>
              )}
              {tea.teaWeight && (
                <span className="tea-weight">{tea.teaWeight}</span>
              )}
              <span className="steep-count">{tea.steepTimes.length} steeps</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
