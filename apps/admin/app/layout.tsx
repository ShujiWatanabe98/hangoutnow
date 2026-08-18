import type { ReactNode } from 'react';

export const metadata = { title: 'Hangout Now 運営管理', robots: { index: false, follow: false } };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="ja"><body style={{margin:0}}>{children}</body></html>;
}
