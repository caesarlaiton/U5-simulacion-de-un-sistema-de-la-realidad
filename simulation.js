/**
 * Modelo matemático del autómata celular estocástico para la propagación
 * de incendios forestales y mecánica de enfriamiento por agua
*/

const CELL_STATE = {
  EMPTY: 0,
  TREE: 1,
  FIRE: 2,
  EXTINGUISHED: 3
};

class ForestSimulation {
  /**
   * @param {number} size dimensión de la cuadrícula cuadrada (N x N).
   */
  constructor(size = 70) {
    this.size = size;
    this.density = 0.85;
    this.propagationProb = 0.80;
    this.waterRadius = 3;

    this.grid = this.createMatrix(0);
    this.heat = this.createMatrix(0);

    this.tickCount = 0;
    this.score = 0;
    this.extinguishedTreesCount = 0;
    this.initialTreesCount = 0;
    this.history = [];

    this.initializeForest();
  }

  // Crea una matriz cuadrada inicializada con un valor constante
  createMatrix(initialValue = 0) {
    return Array.from({ length: this.size }, () => Array(this.size).fill(initialValue));
  }

  /**
   * Genera el bosque inicial de forma estocástica según la densidad configurada
   * e inicia el foco de incendio en el centro de la cuadrícula
  */
  initializeForest() {
    this.tickCount = 0;
    this.score = 0;
    this.extinguishedTreesCount = 0;
    this.initialTreesCount = 0;
    this.history = [];

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (Math.random() < this.density) {
          this.grid[r][c] = CELL_STATE.TREE;
          this.heat[r][c] = 0;
          this.initialTreesCount++;
        } else {
          this.grid[r][c] = CELL_STATE.EMPTY;
          this.heat[r][c] = 0;
        }
      }
    }

    // Semilla inicial de fuego en una región central de 2x2 para asegurar actividad inicial
    const mid = Math.floor(this.size / 2);
    const seeds = [
      [mid, mid],
      [mid - 1, mid],
      [mid, mid - 1]
    ];

    seeds.forEach(([r, c]) => {
      if (this.grid[r][c] !== CELL_STATE.TREE) {
        this.initialTreesCount++;
      }
      this.grid[r][c] = CELL_STATE.FIRE;
      this.heat[r][c] = 1.0;
    });

    this.recordHistorySnapshot();
  }

  /**
   * Calcula la densidad efectiva de percolación (D * P_prop)
   */
  getEffectivePercolation() {
    return this.density * this.propagationProb;
  }

  /**
   * Verifica si una celda (r, c) tiene al menos un vecino ortogonal en estado FIRE.
   * Utiliza condiciones de frontera cerradas (sin efecto envolvente)
   */
  hasBurningNeighbor(r, c) {
    if (r > 0 && this.grid[r - 1][c] === CELL_STATE.FIRE) return true;
    if (r < this.size - 1 && this.grid[r + 1][c] === CELL_STATE.FIRE) return true;
    if (c > 0 && this.grid[r][c - 1] === CELL_STATE.FIRE) return true;
    if (c < this.size - 1 && this.grid[r][c + 1] === CELL_STATE.FIRE) return true;
    return false;
  }

  /**
   * Ejecuta un paso discreto de tiempo del autómata celular estocástico.
   * @returns {Object} resumen del paso con cantidad de nuevos fuegos y estado de actividad
   */
  step() {
    const nextGrid = this.createMatrix(0);
    const nextHeat = this.createMatrix(0);
    let newFires = 0;

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const currentState = this.grid[r][c];

        if (currentState === CELL_STATE.TREE) {
          if (this.hasBurningNeighbor(r, c) && Math.random() < this.propagationProb) {
            nextGrid[r][c] = CELL_STATE.FIRE;
            nextHeat[r][c] = 1.0;
            newFires++;
          } else {
            nextGrid[r][c] = CELL_STATE.TREE;
            nextHeat[r][c] = 0;
          }
        } else if (currentState === CELL_STATE.FIRE) {
          // el fuego se consume tras el paso de tiempo y deja ceniza/vacío
          nextGrid[r][c] = CELL_STATE.EMPTY;
          nextHeat[r][c] = 0;
        } else {
          nextGrid[r][c] = currentState;
          nextHeat[r][c] = 0;
        }
      }
    }

    this.grid = nextGrid;
    this.heat = nextHeat;
    this.tickCount++;
    const counts = this.recordHistorySnapshot();

    return {
      newFires,
      activeFires: counts.fire
    };
  }

  /**
   * Aplica enfriamiento continuo sobre las celdas dentro del radio de acción del agua
   * @param {number} centerRow fila central del puntero
   * @param {number} centerCol columna central del puntero
   * @param {number} coolingDelta reducción de calor por cuadro de animación
   * @returns {number} cantidad de árboles en llamas extinguidos en esta aplicación
  */
  applyWaterAt(centerRow, centerCol, coolingDelta = 0.14) {
    let newlyExtinguished = 0;
    const rad = this.waterRadius;

    const rMin = Math.max(0, centerRow - rad);
    const rMax = Math.min(this.size - 1, centerRow + rad);
    const cMin = Math.max(0, centerCol - rad);
    const cMax = Math.min(this.size - 1, centerCol + rad);

    for (let r = rMin; r <= rMax; r++) {
      for (let c = cMin; c <= cMax; c++) {
        const distSq = (r - centerRow) * (r - centerRow) + (c - centerCol) * (c - centerCol);
        if (distSq <= rad * rad && this.grid[r][c] === CELL_STATE.FIRE) {
          this.heat[r][c] -= coolingDelta;
          if (this.heat[r][c] <= 0) {
            this.grid[r][c] = CELL_STATE.EXTINGUISHED;
            this.heat[r][c] = 0;
            this.extinguishedTreesCount++;
            this.score += 100;
            newlyExtinguished++;
          }
        }
      }
    }

    return newlyExtinguished;
  }

  // Cuenta la población actual de cada estado en la cuadrícula
  getCounts() {
    let tree = 0;
    let fire = 0;
    let extinguished = 0;
    let empty = 0;

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const state = this.grid[r][c];
        if (state === CELL_STATE.TREE) tree++;
        else if (state === CELL_STATE.FIRE) fire++;
        else if (state === CELL_STATE.EXTINGUISHED) extinguished++;
        else empty++;
      }
    }

    const totalSaved = tree + extinguished;
    const savedPercent = this.initialTreesCount > 0
      ? (totalSaved / this.initialTreesCount) * 100
      : 0;

    return {
      tree,
      fire,
      extinguished,
      empty,
      savedPercent
    };
  }

  // Guarda un snapshot de las poblaciones para graficar la curva temporal
  recordHistorySnapshot() {
    const counts = this.getCounts();
    this.history.push({
      tick: this.tickCount,
      tree: counts.tree,
      fire: counts.fire,
      extinguished: counts.extinguished,
      empty: counts.empty
    });
    return counts;
  }
}

window.CELL_STATE = CELL_STATE;
window.ForestSimulation = ForestSimulation;