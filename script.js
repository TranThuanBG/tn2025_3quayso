// ====== CẤU HÌNH & DỮ LIỆU TỐI ƯU ======
const STORAGE_EMPLOYEES = "employeesData";
const STORAGE_EMPLOYEES_ORIG = "employeesDataOriginal";
const STORAGE_WINNERS = "winnersData";
const STORAGE_PRIZE_CFG = "prizeConfig";
const CONFIG_PASSWORD = "Foxconn168!!";

const awardBasePath = "./Vongquaymayman/";
const awardTracks = ["award1.mp3", "award2.mp3", "award3.mp3"];
let currentAwardIndex = 0;

const PRIZE_TYPES = Object.freeze([
    { id: "luck", label: "May mắn", defaultQty: 30 },
    { id: "encourage", label: "Giải Tư", defaultQty: 20 },
    { id: "third", label: "Giải ba", defaultQty: 10 },
    { id: "second", label: "Giải nhì", defaultQty: 5 },
    { id: "first", label: "Giải nhất", defaultQty: 3 },
    { id: "special", label: "Đặc biệt", defaultQty: 1 }
]);

const PRIZE_LABEL_MAP = Object.fromEntries(
    PRIZE_TYPES.map(p => [p.id, p.label])
);

const PRIZE_RANK_MAP = Object.freeze({
    special: 0, first: 1, second: 2, 
    third: 3, encourage: 4, luck: 5
});

// ====== BIẾN GLOBAL TỐI ƯU ======
let employees = [];
let winners = [];
let prizeConfig = {};
let currentPrizeId = null;
let prizeEditEnabled = false;

// ====== CACHE DOM ELEMENTS ======
const elements = {};

function initDOMCache() {
    const ids = [
        'chooseAwardBtn', 'lotteryMusic', 'awardMusic',
        'prizeButtons', 'prizeConfigPanel', 'unlockPrizeBtn', 'clearBtn',
        'passwordPopup', 'passwordInput', 'passwordOkBtn', 'passwordCancelBtn',
        'rollBtn', 'currentPrizeLabel',
        'empTableBody', 'empCountBadge', 'searchInput',
        'winnerTableBody', 'winnerCountBadge',
        'lastWinnerCode', 'lastWinnerName', 'lastWinnerPrize',
        'winnerPopup', 'winnerAvatar', 'popupWinnerName', 'acceptPopupBtn', 'cancelPopupBtn',
        'celebration', 'fireworksCanvas',
        'spinBox', 'spinCode', 'spinName',
        'podiumSpecialAvatar', 'podiumFirstAvatar', 'podiumSecondAvatar', 
        'podiumThirdAvatar', 'podiumFourthAvatar',
        'podiumSpecialName', 'podiumFirstName', 'podiumSecondName', 
        'podiumThirdName', 'podiumFourthName'
    ];
    
    ids.forEach(id => {
        elements[id] = document.getElementById(id);
    });
    
    elements.fwCtx = elements.fireworksCanvas?.getContext('2d');
}

// ====== THROTTLE/DEBOUNCE UTILITIES ======
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ====== STORAGE OPTIMIZATION ======
const StorageManager = {
    load(key, defaultValue = []) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : defaultValue;
        } catch (e) {
            console.error(`Lỗi load ${key}:`, e);
            return defaultValue;
        }
    },
    
    save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error(`Lỗi save ${key}:`, e);
        }
    },
    
    loadAll() {
        employees = this.load(STORAGE_EMPLOYEES, []);
        winners = this.load(STORAGE_WINNERS, []);
        prizeConfig = this.load(STORAGE_PRIZE_CFG, {});
        
        // Khởi tạo cấu hình giải thưởng
        PRIZE_TYPES.forEach(p => {
            if (typeof prizeConfig[p.id] !== 'number') {
                prizeConfig[p.id] = p.defaultQty;
            }
        });
        
        // Backup danh sách gốc nếu chưa có
        if (employees.length && !localStorage.getItem(STORAGE_EMPLOYEES_ORIG)) {
            this.save(STORAGE_EMPLOYEES_ORIG, employees);
        }
    },
    
    syncEmployees() {
        if (!winners.length) return;
        const winnerCodes = new Set(winners.map(w => w.code));
        employees = employees.filter(e => !winnerCodes.has(e.code));
    }
};

