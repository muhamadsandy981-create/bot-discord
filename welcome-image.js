const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const WELCOME_BANNER_PATH = path.join(__dirname, 'assets', 'welcome-banner.png');
const THEME_COLOR = '#fd4ddf';
let welcomeBannerPromise;

async function buatGambarWelcome(member, event) {
    if (!welcomeBannerPromise) welcomeBannerPromise = loadImage(WELCOME_BANNER_PATH);
    const background = await welcomeBannerPromise;
    const canvas = createCanvas(background.width, background.height);
    const context = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    context.drawImage(background, 0, 0, width, height);

    const margin = Math.round(width * 0.025);
    const panelWidth = width - margin * 2;
    const panelHeight = Math.round(height * 0.34);
    const panelX = margin;
    const panelY = height - panelHeight - Math.round(height * 0.025);
    const radius = Math.round(height * 0.03);

    context.beginPath();
    context.roundRect(panelX, panelY, panelWidth, panelHeight, radius);
    context.fillStyle = 'rgba(9, 4, 18, 0.92)';
    context.fill();
    context.lineWidth = Math.max(5, Math.round(height * 0.008));
    context.strokeStyle = THEME_COLOR;
    context.stroke();

    const avatarSize = Math.round(height * 0.28);
    const avatarX = panelX + Math.round(height * 0.035);
    const avatarY = panelY + Math.round((panelHeight - avatarSize) / 2);
    const avatarCenterX = avatarX + avatarSize / 2;
    const avatarCenterY = avatarY + avatarSize / 2;
    let avatar;
    try {
        const response = await fetch(member.displayAvatarURL({ extension: 'png', size: 256 }));
        if (!response.ok) throw new Error(`Discord CDN returned HTTP ${response.status}.`);
        avatar = await loadImage(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
        console.error(`Gagal memuat avatar untuk kartu ${event} ${member.user.tag}:`, error);
    }

    context.save();
    context.beginPath();
    context.arc(avatarCenterX, avatarCenterY, avatarSize / 2, 0, Math.PI * 2);
    context.clip();
    if (avatar) {
        context.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
    } else {
        context.fillStyle = '#211126';
        context.fill();
        context.fillStyle = THEME_COLOR;
        context.font = `bold ${Math.round(avatarSize * 0.5)}px Arial`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(member.user.username.slice(0, 1).toUpperCase(), avatarCenterX, avatarCenterY);
    }
    context.restore();

    context.beginPath();
    context.arc(avatarCenterX, avatarCenterY, avatarSize / 2 + context.lineWidth, 0, Math.PI * 2);
    context.lineWidth = Math.max(5, Math.round(height * 0.008));
    context.strokeStyle = THEME_COLOR;
    context.stroke();

    const textX = avatarX + avatarSize + Math.round(height * 0.04);
    const countX = panelX + panelWidth - Math.round(height * 0.04);
    const textMaxWidth = Math.max(120, countX - textX - Math.round(height * 0.06));
    const labelY = panelY + Math.round(panelHeight * 0.38);
    const usernameY = panelY + Math.round(panelHeight * 0.76);
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    context.fillStyle = THEME_COLOR;
    context.font = `bold ${Math.round(height * 0.075)}px Arial`;
    context.fillText(event === 'welcome' ? 'WELCOME' : 'GOODBYE', textX, labelY);
    context.fillStyle = '#ffffff';
    let usernameFontSize = Math.round(height * 0.105);
    context.font = `bold ${usernameFontSize}px Arial`;
    while (usernameFontSize > Math.round(height * 0.05) && context.measureText(member.user.username).width > textMaxWidth) {
        usernameFontSize -= 2;
        context.font = `bold ${usernameFontSize}px Arial`;
    }
    context.fillText(member.user.username, textX, usernameY, textMaxWidth);

    const memberCount = Number.isSafeInteger(member.guild.memberCount) ? member.guild.memberCount : 0;
    context.textAlign = 'right';
    context.fillStyle = '#ffffff';
    context.font = `bold ${Math.round(height * 0.06)}px Arial`;
    context.fillText('MEMBER', countX, panelY + Math.round(panelHeight * 0.40));
    context.fillStyle = THEME_COLOR;
    context.font = `bold ${Math.round(height * 0.09)}px Arial`;
    context.fillText(`#${memberCount}`, countX, usernameY);

    return canvas.toBuffer('image/png');
}

module.exports = { buatGambarWelcome };
