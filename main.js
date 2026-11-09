/**
 * Controlador principal que maneja el bucle en tiempo real del juego,
 * los eventos del DOM, la sincronización con el motor de audio y la bitácora experimental
*/

class GameController {
  constructor() {
    this.sim = new window.ForestSimulation(70);
    this.sound = new window.SoundEngine();

    const forestCanvas = document.getElementById("forestCanvas");
    const chartCanvas = document.getElementById("chartCanvas");
    this.renderer = new window.SimulationRenderer(forestCanvas, chartCanvas);

    this.isRunning = false;
    this.isGameOver = false;
    this.stepIntervalMs = 160;
    this.lastStepTimestamp = 0;

    this.pointer = {
      inside: false,
      pressing: false,
      row: 0,
      col: 0
    };

    this.experimentRuns = [];

    this.cacheDOMElements();
    this.bindEvents();
    this.updatePercolationUI();
    this.updateMetricsUI();
    this.requestLoop();
  }

  // Almacena referencias a los elementos del DOM para optimizar actualizaciones
  cacheDOMElements() {
    this.btnStartPause = document.getElementById("btnStartPause");
    this.btnStep = document.getElementById("btnStep");
    this.btnReset = document.getElementById("btnReset");
    this.btnMute = document.getElementById("btnMute");
    this.btnOverlayRestart = document.getElementById("btnOverlayRestart");
    this.btnExportCSV = document.getElementById("btnExportCSV");
    this.btnClearLog = document.getElementById("btnClearLog");

    this.inputDensity = document.getElementById("inputDensity");
    this.inputProb = document.getElementById("inputProb");
    this.inputSpeed = document.getElementById("inputSpeed");
    this.inputRadius = document.getElementById("inputRadius");

    this.labelDensity = document.getElementById("labelDensity");
    this.labelProb = document.getElementById("labelProb");
    this.labelSpeed = document.getElementById("labelSpeed");
    this.labelRadius = document.getElementById("labelRadius");

    this.effectiveDensityValue = document.getElementById("effectiveDensityValue");
    this.percolationBar = document.getElementById("percolationBar");
    this.percolationRegimeText = document.getElementById("percolationRegimeText");

    this.statusBadge = document.getElementById("statusBadge");
    this.scoreValue = document.getElementById("scoreValue");
    this.extinguishedValue = document.getElementById("extinguishedValue");
    this.tickValue = document.getElementById("tickValue");
    this.savedPercentValue = document.getElementById("savedPercentValue");

    this.countTree = document.getElementById("countTree");
    this.countFire = document.getElementById("countFire");
    this.countExtinguished = document.getElementById("countExtinguished");
    this.countAsh = document.getElementById("countAsh");

    this.gameOverOverlay = document.getElementById("gameOverOverlay");
    this.overlayTitle = document.getElementById("overlayTitle");
    this.overlaySubtitle = document.getElementById("overlaySubtitle");
    this.overlayScore = document.getElementById("overlayScore");
    this.overlaySaved = document.getElementById("overlaySaved");
    this.overlayTicks = document.getElementById("overlayTicks");

    this.experimentLogBody = document.getElementById("experimentLogBody");
  }

