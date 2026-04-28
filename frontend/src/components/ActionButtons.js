import React from 'react';
import { Eye, Copy, Download, FileJson, Trash2 } from 'lucide-react';

/**
 * ActionButton - Botón de acción simple reutilizable
 */
export function ActionButton({
  icon: Icon,
  label,
  onClick,
  variant = 'default',
  size = 'md',
  title,
  className = '',
  disabled = false
}) {
  const variants = {
    default: 'bg-violet-500/10 border-violet-500/20 text-violet-300 hover:bg-violet-500/20',
    success: 'bg-green-500/10 border-green-500/20 text-green-300 hover:bg-green-500/20',
    danger: 'bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/20',
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-300 hover:bg-blue-500/20',
    ghost: 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10',
  };

  const sizes = {
    sm: 'px-2 py-1 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-4 py-2 text-sm',
  };

  const iconSizes = {
    sm: 10,
    md: 11,
    lg: 13,
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1 rounded border font-semibold transition-all ${variants[variant]} ${sizes[size]} ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
    >
      {Icon && <Icon size={iconSizes[size]} />}
      {label && <span>{label}</span>}
    </button>
  );
}

/**
 * ActionButtonGroup - Grupo de botones de acciones
 */
export function ActionButtonGroup({ children, className = '', vertical = false }) {
  return (
    <div className={`flex ${vertical ? 'flex-col' : 'flex-row'} gap-1 ${className}`}>
      {children}
    </div>
  );
}

/**
 * ScenarioActions - Botones para acciones de escenario
 */
export function ScenarioActions({
  scenario,
  onView,
  onCopyError,
  compact = false,
}) {
  return (
    <ActionButtonGroup className={compact ? 'gap-0.5' : ''}>
      <ActionButton
        icon={Eye}
        label={compact ? '' : 'Detalles'}
        onClick={() => onView?.(scenario)}
        variant="default"
        size={compact ? 'sm' : 'md'}
        title="Ver detalles"
      />

      {scenario.status === 'FAILED' && scenario.error && (
        <ActionButton
          icon={Copy}
          label={compact ? '' : 'Error'}
          onClick={() => onCopyError?.(scenario)}
          variant="danger"
          size={compact ? 'sm' : 'md'}
          title="Copiar error"
        />
      )}
    </ActionButtonGroup>
  );
}

/**
 * ExportActions - Botones de exportación
 */
export function ExportActions({
  onExportJSON,
  onExportHTML,
  vertical = false,
  compact = false,
}) {
  return (
    <ActionButtonGroup vertical={vertical} className={compact ? 'gap-1' : 'gap-2'}>
      {onExportJSON && (
        <ActionButton
          icon={FileJson}
          label={compact ? '' : 'JSON'}
          onClick={onExportJSON}
          variant="info"
          size={compact ? 'sm' : 'md'}
          title="Exportar como JSON"
        />
      )}

      {onExportHTML && (
        <ActionButton
          icon={Download}
          label={compact ? '' : 'HTML'}
          onClick={onExportHTML}
          variant="warning"
          size={compact ? 'sm' : 'md'}
          title="Exportar como HTML"
        />
      )}
    </ActionButtonGroup>
  );
}

/**
 * CopyButton - Botón para copiar al portapapeles
 */
export function CopyButton({
  content,
  label = 'Copiar',
  icon: Icon = Copy,
  title = 'Copiar al portapapeles',
  variant = 'ghost',
  size = 'md',
  className = '',
}) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  return (
    <ActionButton
      icon={Icon}
      label={label}
      onClick={handleCopy}
      variant={variant}
      size={size}
      title={title}
      className={className}
    />
  );
}

export default ActionButton;

