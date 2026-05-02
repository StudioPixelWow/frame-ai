/**
 * Premium Chart Design System
 *
 * PixelManageAI — Futuristic Analytics Components
 *
 * Usage:
 * import { PremiumKpiCard, PremiumBarChart, PremiumLineChart } from '@/components/charts';
 */

// Theme
export * from './chartTheme';

// Wrapper
export { ChartWrapper } from './ChartWrapper';
export type { ChartState, ChartWrapperProps } from './ChartWrapper';

// Components
export { PremiumKpiCard } from './PremiumKpiCard';
export type { KpiCardProps } from './PremiumKpiCard';

export { PremiumBarChart } from './PremiumBarChart';
export type { PremiumBarChartProps, BarChartData } from './PremiumBarChart';

export { PremiumLineChart } from './PremiumLineChart';
export type { PremiumLineChartProps, LineChartSeries } from './PremiumLineChart';

export { PremiumAreaChart } from './PremiumAreaChart';
export type { PremiumAreaChartProps, AreaChartSeries } from './PremiumAreaChart';

export { PremiumDonutChart } from './PremiumDonutChart';
export type { PremiumDonutChartProps, DonutSegment } from './PremiumDonutChart';

export { PremiumRadialMetric } from './PremiumRadialMetric';
export type { PremiumRadialMetricProps } from './PremiumRadialMetric';

export { PremiumSparkline } from './PremiumSparkline';
export type { PremiumSparklineProps } from './PremiumSparkline';

export { PremiumComparisonChart } from './PremiumComparisonChart';
export type { PremiumComparisonChartProps, ComparisonItem } from './PremiumComparisonChart';

export { PremiumPlatformChart } from './PremiumPlatformChart';
export type { PremiumPlatformChartProps, PlatformData } from './PremiumPlatformChart';

export { PremiumStatGrid } from './PremiumStatGrid';
export type { PremiumStatGridProps, StatGridItem } from './PremiumStatGrid';
