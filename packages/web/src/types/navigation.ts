export interface NavItem {
  labelKey: string;
  path: string;
  icon: string;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}