// ====== AUDIO MANAGER TỐI ƯU ======
const AudioManager = {
    currentAwardIndex: 0,
    
    init() {
        this.setAwardTrack(0);
    },
    
    setAwardTrack(index) {
        if (!awardTracks.length) return;
        this.currentAwardIndex = ((index % awardTracks.length) + awardTracks.length) % awardTracks.length;
        elements.awardMusic.src = awardBasePath + awardTracks[this.currentAwardIndex];
    },
    
    playLotteryMusic() {
        this.stopAll();
        try {
            elements.lotteryMusic.currentTime = 0;
            elements.lotteryMusic.play().catch(console.warn);
        } catch (e) {}
    },
    
    playAwardMusic() {
        if (!elements.awardMusic.src) this.setAwardTrack(this.currentAwardIndex);
        try {
            elements.awardMusic.currentTime = 0;
            elements.awardMusic.play().catch(console.warn);
        } catch (e) {}
    },
    
    stopAll() {
        [elements.lotteryMusic, elements.awardMusic].forEach(audio => {
            try {
                audio.pause();
                audio.currentTime = 0;
            } catch (e) {}
        });
    },
    
    nextTrack() {
        this.currentAwardIndex = (this.currentAwardIndex + 1) % awardTracks.length;
        this.setAwardTrack(this.currentAwardIndex);
        this.playAwardMusic();
    }
};

