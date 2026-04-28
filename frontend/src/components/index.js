/**
 * Componentes Reutilizables - Índice Central
 *
 * Centraliza todas las exportaciones de componentes reutilizables
 * para facilitar el mantenimiento y las importaciones.
 */

// StatusBadge components
export {
  StatusBadge,
  StatusIcon,
  MetricCard
} from './StatusBadge';

// FiltersPanel components
export {
  SearchInput,
  StatusFilter,
  SortDropdown,
  FiltersPanel,
  AdvancedFilters,
  applyFilters
} from './FiltersPanel';

// ActionButtons components
export {
  ActionButton,
  ActionButtonGroup,
  ScenarioActions,
  ExportActions,
  CopyButton
} from './ActionButtons';

// LoadingState components
export {
  Spinner,
  SkeletonLoader,
  LoadingOverlay,
  LoadingState,
  EmptyState,
  ErrorState,
  SuccessState,
  ProgressBar,
  PulseAnimation
} from './LoadingState';

// Reporting components
export { ScenariosTable } from './ReportingPanel';

