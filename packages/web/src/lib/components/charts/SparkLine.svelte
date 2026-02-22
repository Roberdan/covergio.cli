<script lang="ts">
  import { Chart, registerables, type ChartOptions } from 'chart.js';

  interface SparkLineProps {
    data: number[];
    color?: string;
    width?: number;
    height?: number;
  }

  let { data, color, width = 120, height = 32 }: SparkLineProps = $props();

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

  const createChart = () => {
    if (!canvas) {
      return;
    }

    ensureRegistered();

    const darkMode = isDarkMode();
    const resolvedColor = color ?? (darkMode ? '#60a5fa' : '#3b82f6');

    const options: ChartOptions<'line'> = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 450
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: false
        }
      },
      elements: {
        point: {
          radius: 0,
          hoverRadius: 0
        },
        line: {
          borderWidth: 2,
          tension: 0.35
        }
      },
      scales: {
        x: {
          display: false
        },
        y: {
          display: false
        }
      }
    };

    chart?.destroy();
    chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.map((_, index) => `${index + 1}`),
        datasets: [
            {
              data,
              borderColor: resolvedColor,
              backgroundColor: resolvedColor,
              fill: false
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

<div class="inline-block" style={`width: ${width}px; height: ${height}px;`}>
  <canvas bind:this={canvas} aria-label="spark line" role="img"></canvas>
</div>
