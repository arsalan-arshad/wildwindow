import React from 'react';

export const useRouter = () => ({
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: () => false,
});

export const useSegments = () => [] as string[];

export const Redirect = ({ href }: { readonly href: string }) =>
  React.createElement('Redirect', { href });

export const Link = ({
  children,
  href,
}: {
  readonly children: React.ReactNode;
  readonly href: string;
}) => React.createElement('Link', { href }, children);

export const Stack = Object.assign(
  ({ children }: { readonly children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  {
    Screen: () => null,
  },
);

export const Tabs = Object.assign(
  ({ children }: { readonly children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  {
    Screen: () => null,
  },
);

export const ThemeProvider = ({ children }: { readonly children: React.ReactNode }) =>
  React.createElement(React.Fragment, null, children);

export const DarkTheme = { colors: {} };
export const DefaultTheme = { colors: {} };
