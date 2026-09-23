export interface NavItem {
  labelKey: string;
  path: string;
  icon: string;
  staffOnly?: boolean;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
  staffOnly?: boolean;
}