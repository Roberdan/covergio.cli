<script lang="ts">
  import { Chart, registerables, type ChartDataset, type ChartOptions } from 'chart.js';

  interface BarDataset {
    label: string;
    data: number[];
    color: string;
  }

  interface BarChartProps {
    labels: string[];
    datasets: BarDataset[];
    horizontal?: boolean;
    stacked?: boolean;
    height?: number;
  }

  let { labels, datasets, horizontal = false, stacked = false, height = 280 }: BarChartProps =
    $props();

  let canvas: HTMLCanvasElement | undefined;
  let chart: Chart<'bar'> | undefined;
  let isRegistered = false;

  const ensureRegistered = () => {
    if (!isRegistered) {
      Chart.register(...registerables);
      isRegistered = true;
    }
  };

  const isDarkMode = () =>
    document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');

  const textColor = (dark: boolean) => (dark ? '#cbd5e1' : '#475569');
  const gridColor = (dark: boolean) =>
    dark ? 'rgba(148, 163, 184, 0.22)' : 'rgba(100, 116, 139, 0.18)';

  const createChart = () => {
    if (!canvas) {
      return;
    }

    ensureRegistered();
    const darkMode = isDarkMode();

    const chartDatasets: ChartDataset<'bar', number[]>[] = datasets.map((dataset) => ({
      label: dataset.label,
      data: dataset.data,
      backgroundColor: dataset.color,
      borderRadius: 8,
      maxBarThickness: 36
    }));

    const options: ChartOptions<'bar'> = {
      indexAxis: horizontal ? 'y' : 'x',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: textColor(darkMode)
          }
        }
      },
      scales: {
        x: {
          stacked,
          grid: {
            color: gridColor(darkMode)
          },
          ticks: {
            color: textColor(darkMode)
          }
        },
        y: {
          stacked,
          grid: {
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
      type: 'bar',
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
    const classObserver = new MutationObserver(() => createChart());

    classObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    classObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => {
      classObserver.disconnect();
      chart?.destroy();
      chart = undefined;
    };
  });
</script>

<div class="w-full" style={`height: ${height}px;`}>
  <canvas bind:this={canvas} aria-label="bar chart" role="img"></canvas>
</div>
