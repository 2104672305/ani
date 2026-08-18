const App = {
    config: null,
    data: null,
    currentFilter: 'all',
    searchQuery: '',

    STATUS_MAP: { wish: '想看', collect: '看过', doing: '在看', on_hold: '搁置', dropped: '抛弃' },
    TYPE_MAP: { 1: 'wish', 2: 'collect', 3: 'doing', 4: 'on_hold', 5: 'dropped' },

    getStatus(collection) {
        const c = collection || {};
        const raw = c.status?.name || c.status;
        if (raw) return raw;
        return this.TYPE_MAP[c.type] || '';
    },

    async init() {
        await Promise.all([this.loadConfig(), this.loadData()]);
        this.setupBackground();
        this.setupHeader();
        this.setupNav();
        this.render();
        this.bindEvents();
    },

    async loadConfig() {
        try {
            const resp = await fetch('config.json');
            if (resp.ok) this.config = await resp.json();
        } catch (e) {
            console.warn('配置加载失败');
        }
    },

    async loadData() {
        try {
            const resp = await fetch('bangumi.json');
            if (!resp.ok) throw new Error('数据加载失败');
            this.data = await resp.json();
        } catch (e) {
            console.error('数据加载失败:', e);
            document.getElementById('anime-grid').innerHTML =
                '<div class="no-results">数据加载失败，请稍后重试</div>';
        }
    },

    setupBackground() {
        const bgUrl = this.config?.bangumi?.background;
        const overlay = document.getElementById('bg-overlay');
        if (bgUrl) {
            overlay.style.backgroundImage = `url(${bgUrl})`;
        } else {
            // 默认渐变背景
            overlay.style.background = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)';
        }

        const favicon = this.config?.bangumi?.favicon;
        if (favicon) {
            document.getElementById('favicon').href = favicon;
        }
    },

    setupHeader() {
        if (!this.config || !this.data) return;
        const nickname = this.config.bangumi?.nickname || this.data.username || '';
        document.getElementById('nickname').textContent = nickname;
        document.title = `${nickname}的追番列表`;

        if (this.data.last_updated) {
            const d = new Date(this.data.last_updated);
            document.getElementById('update-time').textContent = d.toLocaleString('zh-CN');
        }

        // 头像
        const avatarLink = document.getElementById('avatar-link');
        avatarLink.href = `https://bgm.tv/user/${this.data.username}`;
        avatarLink.style.display = 'block';
        this.loadAvatar();

        const bangumiBtn = document.getElementById('bangumi-btn');
        bangumiBtn.href = `https://bgm.tv/user/${this.data.username}`;
    },

    async loadAvatar() {
        // 先用本地头像
        const avatarEl = document.getElementById('avatar');
        const avatarLink = document.getElementById('avatar-link');
        avatarEl.src = 'avatar.jpg';
        avatarLink.style.display = 'block';

        // 再尝试从 API 获取真实头像
        const username = this.data?.username;
        if (!username) return;
        try {
            const resp = await fetch(`https://api.bgm.tv/v0/users/${username}`, {
                headers: { 'Accept': 'application/json' }
            });
            if (resp.ok) {
                const user = await resp.json();
                if (user.avatar) {
                    avatarEl.src = user.avatar;
                }
            }
        } catch (e) {
            // 保持本地头像
        }
    },

    setupNav() {
        if (!this.data) return;
        const collections = this.data.collections || [];
        const counts = { all: 0, wish: 0, collect: 0, doing: 0, on_hold: 0 };
        collections.forEach(c => {
            const status = this.getStatus(c);
            if (status === 'dropped') return;
            counts.all++;
            if (counts[status] !== undefined) counts[status]++;
        });
        document.getElementById('count-all').textContent = counts.all;
        document.getElementById('count-doing').textContent = counts.doing;
        document.getElementById('count-done').textContent = counts.collect;
        document.getElementById('count-wish').textContent = counts.wish;
        document.getElementById('count-onhold').textContent = counts.on_hold;
    },

    bindEvents() {
        document.querySelectorAll('.nav-tab[data-status]').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.nav-tab[data-status]').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentFilter = tab.dataset.status;
                this.render();
            });
        });

        const searchInput = document.getElementById('search');
        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.render();
        });

        document.getElementById('search-toggle').addEventListener('click', (e) => {
            e.stopPropagation();
            searchInput.classList.toggle('active');
            if (searchInput.classList.contains('active')) searchInput.focus();
        });

        document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeModal();
        });

        document.getElementById('wordcloud-btn').addEventListener('click', () => this.openWordCloud());
        document.getElementById('wc-close').addEventListener('click', () => this.closeWordCloud());
        document.getElementById('wc-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeWordCloud();
        });

        const backBtn = document.getElementById('back-to-top');
        window.addEventListener('scroll', () => {
            backBtn.classList.toggle('visible', window.scrollY > 300);
        });
        backBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (document.getElementById('wc-overlay').classList.contains('active')) {
                    this.closeWordCloud();
                } else {
                    this.closeModal();
                }
            }
        });

        document.getElementById('anime-grid').addEventListener('click', (e) => {
            const card = e.target.closest('.anime-card');
            if (card) {
                this.openModal(parseInt(card.dataset.index));
            }
        });
    },

    getFilteredData() {
        if (!this.data) return [];
        let list = this.data.collections || [];
        list = list.filter(c => {
            const status = this.getStatus(c);
            return status !== 'dropped';
        });
        if (this.currentFilter !== 'all') {
            list = list.filter(c => {
                const status = this.getStatus(c);
                return status === this.currentFilter;
            });
        }
        if (this.searchQuery) {
            list = list.filter(c => {
                const s = c.subject || {};
                const name = (s.name || '').toLowerCase();
                const nameCn = (s.name_cn || '').toLowerCase();
                return name.includes(this.searchQuery) || nameCn.includes(this.searchQuery);
            });
        }
        return list;
    },

    getImageUrl(images) {
        if (!images) return '';
        return images.common || images.medium || images.large || '';
    },

    render() {
        const list = this.getFilteredData();
        const grid = document.getElementById('anime-grid');
        if (list.length === 0) {
            grid.innerHTML = '<div class="no-results">没有找到匹配的番剧</div>';
            return;
        }
        grid.innerHTML = list.map((c, i) => this.renderCard(c, i)).join('');
    },

    renderCard(collection, index) {
        const subject = collection.subject || {};
        const nameCn = subject.name_cn || subject.name || '未知';
        const score = subject.rating?.score || 0;
        const status = this.getStatus(collection);
        const statusLabel = this.STATUS_MAP[status] || status;
        const coverUrl = this.getImageUrl(subject.images);

        const coverHtml = coverUrl
            ? `<div class="anime-cover-wrapper"><img class="anime-cover" src="${this.esc(coverUrl)}" alt="${this.esc(nameCn)}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<div class=anime-cover-placeholder>♪</div>'"></div>`
            : `<div class="anime-cover-wrapper"><div class="anime-cover-placeholder">♪</div></div>`;

        return `
            <div class="anime-card" data-index="${index}">
                ${coverHtml}
                <div class="anime-card-info">
                    <div class="anime-card-title">${this.esc(nameCn)}</div>
                    <div class="anime-card-meta">
                        ${score > 0 ? `<div class="anime-card-score"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>${score}</div>` : ''}
                        <span class="anime-card-status status-${status}">${statusLabel}</span>
                    </div>
                </div>
            </div>`;
    },

    openModal(index) {
        const list = this.getFilteredData();
        const collection = list[index];
        if (!collection) return;

        const subject = collection.subject || {};
        const nameCn = subject.name_cn || subject.name || '未知';
        const name = subject.name || '';
        const score = subject.rating?.score || 0;
        const eps = subject.eps || 0;
        const date = subject.date || '未知';
        const summary = subject.summary || '暂无简介';
        const status = this.getStatus(collection);
        const statusLabel = this.STATUS_MAP[status] || status;
        const subjectId = subject.id || collection.subject_id;
        const coverUrl = subject.images?.large || subject.images?.common || subject.images?.medium || '';

        const coverWrap = document.getElementById('modal-cover-wrap');
        const coverEl = document.getElementById('modal-cover');
        if (coverUrl) {
            coverWrap.style.display = '';
            coverEl.src = coverUrl;
            coverEl.onerror = () => { coverWrap.style.display = 'none'; };
        } else {
            coverWrap.style.display = 'none';
        }

        document.getElementById('modal-name-cn').textContent = nameCn;
        document.getElementById('modal-name').textContent = name;
        document.getElementById('modal-bangumi-btn').href = `https://bgm.tv/subject/${subjectId}`;
        document.getElementById('modal-status').textContent = statusLabel;
        document.getElementById('modal-score').textContent = score > 0 ? `${score} 分` : '暂无评分';
        document.getElementById('modal-eps').textContent = eps > 0 ? `${eps} 集` : '未知';
        document.getElementById('modal-date').textContent = date;

        const tagsEl = document.getElementById('modal-tags');
        const tags = subject.tags || [];
        if (tags.length > 0) {
            tagsEl.innerHTML = tags.map(t => {
                const tagName = typeof t === 'string' ? t : t.name;
                return `<span class="modal-tag">${this.esc(tagName)}</span>`;
            }).join('');
        } else {
            tagsEl.innerHTML = '<span style="color: var(--text-muted)">暂无标签</span>';
        }

        const summaryText = summary.length > 200 ? summary.substring(0, 200) + '……' : summary;
        document.getElementById('modal-summary').textContent = summaryText;

        document.getElementById('modal-overlay').classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    closeModal() {
        document.getElementById('modal-overlay').classList.remove('active');
        document.body.style.overflow = '';
    },

    esc(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // ========== 词云 ==========
    WC_COLORS: ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#FF8A65','#81D4FA','#A5D6A7','#FFD54F','#CE93D8','#80DEEA','#EF5350','#42A5F5','#66BB6A','#FFA726'],

    _isExcludedTag(name) {
        if (!name) return true;
        if (['TV','OVA','Movie','WEB','剧场版','总集篇','日本'].includes(name)) return true;
        if (/^\d{4}$/.test(name)) return true;
        return false;
    },

    _getTagStats() {
        const data = this.data;
        if (!data) return [];
        const map = {};
        (data.collections || []).forEach(c => {
            (c.subject?.tags || []).forEach(t => {
                const name = typeof t === 'string' ? t : t.name;
                if (name && !this._isExcludedTag(name)) {
                    map[name] = (map[name] || 0) + 1;
                }
            });
        });
        return Object.entries(map).map(([text, count]) => ({ text, count })).sort((a, b) => b.count - a.count);
    },

    openWordCloud() {
        const stats = this._getTagStats();
        if (stats.length === 0) {
            alert('暂无标签数据（从 HTML 提取的数据不含标签，请使用 fetch_bangumi.py 从 API 获取完整数据）');
            return;
        }
        const maxCount = stats[0].count;
        const minCount = stats[stats.length - 1].count;
        const logMax = Math.log(maxCount + 1);
        const logMin = Math.log(Math.max(minCount, 1) + 1);
        const logRange = logMax - logMin || 1;

        const container = document.getElementById('wc-container');
        container.innerHTML = '';
        const cw = container.offsetWidth;
        const ch = container.offsetHeight;
        const placed = [];
        const cx = cw / 2;
        const cy = ch / 2;

        for (let i = 0; i < stats.length; i++) {
            const { text, count } = stats[i];
            const norm = (Math.log(count + 1) - logMin) / logRange;
            const fontSize = Math.round(6 + norm * 25);

            const word = document.createElement('span');
            word.className = 'wc-word';
            word.textContent = text;
            word.style.fontSize = fontSize + 'px';
            word.style.color = this.WC_COLORS[i % this.WC_COLORS.length];
            word.style.opacity = 0.6 + norm * 0.4;
            container.appendChild(word);

            if (Math.random() < 0.25) {
                word.style.writingMode = 'vertical-rl';
                word.style.textOrientation = 'mixed';
            }

            const rect = this._placeWord(word, cx, cy, cw, ch, placed);
            if (rect) {
                placed.push(rect);
                word.addEventListener('mouseenter', (e) => this._showWCTooltip(e, text, count));
                word.addEventListener('mousemove', (e) => this._moveWCTooltip(e));
                word.addEventListener('mouseleave', () => this._hideWCTooltip());
            } else {
                container.removeChild(word);
            }
        }
        document.getElementById('wc-overlay').classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    _placeWord(el, cx, cy, cw, ch, placed) {
        const halfW = el.offsetWidth / 2;
        const halfH = el.offsetHeight / 2;
        let angle = Math.random() * Math.PI * 2;
        for (let s = 0; s < 20000; s++) {
            const r = 1.5 + s * 0.4;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            angle += 0.4 / Math.max(r, 1);
            if (x - halfW < 0 || x + halfW > cw || y - halfH < 0 || y + halfH > ch) continue;
            let ok = true;
            for (const p of placed) {
                if (x-halfW-4 < p.x+p.halfW && x+halfW+4 > p.x-p.halfW && y-halfH-4 < p.y+p.halfH && y+halfH+4 > p.y-p.halfH) { ok = false; break; }
            }
            if (ok) {
                el.style.left = (x - halfW) + 'px';
                el.style.top = (y - halfH) + 'px';
                return { x, y, halfW, halfH };
            }
        }
        return null;
    },

    _showWCTooltip(e, text, count) {
        let tip = document.querySelector('.wc-tooltip');
        if (!tip) { tip = document.createElement('div'); tip.className = 'wc-tooltip'; document.body.appendChild(tip); }
        tip.textContent = `${text}: ${count} 次`;
        tip.classList.add('visible');
        this._moveWCTooltip(e);
    },
    _moveWCTooltip(e) {
        const tip = document.querySelector('.wc-tooltip');
        if (tip) { tip.style.left = (e.clientX + 14) + 'px'; tip.style.top = (e.clientY - 30) + 'px'; }
    },
    _hideWCTooltip() {
        const tip = document.querySelector('.wc-tooltip');
        if (tip) tip.classList.remove('visible');
    },
    closeWordCloud() {
        document.getElementById('wc-overlay').classList.remove('active');
        document.body.style.overflow = '';
        this._hideWCTooltip();
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
