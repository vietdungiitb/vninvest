import { ComponentType } from 'react';

interface PageEntry {
  routeId: string;
  status: string;
  loadComponent: () => Promise<{ default: ComponentType<any> }>;
  component: ComponentType<any>;
}

export const pageRegistry: ReadonlyArray<PageEntry>;

export function getPageRegistryRouteIds(): string[];

export function getPageComponent(routeId: string): ComponentType<any> | null;

export function getPageLoader(routeId: string): (() => Promise<{ default: ComponentType<any> }>) | null;