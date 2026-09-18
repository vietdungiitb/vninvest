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
  Waves: Icons.Waves,
  EyeOff: Icons.EyeOff,
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
  // ── SOC DataOps / Operations Center ──
  BarChart3: Icons.BarChart3,
  Database: Icons.Database,
  ServerCog: Icons.ServerCog,
  Radio: Icons.Radio,
  Activity: Icons.Activity,
  Clock: Icons.Clock,
  SlidersHorizontal: Icons.SlidersHorizontal,
  ListChecks: Icons.ListChecks,
  FolderKanban: Icons.FolderKanban,
  ShieldCheck: Icons.ShieldCheck,
  Gauge: Icons.Gauge,
  Syringe: Icons.Syringe,
  // ── SOC top-level tabs ──
  BookOpen: Icons.BookOpen,
  TrendingUp: Icons.TrendingUp,
  Zap: Icons.Zap,
  LineChart: Icons.LineChart,
  Layers: Icons.Layers,
  ClipboardList: Icons.ClipboardList,
  AlertTriangle: Icons.AlertTriangle,
  Snowflake: Icons.Snowflake,
  Settings2: Icons.Settings2,
  Percent: Icons.Percent,
};

export function LucideIcon({ name, className = 'h-5 w-5', size, style }: LucideIconProps & { size?: number; style?: React.CSSProperties }) {
  const Icon = iconMap[name];
  if (!Icon) {
    return e('span', { className, style }, '⬤');
  }
  return e(Icon, { className, width: size, height: size, style } as React.SVGProps<SVGSVGElement>);
}

export default LucideIcon;