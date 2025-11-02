class PumpkinParticle {
  constructor(x, y) {
    this.x = x + random(-6, 6);
    this.y = y + random(-6, 6);

    const baseAngle = random(0, TWO_PI);
    const speed = random(2, 6);
    this.vx = cos(baseAngle) * speed;
    this.vy = sin(baseAngle) * speed;

    this.life = int(random(120, 180));

    this.size = random(6, 12);
    this.rot = random(TWO_PI);
    this.rotSpeed = random(-0.03, 0.03);
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;

    this.vx *= 0.99;
    this.vy *= 0.99;

    this.rot += this.rotSpeed;
    this.life--;
  }

  draw() {
    const alpha = constrain(this.life / 120, 0, 1);
    push();
    translate(this.x, this.y);
    rotate(this.rot);

    noStroke();
    fill(255, 120, 0, 235 * alpha);
    ellipse(0, 0, this.size, this.size * 0.8);

    fill(255, 160, 40, 220 * alpha);
    ellipse(-this.size * 0.22, 0, this.size * 0.4, this.size * 0.75);
    ellipse(this.size * 0.22, 0, this.size * 0.4, this.size * 0.75);

    fill(50, 180, 80, 240 * alpha);
    rectMode(CENTER);
    rect(0, -this.size * 0.45, this.size * 0.18, this.size * 0.3, 4);

    pop();
  }

  alive() {
    return this.life > 0;
  }
}

window.ParticleSystem = class {
  constructor(max = 400) {
    this.max = max;
    this.ps = [];
  }

  emit(x, y, n = 8) {
    for (let i = 0; i < n; i++) {
      if (this.ps.length >= this.max) this.ps.shift();
      this.ps.push(new PumpkinParticle(x, y));
    }
  }

  update() {
    this.ps.forEach(p => p.update());
    this.ps = this.ps.filter(p => p.alive());
  }

  draw() {
    this.ps.forEach(p => p.draw());
  }
};
