import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'App ROI 数据分析系统',
  description: '多时间维度ROI趋势分析',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gray-100">
        {children}
      </body>
    </html>
  );
}
