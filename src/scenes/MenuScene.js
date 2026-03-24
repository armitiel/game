import Phaser from 'phaser';
import { GAME } from '../config/gameConfig.js';
import { t } from '../config/i18n.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    // Background image stretched to fill
    const bg = this.add.image(cx, cy, 'bckg');
    bg.setDisplaySize(this.scale.width, this.scale.height);

    // Logo
    const logo = this.add.image(cx, cy - 60, 'logo').setOrigin(0.5);
    // Scale logo to fit nicely (max width ~600px)
    const maxW = 600;
    if (logo.width > maxW) {
      logo.setScale(maxW / logo.width);
    }

    // Subtitle
    this.add.text(cx, cy + logo.displayHeight / 2 - 30, t('subtitle'), {
      font: '16px ChangaOne, monospace',
      fill: '#667788',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5);

    // Start button
    const isMobile = this.sys.game.device.input.touch;
    const startText = this.add.text(cx, cy + 100,
      isMobile ? t('tapToStart') : t('spaceToStart'), {
      font: '20px ChangaOne, monospace',
      fill: '#00ff88',
      stroke: '#003322', strokeThickness: 4
    }).setOrigin(0.5);

    // Blink effect
    this.tweens.add({
      targets: startText,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1
    });

    // Controls info
    if (isMobile) {
      this.add.text(cx, this.scale.height - 65, t('controlsMobile'), {
        font: '12px ChangaOne, monospace',
        fill: '#445566',
        stroke: '#000000', strokeThickness: 2
      }).setOrigin(0.5);
    } else {
      this.add.text(cx, this.scale.height - 80, t('controlsDesktop1'), {
        font: '12px ChangaOne, monospace',
        fill: '#445566',
        stroke: '#000000', strokeThickness: 2
      }).setOrigin(0.5);

      this.add.text(cx, this.scale.height - 55, t('controlsDesktop2'), {
        font: '12px ChangaOne, monospace',
        fill: '#445566',
        stroke: '#000000', strokeThickness: 2
      }).setOrigin(0.5);
    }

    // Visitor counter (bottom-right)
    const counterText = this.add.text(this.scale.width - 16, this.scale.height - 16, '', {
      font: '11px ChangaOne, monospace',
      fill: '#334455',
      stroke: '#000000', strokeThickness: 2
    }).setOrigin(1, 1);

    // ?owner=SECRET sets localStorage flag to exclude self from counter
    const params = new URLSearchParams(window.location.search);
    const ownerParam = params.get('owner');
    if (ownerParam) {
      localStorage.setItem('st_owner', ownerParam);
    }
    const ownerSecret = localStorage.getItem('st_owner') || '';

    const headers = {};
    if (ownerSecret) headers['x-owner'] = ownerSecret;

    fetch('/api/visit', { method: 'POST', headers })
      .then(r => r.json())
      .then(data => {
        if (data.count != null) {
          counterText.setText(`${t('visitors')}: ${data.count}`);
        }
      })
      .catch(() => {});

    // Input — keyboard + touch
    this.input.keyboard.once('keydown-SPACE', () => {
      this.scene.start('LevelSelectScene');
    });
    this.input.once('pointerdown', () => {
      this.scene.start('LevelSelectScene');
    });
  }
}
