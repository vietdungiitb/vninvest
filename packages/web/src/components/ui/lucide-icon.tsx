import { createElement, type ComponentType } from 'react';
import * as Icons from 'lucide-react';

const e = createElement;

interface LucideIconProps {
  name: string;
  className?: string;
}

// Create a map of icon components
const iconMap: Record<string, ComponentType<React.SVGProps<SVGSVGElement>>> = {
  LayoutDashboard: Icons.LayoutDashboard,
  Star: Icons.Star,
  Search: Icons.Search,
  ArrowUpDown: Icons.ArrowUpDown,
  Briefcase: Icons.Briefcase,
  Whale: Icons.Activity,
  Brain: Icons.Brain,
  Rocket: Icons.Rocket,
  MessageCircle: Icons.MessageCircle,
  Settings: Icons.Settings,
  Cpu: Icons.Cpu,
  Wrench: Icons.Wrench,
  RefreshCw: Icons.RefreshCw,
  Bell: Icons.Bell,
  Building2: Icons.Building2,
  ChevronLeft: Icons.ChevronLeft,
  ChevronRight: Icons.ChevronRight,
  ChevronDown: Icons.ChevronDown,
  X: Icons.X,
  LogOut: Icons.LogOut,
  User: Icons.User,
  Globe: Icons.Globe,
  Moon: Icons.Moon,
  Sun: Icons.Sun,
  Check: Icons.Check,
};

export function LucideIcon({ name, className = 'h-5 w-5' }: LucideIconProps) {
  const Icon = iconMap[name];
  if (!Icon) {
    return e('span', { className }, '⬤');
  }
  return e(Icon, { className });
}

export default LucideIcon;