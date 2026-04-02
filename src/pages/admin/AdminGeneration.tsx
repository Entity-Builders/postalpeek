/**
 * AdminGeneration.tsx — /admin/generation
 */

import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { PipelineConfigurator } from '../../components/PipelineConfigurator';
import type { AdminOutletContext } from './types';

export function AdminGeneration() {
  const { onPostcardGenerated, refetchLog } = useOutletContext<AdminOutletContext>();
  return (
    <PipelineConfigurator
      onPostcardGenerated={onPostcardGenerated}
      onRefetchLog={refetchLog}
    />
  );
}
