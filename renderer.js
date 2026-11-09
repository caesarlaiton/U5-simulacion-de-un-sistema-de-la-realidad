/**
 * Renderizado gráfico en un Canvas de HTML5 para la cuadrícula del autómata
 * celular y la gráfica temporal de evolución de estados
*/

class SimulationRenderer {
  /**
   * @param {HTMLCanvasElement} forestCanvas lienzo principal del bosque
   * @param {HTMLCanvasElement} chartCanvas lienzo para la curva temporal
  */
  constructor(forestCanvas, chartCanvas) {
    this.forestCanvas = forestCanvas;
    this.forestCtx = forestCanvas.getContext("2d");
    this.chartCanvas = chartCanvas;
    this.chartCtx = chartCanvas.getContext("2d");
  }

  /**
   * Dibuja el estado completo del bosque y el indicador del chorro de agua
   * @param {ForestSimulation} sim instancia del modelo matemático
   * @param {Object} pointer estado actual del puntero del usuario
  */
  renderForest(sim, pointer) {
    const ctx = this.forestCtx;
    const width = this.forestCanvas.width;
    const height = this.forestCanvas.height;
    const cellSize = width / sim.size;

    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, width, height);

    for (let r = 0; r < sim.size; r++) {
      for (let c = 0; c < sim.size; c++) {
        const state = sim.grid[r][c];
        if (state === window.CELL_STATE.EMPTY) {
          continue;
        }

        if (state === window.CELL_STATE.TREE) {
          ctx.fillStyle = "#16a34a";
        } else if (state === window.CELL_STATE.FIRE) {
          const heatVal = sim.heat[r][c];
          // Transición cromática según el nivel de calor restante de la llama
          if (heatVal > 0.65) {
            ctx.fillStyle = "#ef4444";
          } else if (heatVal > 0.35) {
            ctx.fillStyle = "#f97316";
          } else {
            ctx.fillStyle = "#facc15";
          }
        } else if (state === window.CELL_STATE.EXTINGUISHED) {
          ctx.fillStyle = "#0284c7";
        }

        ctx.fillRect(
          c * cellSize + 0.5,
          r * cellSize + 0.5,
          cellSize - 0.8,
          cellSize - 0.8
        );
      }
    }

    // Dibuja el anillo de alcance del agua cuando el cursor está dentro del lienzo
    if (pointer && pointer.inside) {
      const centerX = (pointer.col + 0.5) * cellSize;
      const centerY = (pointer.row + 0.5) * cellSize;
      const radiusPx = sim.waterRadius * cellSize;

      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radiusPx, 0, Math.PI * 2);

      if (pointer.pressing) {
        ctx.fillStyle = "rgba(56, 189, 248, 0.28)";
        ctx.fill();
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = "rgba(148, 163, 184, 0.55)";
        ctx.lineWidth = 1.2;
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Dibuja la gráfica de líneas con la evolución temporal de las poblaciones
   * @param {ForestSimulation} sim instancia del modelo matemático
  */
  renderChart(sim) {
    const ctx = this.chartCtx;
    const width = this.chartCanvas.width;
    const height = this.chartCanvas.height;
    const history = sim.history;

    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, width, height);

    // Líneas guía horizontales
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (history.length < 2) return;

    const totalCells = sim.size * sim.size;
    const maxPoints = Math.max(60, history.length);

    const drawSeries = (key, color, scaleFactor = 1.0) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (let i = 0; i < history.length; i++) {
        const x = (i / (maxPoints - 1)) * (width - 16) + 8;
        const normalized = Math.min(1, (history[i][key] * scaleFactor) / totalCells);
        const y = height - 8 - normalized * (height - 16);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    drawSeries("tree", "#16a34a", 1.0);
    drawSeries("fire", "#ef4444", 3.0);
    drawSeries("extinguished", "#0284c7", 2.0);
  }
}

window.SimulationRenderer = SimulationRenderer;