// ==========================================================
// RATIVASNACK — SIMULAÇÃO COMPARTILHADA
// ==========================================================

const SIMULATION_RATE = 60;
const PLAYER_SPEED = 2.8;
const BOOST_MULTIPLIER = 1.7;
const SEGMENT_SPACING = 5;
const INITIAL_SEGMENTS = 10;
const FOOD_COUNT = 30;
const WORLD_SIZE = 3000;

class Snake {
  constructor(id, name, color, x, y) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.x = x;
    this.y = y;
    this.angle = 0;
    this.targetAngle = 0;
    this.segments = [];
    this.alive = true;
    this.score = 0;
    this.boosting = false;
    this.boostCooldown = 0;
    
    for (let i = 0; i < INITIAL_SEGMENTS; i++) {
      this.segments.push({ x: x - i * SEGMENT_SPACING, y });
    }
  }

  update(dt, foods, allSnakes) {
    if (!this.alive) return;

    const speed = this.boosting && this.boostCooldown <= 0 
      ? PLAYER_SPEED * BOOST_MULTIPLIER 
      : PLAYER_SPEED;

    let angleDiff = this.targetAngle - this.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.angle += angleDiff * 0.15;

    this.x += Math.cos(this.angle) * speed * dt * 60;
    this.y += Math.sin(this.angle) * speed * dt * 60;

    const halfWorld = WORLD_SIZE / 2;
    if (this.x < -halfWorld) this.x = halfWorld;
    if (this.x > halfWorld) this.x = -halfWorld;
    if (this.y < -halfWorld) this.y = halfWorld;
    if (this.y > halfWorld) this.y = -halfWorld;

    let prevX = this.x, prevY = this.y;
    for (const seg of this.segments) {
      const dx = prevX - seg.x;
      const dy = prevY - seg.y;
      const dist = Math.hypot(dx, dy);
      if (dist >= SEGMENT_SPACING) {
        const f = SEGMENT_SPACING / dist;
        seg.x = prevX - dx * f;
        seg.y = prevY - dy * f;
      }
      prevX = seg.x;
      prevY = seg.y;
    }

    for (let i = foods.length - 1; i >= 0; i--) {
      const food = foods[i];
      if (Math.hypot(this.x - food.x, this.y - food.y) < 12) {
        foods.splice(i, 1);
        this.score += 10;
        this.grow();
        foods.push(createRandomFood());
      }
    }

    if (this.boostCooldown > 0) this.boostCooldown -= dt;
  }

  grow() {
    const last = this.segments[this.segments.length - 1];
    this.segments.push({ x: last.x, y: last.y });
  }

  die(killerId) {
    this.alive = false;
    this.deathTime = Date.now();
    this.killerId = killerId;
  }

  applyInput(input) {
    if (input.dirX !== undefined && input.dirY !== undefined) {
      this.targetAngle = Math.atan2(input.dirY, input.dirX);
    }
    this.boosting = !!input.boost;
  }

  getState() {
    return {
      id: this.id,
      n: this.name,
      c: this.color,
      x: this.x,
      y: this.y,
      a: this.angle,
      s: this.score,
      l: this.alive ? 1 : 0,
      b: this.boosting ? 1 : 0,
      bc: this.boostCooldown,
      segs: this.segments.map(s => ({ x: s.x, y: s.y }))
    };
  }
}

function createRandomFood() {
  const halfWorld = WORLD_SIZE / 2;
  return {
    x: (Math.random() - 0.5) * WORLD_SIZE,
    y: (Math.random() - 0.5) * WORLD_SIZE,
    color: ['#ffd34e','#ff8fa5','#75f0bd','#9d4bfa'][Math.floor(Math.random() * 4)]
  };
}

class Simulation {
  constructor() {
    this.snakes = new Map();
    this.foods = [];
    this.lastTime = Date.now() / 1000;
    this.frame = 0;
    
    for (let i = 0; i < FOOD_COUNT; i++) {
      this.foods.push(createRandomFood());
    }
  }

  addSnake(id, name, color) {
    const halfWorld = WORLD_SIZE / 2;
    const angle = Math.random() * Math.PI * 2;
    const dist = 150 + Math.random() * 300;
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    
    const snake = new Snake(id, name, color, x, y);
    this.snakes.set(id, snake);
    return snake;
  }

  removeSnake(id) {
    this.snakes.delete(id);
  }

  applyInput(playerId, input) {
    const snake = this.snakes.get(playerId);
    if (snake && snake.alive) {
      snake.applyInput(input);
    }
  }

  update() {
    const now = Date.now() / 1000;
    const dt = Math.min(now - this.lastTime, 0.05);
    this.lastTime = now;
    this.frame++;

    const snakesArr = Array.from(this.snakes.values());

    for (const snake of snakesArr) {
      snake.update(dt, this.foods, snakesArr);
    }

    for (const snake of snakesArr) {
      if (!snake.alive) continue;
      for (const other of snakesArr) {
        if (other.id === snake.id || !other.alive) continue;
        for (let i = 1; i < other.segments.length - 2; i++) {
          const seg = other.segments[i];
          if (Math.hypot(snake.x - seg.x, snake.y - seg.y) < 6) {
            snake.die(other.id);
            break;
          }
        }
        if (!snake.alive) break;
      }
    }
  }

  getFullState() {
    return {
      t: Date.now(),
      f: this.frame,
      foods: this.foods.map(f => ({ x: f.x, y: f.y, c: f.color })),
      snakes: Array.from(this.snakes.values()).map(s => s.getState())
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Simulation, Snake, createRandomFood, WORLD_SIZE };
}
