'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { ImportResult } from '@/types';

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      setFile(droppedFile);
      setError(null);
    } else {
      setError('请上传CSV文件');
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('请选择CSV文件');
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.data);
      } else {
        setError(data.error || '上传失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">导入CSV数据</h1>
            <p className="text-gray-600 mt-2">
              上传ROI数据CSV文件到数据库
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回首页
          </Link>
        </div>

        {/* CSV格式说明 */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">CSV文件格式要求</h3>
          <p className="text-sm text-blue-700 mb-2">
            CSV文件必须包含以下列：
          </p>
          <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
            <li>日期 - 数据日期（格式：2025-04-13）</li>
            <li>app - 应用名称（如：App-1）</li>
            <li>出价类型 - 出价方式（如：CPI）</li>
            <li>国家地区 - 投放国家（如：美国、英国）</li>
            <li>应用安装.总次数 - 安装数量</li>
            <li>当日ROI, 1日ROI, 3日ROI...90日ROI - ROI百分比</li>
          </ul>
        </div>

        {/* 上传区域 */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 bg-gray-50'
          }`}
        >
          <div className="mb-4">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <p className="text-lg text-gray-700 mb-2">
            {file ? `已选择: ${file.name}` : '拖拽CSV文件到此处'}
          </p>
          <p className="text-sm text-gray-500 mb-4">
            或点击选择文件
          </p>

          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
            id="csv-input"
          />
          <label
            htmlFor="csv-input"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer transition-colors"
          >
            选择文件
          </label>
        </div>

        {/* 上传按钮 */}
        {file && (
          <div className="mt-6 text-center">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className={`inline-flex items-center px-6 py-3 rounded-md text-white font-medium transition-colors ${
                uploading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {uploading ? (
                <>
                  <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  上传中...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  开始导入
                </>
              )}
            </button>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* 导入结果 */}
        {result && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="text-lg font-semibold text-green-800 mb-3 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              导入成功
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-white rounded">
                <span className="text-sm text-gray-500 block">成功导入</span>
                <span className="text-2xl font-bold text-green-600">{result.imported}</span>
                <span className="text-sm text-gray-500">条</span>
              </div>
              <div className="text-center p-3 bg-white rounded">
                <span className="text-sm text-gray-500 block">跳过</span>
                <span className="text-2xl font-bold text-yellow-600">{result.skipped}</span>
                <span className="text-sm text-gray-500">条</span>
              </div>
              <div className="text-center p-3 bg-white rounded">
                <span className="text-sm text-gray-500 block">错误</span>
                <span className="text-2xl font-bold text-red-600">{result.errors.length}</span>
                <span className="text-sm text-gray-500">条</span>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">错误详情（显示前10条）:</p>
                <ul className="text-sm text-red-600 list-disc list-inside">
                  {result.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4 text-center">
              <Link
                href="/"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                查看数据
              </Link>
            </div>
          </div>
        )}

        {/* 示例数据 */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">示例数据</h3>
          <p className="text-sm text-gray-600 mb-2">
            项目目录中已包含示例数据文件：<code className="bg-gray-200 px-2 py-1 rounded">data/app_roi_data.csv</code>
          </p>
          <p className="text-sm text-gray-600">
            你可以直接上传此文件进行测试。
          </p>
        </div>
      </div>
    </main>
  );
}
