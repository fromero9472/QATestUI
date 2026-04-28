import React from 'react';
import { CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';

/**
 * StatusBadge - Componente reutilizable para mostrar estados
 *
 * Props:
 * - status: 'PASSED' | 'FAILED' | 'SKIPPED' | 'ERROR' | 'PENDING'
 * - size: 'sm' | 'md' | 'lg' (por defecto 'md')
 * - showIcon: boolean (por defecto true)
 * - className: string adicional
 */
export function StatusBadge({ status = 'PENDING', size = 'md', showIcon = true, className = '' }) {
  const getStatusConfig = (status) => {
    switch ((status || '').toUpperCase()) {
      case 'PASSED':
        return {
          badge: 'bg-green-500/20 text-green-300 border-green-500/30',
          icon: '✓',
          label: 'PASSED',
          color: 'green'
        };
      case 'FAILED':
        return {
          badge: 'bg-red-500/20 text-red-300 border-red-500/30',
          icon: '✗',
          label: 'FAILED',
          color: 'red'
        };
      case 'SKIPPED':
        return {
          badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
          icon: '⏭',
          label: 'SKIPPED',
          color: 'slate'
        };
      case 'ERROR':
        return {
          badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
          icon: '!',
          label: 'ERROR',
          color: 'orange'
        };
      case 'PENDING':
      default:
        return {
          badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
          icon: '○',
          label: 'PENDING',
          color: 'slate'
        };
    }
  };

  const config = getStatusConfig(status);

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm'
  };

  const iconSize = {
    sm: 10,
    md: 12,
    lg: 14
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-semibold transition-all ${config.badge} ${sizeClasses[size]} ${className}`}>
      {showIcon && <span className="font-bold">{config.icon}</span>}
      {config.label}
    </span>
  );
}

/**
 * StatusIcon - Solo el ícono del estado
 */
export function StatusIcon({ status = 'PENDING', size = 20, showLabel = false }) {
  const getIconColor = (status) => {
    switch ((status || '').toUpperCase()) {
      case 'PASSED':
        return { Icon: CheckCircle, color: 'text-green-400' };
      case 'FAILED':
        return { Icon: XCircle, color: 'text-red-400' };
      case 'ERROR':
        return { Icon: AlertCircle, color: 'text-orange-400' };
      case 'PENDING':
        return { Icon: Clock, color: 'text-slate-400' };
      default:
        return { Icon: AlertCircle, color: 'text-slate-400' };
    }
  };

  const { Icon, color } = getIconColor(status);

  return (
    <div className="flex items-center gap-2">
      <Icon size={size} className={color} />
      {showLabel && <span className="text-xs font-semibold text-slate-300">{status}</span>}
    </div>
  );
}

/**
 * MetricCard - Card reutilizable para métricas
 *
 * Props:
 * - label: string
 * - value: string | number
 * - sublabel: string (opcional)
 * - variant: 'default' | 'success' | 'error' | 'warning' | 'info'
 */
export function MetricCard({ label, value, sublabel, variant = 'default' }) {
  const variantClasses = {
    default: 'bg-black/30 border-white/5 hover:border-white/10 text-slate-200',
    success: 'bg-green-500/10 border-green-500/20 hover:border-green-500/40 text-green-300',
    error: 'bg-red-500/10 border-red-500/20 hover:border-red-500/40 text-red-300',
    warning: 'bg-amber-500/10 border-amber-500/20 hover:border-amber-500/40 text-amber-300',
    info: 'bg-blue-500/10 border-blue-500/20 hover:border-blue-500/40 text-blue-300'
  };

  return (
    <div className={`p-3 rounded-lg border transition-all ${variantClasses[variant]}`}>
      <p className={`text-[10px] font-semibold mb-2 uppercase ${
        variant === 'success' ? 'text-green-400' :
        variant === 'error' ? 'text-red-400' :
        variant === 'warning' ? 'text-amber-400' :
        variant === 'info' ? 'text-blue-400' :
        'text-slate-500'
      }`}>
        {label}
      </p>
      <p
        className="text-2xl font-bold leading-tight overflow-hidden text-ellipsis whitespace-nowrap"
        title={String(value ?? '')}
      >
        {value}
      </p>
      {sublabel && (
        <p className={`text-[10px] mt-1 ${
          variant === 'success' ? 'text-green-400/70' :
          variant === 'error' ? 'text-red-400/70' :
          variant === 'warning' ? 'text-amber-400/70' :
          variant === 'info' ? 'text-blue-400/70' :
          'text-slate-600'
        }`}>
          {sublabel}
        </p>
      )}
    </div>
  );
}

export default StatusBadge;

