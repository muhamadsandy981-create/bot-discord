const { createCanvas } = require('@napi-rs/canvas');

const THEME_COLOR = '#fd4ddf';
const BACKGROUND_COLOR = '#202127';
const WIDTH = 720;
const HEIGHT = 290;

function roundedRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
}

function buatGambarMines({ betText, minesText, cashOutText, nextCashOutText, status }) {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const context = canvas.getContext('2d');

    context.fillStyle = BACKGROUND_COLOR;
    context.fillRect(0, 0, WIDTH, HEIGHT);
    roundedRect(context, 10, 10, WIDTH - 20, HEIGHT - 20, 24);
    context.strokeStyle = THEME_COLOR;
    context.lineWidth = 8;
    context.stroke();

    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.fillStyle = '#ffffff';
    context.font = 'bold 34px Arial';
    context.fillText(status === 'loss' ? 'Mines — You hit a mine!' : status === 'cashout' ? 'Mines — Cash out!' : status === 'win' ? 'Mines — You won!' : 'Mines', 42, 62);

    context.fillStyle = '#f5f5f7';
    context.font = 'bold 26px Arial';
    context.fillText(`Bet: ${betText}`, 42, 126);
    context.textAlign = 'right';
    context.fillText(`Mines: ${minesText}`, WIDTH - 42, 126);
    context.textAlign = 'left';
    context.font = '24px Arial';
    context.fillText(`Cash Out: ${cashOutText}`, 42, 176);
    context.fillText(`Next: ${nextCashOutText}`, 42, 216);

    return canvas.toBuffer('image/png');
}

module.exports = { buatGambarMines };
