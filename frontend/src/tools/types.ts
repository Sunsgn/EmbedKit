import type { ComponentType, LazyExoticComponent } from 'react';
import type { LucideIcon } from 'lucide-react';

export type ToolCategory = 'conversion' | 'protocol' | 'calculation' | 'firmware' | 'analysis';

export interface ToolDefinition {
  apiVersion: 1;
  id: string;
  version: string;
  title: string;
  description: string;
  detail: string;
  category: ToolCategory;
  keywords: string[];
  requiresAgent: boolean;
  icon: LucideIcon;
  component: LazyExoticComponent<ComponentType>;
}
