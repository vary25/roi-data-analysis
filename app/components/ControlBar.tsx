'use client';

interface ControlBarProps {
  showMovingAverage: boolean;
  yAxisScale: 'linear' | 'log';
  onShowMChange: (value: boolean) => void;
  onScaleChange: (value: 'linear' | 'log') => void;
}

export default function ControlBar({
  showMovingAverage,
  yAxisScale,
  onShowMChange,
  onScaleChange,
}: ControlBarProps) {
  return (
    <div className="flex flex-wrap gap-8 mb-6 p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-700">数据显示模式：</span>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={showMovingAverage}
              onChange={() => onShowMChange(true)}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-sm">显示移动平均值</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={!showMovingAverage}
              onChange={() => onShowMChange(false)}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-sm">显示原始数据</span>
          </label>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-700">Y轴刻度：</span>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={yAxisScale === 'linear'}
              onChange={() => onScaleChange('linear')}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-sm">线性刻度</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={yAxisScale === 'log'}
              onChange={() => onScaleChange('log')}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-sm">对数刻度</span>
          </label>
        </div>
      </div>
    </div>
  );
}