  // Registra los event listeners de controles y ratón
  bindEvents() {
    this.btnStartPause.addEventListener("click", () => {
      this.sound.playButtonClick();
      this.toggleStartPause();
    });

    this.btnStep.addEventListener("click", () => {
      this.sound.playButtonClick();
      if (!this.isGameOver) {
        this.pauseSimulation();
        this.executeSimulationStep();
      }
    });

    this.btnReset.addEventListener("click", () => {
      this.sound.playButtonClick();
      this.resetSimulation();
    });

    this.btnOverlayRestart.addEventListener("click", () => {
      this.sound.playButtonClick();
      this.resetSimulation();
    });

    this.btnMute.addEventListener("click", () => {
      const isMuted = this.sound.toggleMute();
      this.btnMute.textContent = isMuted ? "Sonido: silenciado" : "Sonido: activo";
      if (!isMuted) {
        this.sound.playButtonClick();
      }
    });

    this.inputDensity.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      this.sim.density = val;
      this.labelDensity.textContent = val.toFixed(2);
      this.updatePercolationUI();
      if (this.sim.tickCount === 0 && !this.isRunning) {
        this.sim.initializeForest();
        this.updateMetricsUI();
      }
    });

    this.inputProb.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      this.sim.propagationProb = val;
      this.labelProb.textContent = val.toFixed(2);
      this.updatePercolationUI();
    });

    this.inputSpeed.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      this.stepIntervalMs = val;
      this.labelSpeed.textContent = val + " ms";
    });

    this.inputRadius.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      this.sim.waterRadius = val;
      this.labelRadius.textContent = String(val);
    });

    // Eventos de puntero sobre el lienzo del bosque
    const canvas = this.renderer.forestCanvas;

    const updatePointerPosition = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      const relX = Math.max(0, Math.min(rect.width - 1, clientX - rect.left));
      const relY = Math.max(0, Math.min(rect.height - 1, clientY - rect.top));
      this.pointer.col = Math.floor((relX / rect.width) * this.sim.size);
      this.pointer.row = Math.floor((relY / rect.height) * this.sim.size);
    };

    canvas.addEventListener("pointerenter", (e) => {
      this.pointer.inside = true;
      updatePointerPosition(e.clientX, e.clientY);
    });

    canvas.addEventListener("pointermove", (e) => {
      this.pointer.inside = true;
      updatePointerPosition(e.clientX, e.clientY);
    });

    canvas.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || this.isGameOver) return;
      this.pointer.pressing = true;
      updatePointerPosition(e.clientX, e.clientY);
      this.sound.startWaterSpray();
    });

    window.addEventListener("pointerup", () => {
      if (this.pointer.pressing) {
        this.pointer.pressing = false;
        this.sound.stopWaterSpray();
      }
    });

    canvas.addEventListener("pointerleave", () => {
      this.pointer.inside = false;
      this.pointer.pressing = false;
      this.sound.stopWaterSpray();
    });

    this.btnExportCSV.addEventListener("click", () => {
      this.sound.playButtonClick();
      this.exportExperimentCSV();
    });

    this.btnClearLog.addEventListener("click", () => {
      this.sound.playButtonClick();
      this.experimentRuns = [];
      this.renderExperimentTable();
    });
  }

  // Alterna entre ejecución continua y pausa
  toggleStartPause() {
    if (this.isGameOver) {
      this.resetSimulation();
    }
    this.isRunning = !this.isRunning;
    if (this.isRunning) {
      this.lastStepTimestamp = performance.now();
      this.btnStartPause.textContent = "Pausar";
      this.statusBadge.textContent = "EN CURSO";
      this.statusBadge.className = "text-xs font-mono px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700";
    } else {
      this.pauseSimulation();
    }
  }

  // Pausa la simulación activa
  pauseSimulation() {
    this.isRunning = false;
    this.sound.stopWaterSpray();
    this.btnStartPause.textContent = "Continuar";
    if (!this.isGameOver) {
      this.statusBadge.textContent = "PAUSADO";
      this.statusBadge.className = "text-xs font-mono px-2 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-700";
    }
  }

  // Reinicia el bosque y todos los indicadores de partida
  resetSimulation() {
    this.isRunning = false;
    this.isGameOver = false;
    this.sound.stopWaterSpray();
    this.gameOverOverlay.classList.add("hidden");
    this.btnStartPause.textContent = "Iniciar";
    this.statusBadge.textContent = "LISTO";
    this.statusBadge.className = "text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300";

    this.sim.initializeForest();
    this.updateMetricsUI();
    this.renderer.renderChart(this.sim);
  }

  // Ejecuta un paso discreto del automata celular y verifica condición de parada
  executeSimulationStep() {
    const result = this.sim.step();

    if (result.newFires > 0) {
      this.sound.playFireSpreadPulse(result.newFires);
    }

    this.updateMetricsUI();
    this.renderer.renderChart(this.sim);

    if (result.activeFires === 0) {
      this.finishSimulation();
    }
  }

  // Finaliza la partida cuando ya no quedan focos de incendio activos
  finishSimulation() {
    this.isRunning = false;
    this.isGameOver = true;
    this.sound.stopWaterSpray();

    const counts = this.sim.getCounts();
    const savedPct = counts.savedPercent;
    const bonusSavedTrees = counts.tree * 5;
    this.sim.score += bonusSavedTrees;

    this.updateMetricsUI();

    this.btnStartPause.textContent = "Reiniciar";
    this.statusBadge.textContent = "FINALIZADO";
    this.statusBadge.className = "text-xs font-mono px-2 py-0.5 rounded bg-sky-900/60 text-sky-300 border border-sky-700";

    const highPreservation = savedPct >= 50;
    this.sound.playSimulationEnd(highPreservation);

    this.overlayTitle.textContent = highPreservation
      ? "Incendio contenido con éxito"
      : "Incendio extinguido con alta pérdida forestal";
    this.overlaySubtitle.textContent =
      "Se conservaron " + counts.tree + " árboles vivos y se extinguieron manualmente " +
      this.sim.extinguishedTreesCount + " focos activos (bonificación de +" + bonusSavedTrees + " pts por bosque intacto).";
    this.overlayScore.textContent = String(this.sim.score);
    this.overlaySaved.textContent = savedPct.toFixed(1) + "%";
    this.overlayTicks.textContent = this.sim.tickCount + " pasos";

    this.gameOverOverlay.classList.remove("hidden");
    this.recordExperimentRun(counts);
  }

  // Actualiza el indicador matemático de percolación en la interfaz
  updatePercolationUI() {
    const pEf = this.sim.getEffectivePercolation();
    this.effectiveDensityValue.textContent = pEf.toFixed(3);
    const pct = Math.min(100, Math.max(0, pEf * 100));
    this.percolationBar.style.width = pct.toFixed(1) + "%";

    if (pEf < 0.55) {
      this.percolationBar.className = "bg-emerald-500 h-full transition-all duration-200";
      this.percolationRegimeText.textContent = "Régimen subcrítico (P_ef < 0.59: tendencia a autoextinción)";
    } else if (pEf <= 0.63) {
      this.percolationBar.className = "bg-amber-500 h-full transition-all duration-200";
      this.percolationRegimeText.textContent = "Régimen crítico (cercano al umbral de percolación 0.590)";
    } else {
      this.percolationBar.className = "bg-red-500 h-full transition-all duration-200";
      this.percolationRegimeText.textContent = "Régimen supercrítico (P_ef > 0.59: propagación a gran escala)";
    }
  }

  // Actualiza los contadores numéricos del panel lateral
  updateMetricsUI() {
    const counts = this.sim.getCounts();
    this.scoreValue.textContent = String(this.sim.score);
    this.extinguishedValue.textContent = String(this.sim.extinguishedTreesCount);
    this.tickValue.textContent = String(this.sim.tickCount);
    this.savedPercentValue.textContent = counts.savedPercent.toFixed(1) + "%";

    this.countTree.textContent = String(counts.tree);
    this.countFire.textContent = String(counts.fire);
    this.countExtinguished.textContent = String(counts.extinguished);
    this.countAsh.textContent = String(counts.empty);
  }

  // Registra los resultados de la ejecución actual en la tabla de bitácora experimental
  recordExperimentRun(counts) {
    const runData = {
      id: this.experimentRuns.length + 1,
      density: this.sim.density.toFixed(2),
      prob: this.sim.propagationProb.toFixed(2),
      pEf: this.sim.getEffectivePercolation().toFixed(3),
      ticks: this.sim.tickCount,
      extinguished: this.sim.extinguishedTreesCount,
      savedPercent: counts.savedPercent.toFixed(1),
      score: this.sim.score
    };
    this.experimentRuns.push(runData);
    this.renderExperimentTable();
  }

  // Renderiza las filas de la tabla de bitácora experimental
  renderExperimentTable() {
    if (this.experimentRuns.length === 0) {
      this.experimentLogBody.innerHTML =
        '<tr><td colspan="8" class="py-4 text-center text-slate-500 font-sans">' +
        'Aun no hay resultados registrados. Complete una simulación para almacenar los datos' +
        '</td></tr>';
      return;
    }

    this.experimentLogBody.innerHTML = this.experimentRuns
      .map((run) => {
        return (
          '<tr class="hover:bg-slate-800/40">' +
          '<td class="py-2 px-2">' + run.id + '</td>' +
          '<td class="py-2 px-2">' + run.density + '</td>' +
          '<td class="py-2 px-2">' + run.prob + '</td>' +
          '<td class="py-2 px-2 text-amber-400">' + run.pEf + '</td>' +
          '<td class="py-2 px-2">' + run.ticks + '</td>' +
          '<td class="py-2 px-2 text-sky-400">' + run.extinguished + '</td>' +
          '<td class="py-2 px-2 text-emerald-400">' + run.savedPercent + '%</td>' +
          '<td class="py-2 px-2 font-bold">' + run.score + '</td>' +
          '</tr>'
        );
      })
      .join("");
  }

  // Exporta los registros experimentales en formato CSV para el informe técnico
  exportExperimentCSV() {
    if (this.experimentRuns.length === 0) return;

    const headers = [
      "Ejecución",
      "Densidad_inicial",
      "Prob_ignición",
      "Densidad_efectiva",
      "Pasos_temporales",
      "Árboles_extinguidos",
      "Porcentaje_conservado",
      "Puntuación_final"
    ];

    const rows = this.experimentRuns.map((r) => [
      r.id,
      r.density,
      r.prob,
      r.pEf,
      r.ticks,
      r.extinguished,
      r.savedPercent,
      r.score
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "bitacora_incendios_estocasticos.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Bucle principal a 60 FPS para renderizado fluido y aplicación de agua en tiempo real
  requestLoop() {
    const loop = (timestamp) => {
      if (!this.isGameOver && this.pointer.pressing && this.pointer.inside) {
        const newlyExtinguished = this.sim.applyWaterAt(this.pointer.row, this.pointer.col, 0.14);
        if (newlyExtinguished > 0) {
          this.sound.playExtinguishPoint();
          this.updateMetricsUI();
          const currentCounts = this.sim.getCounts();
          if (currentCounts.fire === 0) {
            this.finishSimulation();
          }
        }
      }

      if (this.isRunning && !this.isGameOver) {
        if (timestamp - this.lastStepTimestamp >= this.stepIntervalMs) {
          this.lastStepTimestamp = timestamp;
          this.executeSimulationStep();
        }
      }

      this.renderer.renderForest(this.sim, this.pointer);
      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.gameApp = new GameController();
});