import './globals.css';

export const metadata = {
  title: 'Code Editor',
  description: 'Online code editor with execution',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}