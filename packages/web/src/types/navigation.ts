export interface NavItem {
  labelKey: string;
  path: string;
  icon: string;
  staffOnly?: boolean;
  requiresTenant?: boolean;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
  staffOnly?: boolean;
  requiresTenant?: boolean;
}