// ====== PRIZE MANAGER TỐI ƯU ======
const PrizeManager = {
    getStats(prizeId) {
        const total = prizeConfig[prizeId] ?? 0;
        const used = winners.filter(w => w.prizeId === prizeId).length;
        const remaining = Math.max(0, total - used);
        return { total, used, remaining };
    },
    
    renderButtons() {
        const fragment = document.createDocumentFragment();
        
        PRIZE_TYPES.forEach(p => {
            const stats = this.getStats(p.id);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'prize-btn';
            btn.dataset.prizeId = p.id;
            btn.innerHTML = `<span>${p.label}</span><span class="count">(${stats.used}/${stats.total})</span>`;
            
            if (p.id === currentPrizeId) btn.classList.add('active');
            
            btn.addEventListener('click', () => this.handlePrizeClick(p.id, btn));
            fragment.appendChild(btn);
        });
        
        elements.prizeButtons.innerHTML = '';
        elements.prizeButtons.appendChild(fragment);
    },
    
    handlePrizeClick(prizeId, btn) {
        if (btn.classList.contains('active')) {
            currentPrizeId = null;
            btn.classList.remove('active');
        } else {
            document.querySelectorAll('.prize-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPrizeId = prizeId;
        }
        this.updateCurrentLabel();
        TableManager.renderWinners();
    },
    
    renderConfigPanel() {
        const fragment = document.createDocumentFragment();
        
        PRIZE_TYPES.forEach(p => {
            const stats = this.getStats(p.id);
            const row = document.createElement('div');
            row.className = 'prize-config-row';
            
            const label = document.createElement('label');
            label.textContent = p.label;
            row.appendChild(label);
            
            if (!prizeEditEnabled) {
                const statWrap = document.createElement('div');
                statWrap.className = 'prize-stats';
                
                ['total', 'used', 'remaining'].forEach(type => {
                    const pill = document.createElement('span');
                    pill.className = `prize-pill ${type}`;
                    pill.textContent = type === 'total' ? `Tổng: ${prizeConfig[p.id]}` :
                                      type === 'used' ? `Đã trao: ${stats.used}` :
                                      `Còn: ${stats.remaining}`;
                    statWrap.appendChild(pill);
                });
                
                row.appendChild(statWrap);
            } else {
                const input = document.createElement('input');
                input.type = 'number';
                input.min = '0';
                input.value = prizeConfig[p.id] ?? p.defaultQty;
                
                input.addEventListener('change', () => {
                    let v = parseInt(input.value, 10) || 0;
                    if (v < 0) v = 0;
                    prizeConfig[p.id] = v;
                    StorageManager.save(STORAGE_PRIZE_CFG, prizeConfig);
                    this.renderButtons();
                    this.renderConfigPanel();
                    this.updateCurrentLabel();
                });
                
                const statWrap = document.createElement('div');
                statWrap.className = 'prize-stats';
                
                ['used', 'remaining'].forEach(type => {
                    const pill = document.createElement('span');
                    pill.className = `prize-pill ${type}`;
                    pill.textContent = type === 'used' ? `Đã: ${stats.used}` : `Còn: ${stats.remaining}`;
                    statWrap.appendChild(pill);
                });
                
                row.appendChild(input);
                row.appendChild(statWrap);
            }
            
            fragment.appendChild(row);
        });
        
        elements.prizeConfigPanel.innerHTML = '';
        elements.prizeConfigPanel.appendChild(fragment);
    },
    
    updateCurrentLabel() {
        if (!currentPrizeId) {
            elements.currentPrizeLabel.textContent = "Đang xem tất cả giải.";
            return;
        }
        const stats = this.getStats(currentPrizeId);
        elements.currentPrizeLabel.textContent = 
            `Đang chọn: ${PRIZE_LABEL_MAP[currentPrizeId]} (Còn: ${stats.remaining}/${stats.total})`;
    }
};

// ====== TABLE MANAGER TỐI ƯU ======
const TableManager = {
    MAX_ROWS: 100,
    MAX_SEARCH_ROWS: 50,
    
    renderEmployees() {
        const keyword = (elements.searchInput?.value || '').trim().toUpperCase();
        let filtered = employees;
        
        if (keyword) {
            filtered = employees.filter(e => 
                (e.code || '').toUpperCase().includes(keyword)
            );
        }
        
        const fragment = document.createDocumentFragment();
        const displayCount = Math.min(filtered.length, this.MAX_SEARCH_ROWS);
        
        for (let i = 0; i < displayCount; i++) {
            const emp = filtered[i];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${i + 1}</td>
                <td class="code-cell">${this.escapeHtml(emp.code)}</td>
                <td>${this.escapeHtml(emp.name)}</td>
            `;
            fragment.appendChild(tr);
        }
        
        if (filtered.length > this.MAX_SEARCH_ROWS) {
            const infoRow = document.createElement('tr');
            infoRow.innerHTML = `
                <td colspan="3" style="text-align:center;padding:10px;font-size:0.8rem;opacity:0.8;">
                    Đang hiển thị ${this.MAX_SEARCH_ROWS}/${filtered.length} kết quả.
                </td>
            `;
            fragment.appendChild(infoRow);
        }
        
        elements.empTableBody.innerHTML = '';
        elements.empTableBody.appendChild(fragment);
        elements.empCountBadge.textContent = `${filtered.length} nhân viên`;
    },
    
    renderWinners() {
        let filtered = [...winners];
        if (currentPrizeId) {
            filtered = filtered.filter(w => w.prizeId === currentPrizeId);
        }
        
        filtered.sort((a, b) => {
            const ra = PRIZE_RANK_MAP[a.prizeId] ?? 999;
            const rb = PRIZE_RANK_MAP[b.prizeId] ?? 999;
            if (ra !== rb) return ra - rb;
            return (a.time || '').localeCompare(b.time || '');
        });
        
        const fragment = document.createDocumentFragment();
        const displayCount = Math.min(filtered.length, this.MAX_ROWS);
        
        for (let i = 0; i < displayCount; i++) {
            const w = filtered[i];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${i + 1}</td>
                <td class="code-cell">${this.escapeHtml(w.code)}</td>
                <td>${this.escapeHtml(w.name)}</td>
                <td class="prize-cell">${PRIZE_LABEL_MAP[w.prizeId] || w.prizeId}</td>
            `;
            fragment.appendChild(tr);
        }
        
        if (filtered.length > this.MAX_ROWS) {
            const infoRow = document.createElement('tr');
            infoRow.innerHTML = `
                <td colspan="4" style="text-align:center;padding:10px;font-size:0.8rem;opacity:0.8;">
                    Đang hiển thị ${this.MAX_ROWS}/${filtered.length} kết quả.
                </td>
            `;
            fragment.appendChild(infoRow);
        }
        
        elements.winnerTableBody.innerHTML = '';
        elements.winnerTableBody.appendChild(fragment);
        elements.winnerCountBadge.textContent = `${filtered.length} người`;
        
        PodiumManager.render();
    },
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// ====== AVATAR MANAGER TỐI ƯU ======
const AvatarManager = {
    load(imgEl, code) {
        const possibleExts = ['jpg', 'jpeg', 'png', 'webp'];
        let triedIndex = 0;
        
        imgEl.style.display = 'none';
        imgEl.removeAttribute('src');
        
        const tryNext = () => {
            if (triedIndex >= possibleExts.length) {
                imgEl.style.display = 'none';
                return;
            }
            
            const ext = possibleExts[triedIndex++];
            const url = `./Vongquaymayman/avatars/${code}.${ext}?ts=${Date.now()}`;
            
            imgEl.onload = () => imgEl.style.display = 'block';
            imgEl.onerror = tryNext;
            imgEl.src = url;
        };
        
        tryNext();
    }
};

// ====== POPUP MANAGER TỐI ƯU ======
const PopupManager = {
    pendingWinner: null,
    pendingIndex: null,
    
    show(winner) {
        elements.popupWinnerName.textContent = `${winner.code} - ${winner.name}`;
        elements.winnerAvatar.style.display = 'none';
        
        AvatarManager.load(elements.winnerAvatar, winner.code);
        elements.winnerPopup.classList.add('show');
        AudioManager.playAwardMusic();
        FireworksManager.start();
    },
    
    hide() {
        elements.winnerPopup.classList.remove('show');
        FireworksManager.stop();
        AudioManager.stopAll();
        this.pendingWinner = null;
        this.pendingIndex = null;
    },
    
    confirm() {
        if (!this.pendingWinner) return;
        
        elements.lastWinnerCode.textContent = this.pendingWinner.code;
        elements.lastWinnerName.textContent = this.pendingWinner.name;
        elements.lastWinnerPrize.textContent = PRIZE_LABEL_MAP[currentPrizeId];
        
        winners.push({
            code: this.pendingWinner.code,
            name: this.pendingWinner.name,
            prizeId: currentPrizeId,
            time: new Date().toISOString()
        });
        
        employees.splice(this.pendingIndex, 1);
        
        StorageManager.save(STORAGE_EMPLOYEES, employees);
        StorageManager.save(STORAGE_WINNERS, winners);
        
        TableManager.renderEmployees();
        TableManager.renderWinners();
        PrizeManager.renderButtons();
        PrizeManager.renderConfigPanel();
        PrizeManager.updateCurrentLabel();
        
        this.hide();
    }
};

// ====== PODIUM MANAGER TỐI ƯU ======
const PodiumManager = {
    prizeMap: {
        special: { avatar: 'podiumSpecialAvatar', name: 'podiumSpecialName' },
        first: { avatar: 'podiumFirstAvatar', name: 'podiumFirstName' },
        second: { avatar: 'podiumSecondAvatar', name: 'podiumSecondName' },
        third: { avatar: 'podiumThirdAvatar', name: 'podiumThirdName' },
        encourage: { avatar: 'podiumFourthAvatar', name: 'podiumFourthName' }
    },
    
    render() {
        Object.entries(this.prizeMap).forEach(([prizeId, { avatar, name }]) => {
            const lastWinner = [...winners].reverse().find(w => w.prizeId === prizeId);
            const nameEl = elements[name];
            const avatarEl = elements[avatar];
            
            if (!lastWinner) {
                nameEl.textContent = 'Chưa có';
                avatarEl.style.display = 'none';
                return;
            }
            
            nameEl.textContent = `${lastWinner.code} - ${lastWinner.name}`;
            avatarEl.style.display = 'none';
            AvatarManager.load(avatarEl, lastWinner.code);
        });
    }
};

// ====== FIREWORKS MANAGER TỐI ƯU ======
const FireworksManager = {
    MAX_FIREWORKS: 8,
    MAX_PARTICLES: 200,
    fwWidth: 0,
    fwHeight: 0,
    fireworks: [],
    particles: [],
    running: false,
    animationId: null,
    lastSpawn: 0,
    
    init() {
        this.resize();
        window.addEventListener('resize', throttle(() => this.resize(), 250));
    },
    
    resize() {
        this.fwWidth = elements.fireworksCanvas.width = window.innerWidth;
        this.fwHeight = elements.fireworksCanvas.height = window.innerHeight;
    },
    
    start() {
        if (this.running) return;
        this.running = true;
        elements.celebration.classList.add('show');
        this.fireworks = [];
        this.particles = [];
        this.lastSpawn = 0;
        this.animate();
    },
    
    stop() {
        this.running = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        elements.fwCtx.clearRect(0, 0, this.fwWidth, this.fwHeight);
        elements.celebration.classList.remove('show');
    },
    
    animate(ts = 0) {
        if (!this.running) return;
        
        if (!this.lastSpawn) this.lastSpawn = ts;
        if (ts - this.lastSpawn > 400 + Math.random() * 400) {
            this.spawn();
            this.lastSpawn = ts;
        }
        
        // Clear canvas với opacity
        elements.fwCtx.globalCompositeOperation = 'destination-out';
        elements.fwCtx.fillStyle = 'rgba(0,0,0,0.25)';
        elements.fwCtx.fillRect(0, 0, this.fwWidth, this.fwHeight);
        elements.fwCtx.globalCompositeOperation = 'lighter';
        
        // Update và vẽ fireworks
        this.fireworks = this.fireworks.filter(f => {
            const alive = f.update();
            f.draw(elements.fwCtx);
            return alive;
        });
        
        // Update và vẽ particles
        this.particles = this.particles.filter(p => {
            const alive = p.update();
            p.draw(elements.fwCtx);
            return alive;
        });
        
        this.animationId = requestAnimationFrame((t) => this.animate(t));
    },
    
    spawn() {
        if (this.fireworks.length >= this.MAX_FIREWORKS) return;
        
        const sx = this.fwWidth * (0.2 + Math.random() * 0.6);
        const sy = this.fwHeight + 10;
        const tx = this.fwWidth * (0.1 + Math.random() * 0.8);
        const ty = this.fwHeight * (0.15 + Math.random() * 0.4);
        
        this.fireworks.push(new Firework(sx, sy, tx, ty));
    },
    
    createExplosion(x, y) {
        if (this.particles.length >= this.MAX_PARTICLES) return;
        
        const count = Math.min(30, this.MAX_PARTICLES - this.particles.length);
        const baseHue = Math.random() * 360;
        
        for (let i = 0; i < count; i++) {
            const hue = baseHue + (Math.random() * 40 - 20);
            this.particles.push(new Particle(x, y, hue));
        }
    }
};

// ====== FIREWORK CLASSES TỐI ƯU ======
class Firework {
    constructor(sx, sy, tx, ty) {
        this.x = sx;
        this.y = sy;
        this.tx = tx;
        this.ty = ty;
        const dx = tx - sx, dy = ty - sy;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        this.vx = (dx / d) * (3 + Math.random() * 2);
        this.vy = (dy / d) * (3 + Math.random() * 2);
        this.alpha = 1;
        this.brightness = 50 + Math.random() * 50;
        this.trail = [];
        this.trailMax = 5;
    }
    
    update() {
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > this.trailMax) this.trail.shift();
        
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= 0.008;
        
        const dx = this.tx - this.x;
        const dy = this.ty - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const reached = distance < 10 || this.alpha <= 0;
        
        if (reached && FireworksManager.particles.length < FireworksManager.MAX_PARTICLES) {
            FireworksManager.createExplosion(this.tx, this.ty);
            return false;
        }
        return true;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.strokeStyle = `hsl(${Math.random() * 360},100%,${this.brightness}%)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        
        if (this.trail.length > 0) {
            const first = this.trail[0];
            ctx.moveTo(first.x, first.y);
            this.trail.forEach(p => ctx.lineTo(p.x, p.y));
        }
        ctx.lineTo(this.x, this.y);
        ctx.stroke();
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, hue) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 4;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.friction = 0.98;
        this.gravity = 0.05 + Math.random() * 0.05;
        this.alpha = 1;
        this.decay = 0.01 + Math.random() * 0.02;
        this.brightness = 50 + Math.random() * 30;
        this.hue = hue;
        this.size = 2 + Math.random() * 2;
    }
    
    update() {
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= this.decay;
        return this.alpha > 0;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = `hsl(${this.hue},100%,${this.brightness}%)`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ====== WHEEL MANAGER TỐI ƯU ======
const WheelManager = {
    isRolling: false,
    
    roll() {
        if (prizeEditEnabled) {
            alert('Đang mở chế độ chỉnh sửa cơ cấu giải.\nHãy khóa lại trước khi quay thưởng.');
            return;
        }
        
        if (this.isRolling) return;
        if (!currentPrizeId) {
            alert('Hãy chọn loại giải trước khi quay thưởng.');
            return;
        }
        
        const stats = PrizeManager.getStats(currentPrizeId);
        if (stats.total <= 0) {
            alert('Giải này chưa được cấu hình số lượng.');
            return;
        }
        if (stats.remaining <= 0) {
            alert(`Giải ${PRIZE_LABEL_MAP[currentPrizeId]} đã trao hết (${stats.total}/${stats.total}).`);
            return;
        }
        if (employees.length === 0) {
            alert('Không còn nhân viên nào trong danh sách (đã trúng hết).');
            return;
        }
        
        const pendingIndex = Math.floor(Math.random() * employees.length);
        PopupManager.pendingWinner = employees[pendingIndex];
        PopupManager.pendingIndex = pendingIndex;
        
        this.isRolling = true;
        elements.rollBtn.disabled = true;
        
        AudioManager.playLotteryMusic();
        elements.spinBox.classList.add('spinning');
        
        let startTime = null;
        const DURATION = 4000;
        
        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / DURATION, 1);
            
            if (progress < 1) {
                const speed = 80 * (1 - progress * 0.8);
                if (employees.length > 0) {
                    const r = employees[Math.floor(Math.random() * employees.length)];
                    elements.spinCode.textContent = r.code;
                    elements.spinName.textContent = r.name;
                }
                setTimeout(() => requestAnimationFrame(animate), speed);
            } else {
                this.finish();
            }
        };
        
        requestAnimationFrame(animate);
    },
    
    finish() {
        elements.spinCode.textContent = PopupManager.pendingWinner.code;
        elements.spinName.textContent = PopupManager.pendingWinner.name;
        elements.spinBox.classList.remove('spinning');
        
        AudioManager.stopAll();
        PopupManager.show(PopupManager.pendingWinner);
        
        this.isRolling = false;
        elements.rollBtn.disabled = false;
    }
};

// ====== PASSWORD MANAGER ======
const PasswordManager = {
    show() {
        if (prizeEditEnabled) {
            prizeEditEnabled = false;
            alert('Đã khóa chỉnh sửa cơ cấu giải.');
            PrizeManager.renderConfigPanel();
            return;
        }
        
        elements.passwordInput.value = '';
        elements.passwordPopup.style.display = 'flex';
        setTimeout(() => elements.passwordInput.focus(), 50);
    },
    
    hide() {
        elements.passwordPopup.style.display = 'none';
    },
    
    submit() {
        const pwd = elements.passwordInput.value;
        if (pwd === CONFIG_PASSWORD) {
            prizeEditEnabled = true;
            this.hide();
            alert('Đã mở khóa chỉnh sửa cơ cấu giải.');
            PrizeManager.renderConfigPanel();
        } else {
            alert('Sai mật khẩu!');
            elements.passwordInput.focus();
            elements.passwordInput.select();
        }
    }
};

// ====== DATA MANAGER ======
const DataManager = {
    clear() {
        if (!prizeEditEnabled) {
            alert('Hãy nhập mật khẩu trước khi Clear giải.');
            return;
        }
        
        if (!confirm('Clear toàn bộ kết quả và reset cơ cấu giải về ban đầu?')) return;
        
        winners = [];
        StorageManager.save(STORAGE_WINNERS, winners);
        
        prizeConfig = {};
        PRIZE_TYPES.forEach(p => prizeConfig[p.id] = p.defaultQty);
        StorageManager.save(STORAGE_PRIZE_CFG, prizeConfig);
        
        employees = StorageManager.load(STORAGE_EMPLOYEES_ORIG, []);
        StorageManager.save(STORAGE_EMPLOYEES, employees);
        
        elements.lastWinnerCode.textContent = '---';
        elements.lastWinnerName.textContent = 'Chưa có kết quả';
        elements.lastWinnerPrize.textContent = '---';
        
        elements.spinCode.textContent = '---';
        elements.spinName.textContent = 'Nhấn "Quay thưởng" để bắt đầu';
        
        currentPrizeId = null;
        
        PrizeManager.renderButtons();
        PrizeManager.renderConfigPanel();
        PrizeManager.updateCurrentLabel();
        TableManager.renderEmployees();
        TableManager.renderWinners();
        FireworksManager.stop();
        AudioManager.stopAll();
        
        alert('Đã Clear toàn bộ kết quả & reset cơ cấu giải.');
    }
};

// ====== EVENT HANDLERS ======
function setupEventListeners() {
    // Âm nhạc
    elements.chooseAwardBtn?.addEventListener('click', () => AudioManager.nextTrack());
    
    // Vòng quay
    elements.rollBtn?.addEventListener('click', () => WheelManager.roll());
    elements.spinBox?.addEventListener('click', () => WheelManager.roll());
    
    // Tìm kiếm
    elements.searchInput?.addEventListener('input', 
        debounce(() => TableManager.renderEmployees(), 150)
    );
    
    // Password
    elements.unlockPrizeBtn?.addEventListener('click', () => PasswordManager.show());
    elements.passwordOkBtn?.addEventListener('click', () => PasswordManager.submit());
    elements.passwordCancelBtn?.addEventListener('click', () => PasswordManager.hide());
    
    elements.passwordInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') PasswordManager.submit();
        else if (e.key === 'Escape') PasswordManager.hide();
    });
    
    // Popup
    elements.acceptPopupBtn?.addEventListener('click', () => PopupManager.confirm());
    elements.cancelPopupBtn?.addEventListener('click', () => PopupManager.hide());
    
    elements.winnerPopup?.addEventListener('click', (e) => {
        if (e.target === elements.winnerPopup) PopupManager.hide();
    });
    
    // Clear
    elements.clearBtn?.addEventListener('click', () => DataManager.clear());
}

// ====== INITIALIZATION ======
function init() {
    initDOMCache();
    setupEventListeners();
    
    StorageManager.loadAll();
    StorageManager.syncEmployees();
    
    AudioManager.init();
    FireworksManager.init();
    
    currentPrizeId = null;
    
    PrizeManager.renderButtons();
    PrizeManager.renderConfigPanel();
    PrizeManager.updateCurrentLabel();
    TableManager.renderEmployees();
    TableManager.renderWinners();
    
    // Setup copyright protection
    setupCopyright();
}

// ====== COPYRIGHT PROTECTION TỐI ƯU ======
function setupCopyright() {
    const text = "© 2025 — Hoàng Anh Tú (IT SFC) — Bản quyền web thuộc FUYU PRECISION";
    const id = "copyright_protection_fuyu";
    
    function createCopyright() {
        if (document.getElementById(id)) return;
        
        const el = document.createElement('div');
        el.id = id;
        el.textContent = text;
        el.style.cssText = `
            position: fixed; bottom: 6px; right: 6px; padding: 6px 12px;
            background: rgba(0,0,0,0.55); color: #fff; font-size: 12px;
            border-radius: 6px; z-index: 999999; pointer-events: none;
            font-family: monospace; opacity: 0.8;
        `;
        document.body.appendChild(el);
    }
    
    createCopyright();
    
    // Observer nhẹ hơn
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.removedNodes) {
                for (const node of mutation.removedNodes) {
                    if (node.id === id) {
                        createCopyright();
                        return;
                    }
                }
            }
        }
    });
    
    observer.observe(document.body, { childList: true });
}

// ====== START APP ======
document.addEventListener('DOMContentLoaded', init);