<script lang="ts">
  import { Chart, registerables, type ChartOptions } from 'chart.js';

  interface DonutChartProps {
    labels: string[];
    data: number[];
    colors: string[];
    centerLabel?: string;
    centerValue?: string | number;
    height?: number;
  }

  let { labels, data, colors, centerLabel = '', centerValue = '', height = 260 }: DonutChartProps =
    $props();

  let canvas: HTMLCanvasElement | undefined;
  let chart: Chart<'doughnut'> | undefined;
  let isRegistered = false;

  const ensureRegistered = () => {
    if (!isRegistered) {
      Chart.register(...registerables);
      isRegistered = true;
    }
  };

  const isDarkMode = () =>
    document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');

  const createChart = () => {
    if (!canvas) {
      return;
    }

    ensureRegistered();
    const darkMode = isDarkMode();

    const options: ChartOptions<'doughnut'> = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      animation: {
        animateRotate: true,
        duration: 900,
        easing: 'easeOutQuart'
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: darkMode ? '#cbd5e1' : '#475569',
            boxWidth: 12,
            boxHeight: 12
          }
        },
        tooltip: {
          backgroundColor: darkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(15, 23, 42, 0.88)',
          titleColor: '#f8fafc',
          bodyColor: '#e2e8f0'
        }
      }
    };

    chart?.destroy();
    chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: colors,
            borderColor: darkMode ? '#0f172a' : '#ffffff',
            borderWidth: 2,
            hoverOffset: 6
          }
        ]
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

<div class="relative w-full" style={`height: ${height}px;`}>
  <canvas bind:this={canvas} aria-label="donut chart" role="img"></canvas>
  {#if centerLabel || centerValue}
    <div
      class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
      aria-hidden="true"
    >
      {#if centerLabel}
        <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{centerLabel}</p>
      {/if}
      {#if centerValue !== ''}
        <p class="text-xl font-semibold text-slate-900 dark:text-slate-100">{centerValue}</p>
      {/if}
    </div>
  {/if}
</div>
