/**
 * PravahDridh — Severity Badge Component
 */
import React from 'react';
import { SeverityLevel } from '../../types/risk';

const SEV_MAP: Record<SeverityLevel, { cls: string; label: string }> = {
  LOW:      { cls: 'badge badge-low',      label: 'LOW' },
  MEDIUM:   { cls: 'badge badge-medium',   label: 'MED' },
  HIGH:     { cls: 'badge badge-high',     label: 'HIGH' },
  CRITICAL: { cls: 'badge badge-critical', label: 'CRIT' },
};

interface Props {
  severity: SeverityLevel;
  full?: boolean;
}

export const SeverityBadge: React.FC<Props> = ({ severity, full = false }) => {
  const { cls, label } = SEV_MAP[severity] ?? SEV_MAP.LOW;
  return <span className={cls}>{full ? severity : label}</span>;
};
