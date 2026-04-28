import React from 'react';
import { Loader, AlertCircle, CheckCircle } from 'lucide-react';

/**
 * Spinner - Indicador de carga simple
 */
export function Spinner({
  size = 'md',
  color = 'violet',
  className = ''
}) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const colors = {
    violet: 'text-violet-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
    amber: 'text-amber-400',
  };

  return (
    <Loader
      className={`${sizes[size]} ${colors[color]} animate-spin ${className}`}
    />
  );
}

/**
 * SkeletonLoader - Placeholder de carga tipo "skeleton"
 */
export function SkeletonLoader({
  count = 3,
  height = 'h-10',
  width = 'w-full',
  className = ''
}) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array(count).fill(0).map((_, i) => (
        <div
          key={i}
          className={`${width} ${height} bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 rounded-lg animate-pulse`}
        />
      ))}
    </div>
  );
}

/**
 * LoadingOverlay - Overlay de carga centrado
 */
export function LoadingOverlay({
  isLoading = false,
  message = 'Cargando...',
  spinnerSize = 'md',
  blur = true,
  fullScreen = false
}) {
  if (!isLoading) return null;

  const containerClass = fullScreen
    ? 'fixed inset-0 z-50'
    : 'absolute inset-0 z-40';

  return (
    <div className={`${containerClass} flex items-center justify-center ${blur ? 'bg-black/50 backdrop-blur-sm' : 'bg-black/30'}`}>
      <div className="flex flex-col items-center gap-4 p-6 rounded-lg bg-slate-900 border border-white/10">
        <Spinner size={spinnerSize} />
        <p className="text-sm font-semibold text-slate-200">{message}</p>
      </div>
    </div>
  );
}

/**
 * LoadingState - Estado de carga con mensaje personalizado
 */
export function LoadingState({
  title = 'Cargando',
  message = 'Por favor espera...',
  icon: Icon = Loader,
  showSpinner = true,
  fullHeight = true,
  className = ''
}) {
  return (
    <div className={`flex flex-col items-center justify-center ${fullHeight ? 'min-h-96' : 'py-12'} text-slate-500 ${className}`}>
      {showSpinner && (
        <div className="mb-4">
          <Spinner size="lg" color="violet" />
        </div>
      )}
      {Icon && !showSpinner && (
        <Icon size={48} className="mb-4 opacity-50" />
      )}
      <p className="text-base font-semibold mb-2">{title}</p>
      <p className="text-xs text-slate-600">{message}</p>
    </div>
  );
}

/**
 * EmptyState - Estado vacío con mensaje personalizado
 */
export function EmptyState({
  title = 'Sin resultados',
  message = 'No hay datos para mostrar',
  icon: Icon = AlertCircle,
  action,
  actionLabel = 'Intentar de nuevo',
  fullHeight = true,
  className = ''
}) {
  return (
    <div className={`flex flex-col items-center justify-center ${fullHeight ? 'min-h-96' : 'py-12'} text-slate-500 ${className}`}>
      {Icon && (
        <Icon size={48} className="mb-4 opacity-50" />
      )}
      <p className="text-base font-semibold mb-2">{title}</p>
      <p className="text-xs text-slate-600 mb-4">{message}</p>
      {action && (
        <button
          onClick={action}
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-all"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/**
 * ErrorState - Estado de error
 */
export function ErrorState({
  title = 'Error',
  message = 'Ocurrió un error inesperado',
  error,
  onRetry,
  retryLabel = 'Reintentar',
  fullHeight = true,
  className = ''
}) {
  return (
    <div className={`flex flex-col items-center justify-center ${fullHeight ? 'min-h-96' : 'py-12'} text-red-500 ${className}`}>
      <AlertCircle size={48} className="mb-4 opacity-50" />
      <p className="text-base font-semibold mb-2">{title}</p>
      <p className="text-xs text-red-400 mb-2">{message}</p>
      {error && (
        <pre className="text-[10px] bg-red-500/10 border border-red-500/20 rounded p-2 max-w-80 overflow-x-auto mb-4 text-red-300">
          {typeof error === 'string' ? error : error?.message || JSON.stringify(error)}
        </pre>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-all"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}

/**
 * SuccessState - Estado de éxito
 */
export function SuccessState({
  title = 'Completado',
  message = 'Operación realizada exitosamente',
  action,
  actionLabel = 'Continuar',
  fullHeight = true,
  className = ''
}) {
  return (
    <div className={`flex flex-col items-center justify-center ${fullHeight ? 'min-h-96' : 'py-12'} text-green-500 ${className}`}>
      <CheckCircle size={48} className="mb-4" />
      <p className="text-base font-semibold mb-2">{title}</p>
      <p className="text-xs text-green-400 mb-4">{message}</p>
      {action && (
        <button
          onClick={action}
          className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-semibold transition-all"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/**
 * ProgressBar - Barra de progreso
 */
export function ProgressBar({
  value = 0,
  max = 100,
  label,
  variant = 'default',
  animated = true,
  size = 'md'
}) {
  const percentage = Math.min((value / max) * 100, 100);

  const variants = {
    default: 'bg-violet-500',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    info: 'bg-blue-500',
  };

  const sizes = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between items-center">
          <p className="text-xs font-semibold text-slate-300">{label}</p>
          <p className="text-[10px] text-slate-500">{Math.round(percentage)}%</p>
        </div>
      )}
      <div className={`w-full rounded-full bg-slate-700/50 overflow-hidden ${sizes[size]}`}>
        <div
          className={`${variants[variant]} ${sizes[size]} rounded-full transition-all ${animated ? 'duration-300' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * PulseAnimation - Animación de pulso simple
 */
export function PulseAnimation({
  children,
  active = true,
  className = ''
}) {
  return (
    <div className={`${active ? 'animate-pulse' : ''} ${className}`}>
      {children}
    </div>
  );
}

export default LoadingState;

