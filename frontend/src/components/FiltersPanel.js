import React from 'react';
import { Search, Filter, ArrowUpDown } from 'lucide-react';

/**
 * SearchInput - Campo de búsqueda reutilizable
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar...",
  className = ""
}) {
  return (
    <div className={`relative flex-1 ${className}`}>
      <Search size={13} className="absolute left-3 top-3 text-slate-500" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-9 pr-3 py-2 bg-black/30 border border-white/10 rounded-lg text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-violet-500 transition-colors"
      />
    </div>
  );
}

/**
 * StatusFilter - Filtro de estado (PASSED, FAILED, ALL)
 */
export function StatusFilter({
  value,
  onChange,
  options = ['all', 'passed', 'failed'],
  className = ""
}) {
  const getLabel = (status) => {
    switch(status) {
      case 'all': return 'Todos';
      case 'passed': return '✓';
      case 'failed': return '✗';
      case 'skipped': return '⏭';
      default: return status;
    }
  };

  return (
    <div className={`flex gap-1 bg-black/30 border border-white/10 rounded-lg p-1 ${className}`}>
      {options.map(status => (
        <button
          key={status}
          onClick={() => onChange(status)}
          className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
            value === status
              ? 'bg-violet-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title={`Filtrar por ${status}`}
        >
          {getLabel(status)}
        </button>
      ))}
    </div>
  );
}

/**
 * SortDropdown - Selector de ordenamiento
 */
export function SortDropdown({
  value,
  onChange,
  options = [
    { value: 'name', label: 'Ordenar: Nombre' },
    { value: 'duration', label: 'Ordenar: Duración' },
    { value: 'status', label: 'Ordenar: Estado' },
  ],
  className = ""
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-violet-500 transition-colors cursor-pointer ${className}`}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

/**
 * FiltersPanel - Componente completo de filtros
 *
 * Props:
 * - searchTerm: string
 * - onSearchChange: (value: string) => void
 * - filterStatus: string ('all' | 'passed' | 'failed')
 * - onStatusChange: (status: string) => void
 * - sortBy: string ('name' | 'duration' | 'status')
 * - onSortChange: (sort: string) => void
 * - totalItems: number
 * - filteredItems: number
 * - compact: boolean (por defecto false)
 */
export function FiltersPanel({
  searchTerm,
  onSearchChange,
  filterStatus = 'all',
  onStatusChange,
  sortBy = 'name',
  onSortChange,
  totalItems = 0,
  filteredItems = 0,
  compact = false,
  showStats = true
}) {
  return (
    <div className={`${compact ? 'gap-2' : 'gap-3'} flex flex-col md:flex-row md:items-center mb-4`}>
      {/* Búsqueda - siempre ocupa espacio */}
      <SearchInput
        value={searchTerm}
        onChange={onSearchChange}
        placeholder="Buscar escenario..."
        className={compact ? '' : ''}
      />

      {/* Filtro estado */}
      <StatusFilter
        value={filterStatus}
        onChange={onStatusChange}
      />

      {/* Ordenar */}
      <SortDropdown
        value={sortBy}
        onChange={onSortChange}
        className={compact ? 'whitespace-nowrap' : ''}
      />

      {/* Estadísticas */}
      {showStats && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/20 border border-white/5 text-[10px] text-slate-500 whitespace-nowrap">
          <Filter size={11} />
          <span>
            {filteredItems}/{totalItems}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * AdvancedFilters - Panel de filtros avanzados (expandible)
 */
export function AdvancedFilters({
  filters = {},
  onChange,
  onReset,
  isOpen = false,
  onToggle
}) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <button
        onClick={() => onToggle?.(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-slate-100 text-xs font-semibold transition-all w-full"
      >
        <Filter size={12} />
        Filtros Avanzados
        <span className={`ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* Content */}
      {isOpen && (
        <div className="p-4 rounded-lg bg-black/30 border border-white/10 space-y-3">
          {/* Filter options would go here */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Example: Tags filter */}
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-2">
                Tags
              </label>
              <input
                type="text"
                placeholder="Ej: @smoke"
                value={filters.tags || ''}
                onChange={(e) => onChange({ ...filters, tags: e.target.value })}
                className="w-full px-2 py-1 bg-black/30 border border-white/10 rounded text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-violet-500"
              />
            </div>

            {/* Duration filter */}
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-2">
                Duración Max (ms)
              </label>
              <input
                type="number"
                placeholder="5000"
                value={filters.maxDuration || ''}
                onChange={(e) => onChange({ ...filters, maxDuration: e.target.value })}
                className="w-full px-2 py-1 bg-black/30 border border-white/10 rounded text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-violet-500"
              />
            </div>

            {/* Feature filter */}
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-2">
                Feature
              </label>
              <input
                type="text"
                placeholder="Feature name"
                value={filters.feature || ''}
                onChange={(e) => onChange({ ...filters, feature: e.target.value })}
                className="w-full px-2 py-1 bg-black/30 border border-white/10 rounded text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-violet-500"
              />
            </div>

            {/* Date range */}
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-2">
                Fecha
              </label>
              <input
                type="date"
                value={filters.date || ''}
                onChange={(e) => onChange({ ...filters, date: e.target.value })}
                className="w-full px-2 py-1 bg-black/30 border border-white/10 rounded text-xs text-slate-200 outline-none focus:border-violet-500"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 justify-end pt-2 border-t border-white/10">
            <button
              onClick={() => onReset?.()}
              className="px-3 py-1 rounded text-xs bg-white/5 border border-white/10 text-slate-400 hover:text-slate-200 transition-all font-semibold"
            >
              Limpiar
            </button>
            <button
              onClick={() => onToggle?.(false)}
              className="px-3 py-1 rounded text-xs bg-violet-600 hover:bg-violet-500 text-white transition-all font-semibold"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Helper function para aplicar filtros
 */
export function applyFilters(items, searchTerm, filterStatus, sortBy, advancedFilters = {}) {
  let result = items;

  // Búsqueda por texto
  if (searchTerm) {
    result = result.filter(item =>
      (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.title || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  // Filtro de estado
  if (filterStatus && filterStatus !== 'all') {
    result = result.filter(item =>
      (item.status || '').toLowerCase() === filterStatus.toLowerCase()
    );
  }

  // Filtros avanzados
  if (advancedFilters.tags) {
    result = result.filter(item =>
      item.tags && item.tags.some(t =>
        t.toLowerCase().includes(advancedFilters.tags.toLowerCase())
      )
    );
  }

  if (advancedFilters.maxDuration) {
    result = result.filter(item =>
      (item.durationMs || 0) <= parseFloat(advancedFilters.maxDuration)
    );
  }

  if (advancedFilters.feature) {
    result = result.filter(item =>
      (item.featureFile || '').toLowerCase().includes(advancedFilters.feature.toLowerCase())
    );
  }

  // Ordenamiento
  if (sortBy === 'duration') {
    result.sort((a, b) => (a.durationMs || 0) - (b.durationMs || 0));
  } else if (sortBy === 'status') {
    const statusOrder = { 'FAILED': 0, 'PASSED': 1, 'SKIPPED': 2 };
    result.sort((a, b) =>
      (statusOrder[a.status] || 999) - (statusOrder[b.status] || 999)
    );
  } else {
    // Por defecto: nombre
    result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  return result;
}

export default FiltersPanel;

