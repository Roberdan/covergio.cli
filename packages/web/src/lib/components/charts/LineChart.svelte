<script lang="ts">
  import {
    Chart,
    registerables,
    type ChartDataset,
    type ChartOptions
  } from 'chart.js';

  interface LineDataset {
    label: string;
    data: number[];
    color: string;
  }

  interface LineChartProps {
    labels: string[];
    datasets: LineDataset[];
    height?: number;
    showArea?: boolean;
    showGrid?: boolean;
  }

  let { labels, datasets, height = 280, showArea = false, showGrid = true }: LineChartProps =
    $props();

  let canvas: HTMLCanvasElement | undefined;
  let chart: Chart<'line'> | undefined;
  let isRegistered = false;

  const ensureRegistered = () => {
    if (!isRegistered) {
      Chart.register(...registerables);
      isRegistered = true;
    }
  };

  const isDarkMode = () =>
    document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');

  const toRgba = (color: string, alpha: number) => {
    if (!color.startsWith('#')) {
      return color;
    }

    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((segment) => `${segment}${segment}`)
        .join('');
    }

    if (hex.length < 6) {
      return color;
    }

    const value = Number.parseInt(hex.slice(0, 6), 16);
    const red = (value >> 16) & 255;
    const green = (value >> 8) & 255;
    const blue = value & 255;
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  };

  const gridColor = (dark: boolean) =>
    dark ? 'rgba(148, 163, 184, 0.22)' : 'rgba(100, 116, 139, 0.18)';
  const textColor = (dark: boolean) => (dark ? '#cbd5e1' : '#475569');

  const createChart = () => {
    if (!canvas) {
      return;
    }

    ensureRegistered();
    const darkMode = isDarkMode();

    const chartDatasets: ChartDataset<'line', number[]>[] = datasets.map((dataset) => ({
      label: dataset.label,
      data: dataset.data,
      borderColor: dataset.color,
      backgroundColor: showArea ? toRgba(dataset.color, 0.2) : dataset.color,
      fill: showArea,
      pointRadius: 2,
      pointHoverRadius: 4,
      borderWidth: 2,
      tension: 0.35
    }));

    const options: ChartOptions<'line'> = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          labels: {
            color: textColor(darkMode)
          }
        },
        tooltip: {
          backgroundColor: darkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(15, 23, 42, 0.88)',
          titleColor: '#f8fafc',
          bodyColor: '#e2e8f0'
        }
      },
      scales: {
        x: {
          grid: {
            display: showGrid,
            color: () => gridColor(darkMode)
          },
          ticks: {
            color: textColor(darkMode)
          }
        },
        y: {
          grid: {
            display: showGrid,
            color: gridColor(darkMode)
          },
          ticks: {
            color: textColor(darkMode)
          }
        }
      }
    };

    chart?.destroy();
    chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: chartDatasets
      },
      options
    });
  };

  $effect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    createChart();
    const handleResize = () => chart?.resize();
    const classObserver = new MutationObserver(() => createChart());

    window.addEventListener('resize', handleResize);
    classObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    classObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      classObserver.disconnect();
      chart?.destroy();
      chart = undefined;
    };
  });
</script>

<div class="w-full" style={`height: ${height}px;`}>
  <canvas bind:this={canvas} aria-label="line chart" role="img"></canvas>
</div>
