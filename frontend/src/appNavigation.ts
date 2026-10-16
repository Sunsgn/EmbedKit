import type { ComponentType } from 'react';
import { BookOpen, Boxes, BrainCircuit, Code2, DatabaseBackup, FlaskConical, Gauge, HardDrive, MonitorCog, Radio, Wrench } from 'lucide-react';

export interface NavItem {
  icon: ComponentType<{ size?: number }>;
  label: string;
  path: string;
  aliases?: string[];
}

export const navSections: Array<{ title: string; items: NavItem[] }> = [
  {
    title: '本地工作台',
    items: [
      { icon: Gauge, label: '工作台', path: '/' },
      { icon: HardDrive, label: '工程中心', path: '/engineering', aliases: ['/devices'] },
      { icon: Code2, label: '工程分析', path: '/projects', aliases: ['/editor'] },
      { icon: Boxes, label: '资料中心', path: '/resources', aliases: ['/components', '/chips'] },
      { icon: Radio, label: '通信调试', path: '/communication', aliases: ['/serial'] },
      { icon: Wrench, label: '嵌入式工具箱', path: '/toolbox' },
    ],
  },
  {
    title: '按需能力',
    items: [
      { icon: MonitorCog, label: '开发环境', path: '/environment' },
      { icon: FlaskConical, label: '集成测试', path: '/tests' },
      { icon: BookOpen, label: '学习中心', path: '/learn', aliases: ['/tutorials'] },
      { icon: BrainCircuit, label: '可选 AI 助手', path: '/ai' },
    ],
  },
  {
    title: '系统',
    items: [
      { icon: MonitorCog, label: '本地助手', path: '/agent' },
      { icon: DatabaseBackup, label: '数据管理', path: '/data' },
    ],
  },
];
