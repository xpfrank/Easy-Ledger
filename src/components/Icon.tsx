import { 
  Banknote, 
  CreditCard, 
  Wallet, 
  TrendingUp, 
  BarChart3, 
  Building2, 
  Handshake, 
  ClipboardList,
  Smartphone,
  ShoppingBag,
  Car,
  PiggyBank,
  Coins,
  Landmark,
  Shield,
  Circle,
  Home,
  Edit3,
  Settings,
  Plus,
  ArrowLeft,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Trash2,
  Save,
  X,
  Download,
  Upload,
  TrendingDown,
  Calendar,
  Calculator,
  Info,
  AlertCircle,
  Check,
  Search,
  Filter,
  Menu,
  Eye,
  EyeOff,
  RefreshCw,
  Copy,
  History,
  type LucideIcon
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  'banknote': Banknote,
  'credit-card': CreditCard,
  'wallet': Wallet,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'bar-chart': BarChart3,
  'building': Building2,
  'handshake': Handshake,
  'clipboard': ClipboardList,
  'smartphone': Smartphone,
  'shopping-bag': ShoppingBag,
  'car': Car,
  'home': Home,
  'piggy-bank': PiggyBank,
  'coins': Coins,
  'bank': Landmark,
  'shield': Shield,
  'circle': Circle,
  'edit': Edit3,
  'settings': Settings,
  'plus': Plus,
  'arrow-left': ArrowLeft,
  'more-vertical': MoreVertical,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  'chevron-right': ChevronRight,
  'trash': Trash2,
  'save': Save,
  'x': X,
  'download': Download,
  'upload': Upload,
  'calendar': Calendar,
  'calculator': Calculator,
  'info': Info,
  'alert-circle': AlertCircle,
  'check': Check,
  'search': Search,
  'filter': Filter,
  'menu': Menu,
  'eye': Eye,
  'eye-off': EyeOff,
  'refresh': RefreshCw,
  'copy': Copy,
  'history': History,
};

interface IconProps {
  name: string;
  size?: number;
  className?: string;
  color?: string;
}

export function Icon({ name, size = 24, className = '', color }: IconProps) {
  const IconComponent = iconMap[name] || Circle;
  
  return (
    <IconComponent 
      size={size} 
      className={className}
      color={color}
    />
  );
}

export function getIconNames(): string[] {
  return Object.keys(iconMap);
}

// 预设图标配置（用于账户编辑页面）
export const PRESET_ICONS = [
  { name: 'banknote', label: '现金' },
  { name: 'credit-card', label: '银行卡' },
  { name: 'wallet', label: '钱包' },
  { name: 'trending-up', label: '投资' },
  { name: 'bar-chart', label: '基金' },
  { name: 'building', label: '机构' },
  { name: 'handshake', label: '借出' },
  { name: 'clipboard', label: '借入' },
  { name: 'smartphone', label: '手机' },
  { name: 'shopping-bag', label: '购物' },
  { name: 'car', label: '汽车' },
  { name: 'home', label: '房产' },
  { name: 'piggy-bank', label: '储蓄' },
  { name: 'coins', label: '硬币' },
  { name: 'bank', label: '银行' },
  { name: 'shield', label: '保险' },
];
