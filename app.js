// Configuration
const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbw0Rt6ec_1xvr32n15DATvWHe0K5PVzh5XB5yfM58kNWyDOJgMDAqLKOW0GFFv3i-nY/exec'; 

// State Management
let guests = [];
let currentView = 'active';
let selectedHistoryDate = new Date().toISOString().split('T')[0];

document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const waitlistContainer = document.getElementById('waitlist-container');
    const waitingCountEl = document.getElementById('waiting-count');
    const notifiedCountEl = document.getElementById('notified-count');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const searchInput = document.getElementById('search-input');
    const addGuestBtn = document.getElementById('add-guest-btn');
    const modalContainer = document.getElementById('modal-container');
    const themeToggleBtn = document.getElementById('theme-toggle');
    const historyDatePicker = document.getElementById('history-date-picker');
    const historyFilterContainer = document.getElementById('history-filter-container');
    const rootElement = document.documentElement;

    // Theme Logic
    const savedTheme = localStorage.getItem('theme') || 'dark';
    rootElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = rootElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            rootElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
        });
    }

    function updateThemeIcon(theme) {
        if (!themeToggleBtn) return;
        themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
        const logoImg = document.getElementById('app-logo');
        if (logoImg) {
            logoImg.src = theme === 'dark' ? 'logo_dark.png' : 'logo_light.png';
        }
    }

    if (historyDatePicker) {
        historyDatePicker.value = selectedHistoryDate;
        historyDatePicker.addEventListener('change', (e) => {
            selectedHistoryDate = e.target.value;
            render();
        });
    }

    // Refresh Data
    async function refreshData() {
        if (!BACKEND_URL) return;
        try {
            const response = await fetch(BACKEND_URL);
            guests = await response.json();
            render();
        } catch (err) { console.error('Error al cargar datos:', err); }
    }

    // Date Helper
    function isSameDate(dateStr, targetDateStr) {
        if (!dateStr || !targetDateStr) return false;
        const date = new Date(dateStr);
        const target = new Date(targetDateStr + 'T00:00:00'); 
        return date.getDate() === target.getDate() &&
               date.getMonth() === target.getMonth() &&
               date.getFullYear() === target.getFullYear();
    }

    // Wait parse Helper
    function parseWaitMinutes(guest) {
        const raw = Number(guest.waitDuration);
        if (!isNaN(raw) && guest.waitDuration !== '' && guest.waitDuration !== null) return raw;
        if (guest.waitDuration) {
            const end = new Date(guest.waitDuration).getTime();
            const start = new Date(guest.timestamp).getTime();
            if (!isNaN(end) && !isNaN(start)) return Math.floor((end - start) / 60000);
        }
        return 0;
    }

    // Render Function
    function render() {
        const searchTerm = searchInput.value.toLowerCase();
        
        if (currentView === 'history') {
            historyFilterContainer.classList.remove('hidden');
        } else {
            historyFilterContainer.classList.add('hidden');
        }

        const filteredGuests = guests.filter(g => {
            const matchesSearch = g.name.toLowerCase().includes(searchTerm);
            if (!matchesSearch) return false;
            
            if (currentView === 'active') {
                return (g.status === 'WAITING' || g.status === 'NOTIFIED');
            } else {
                return (g.status === 'SEATED' || g.status === 'ABSENT') && isSameDate(g.timestamp, selectedHistoryDate);
            }
        }).sort((a, b) => b.timestamp - a.timestamp);

        let summaryHtml = '';
        if (currentView === 'history') {
            const history = guests.filter(g => (g.status === 'SEATED' || g.status === 'ABSENT') && isSameDate(g.timestamp, selectedHistoryDate));
            const seatedCount = history.filter(g => g.status === 'SEATED').length;
            const absentCount = history.filter(g => g.status === 'ABSENT').length;
            const waitTimes = history.filter(g => (g.status === 'SEATED' || g.status === 'ABSENT') && g.waitDuration).map(g => parseWaitMinutes(g));
            const avgWait = waitTimes.length > 0 ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length) : 0;

            summaryHtml = `
                <div class="summary-dashboard">
                    <div class="summary-item">
                        <span class="summary-val">${seatedCount}</span>
                        <span class="summary-lab">Llegaron</span>
                    </div>
                    <div class="summary-item absent">
                        <span class="summary-val">${absentCount}</span>
                        <span class="summary-lab">No llegaron</span>
                    </div>
                    <div class="summary-item wait">
                        <span class="summary-val">${avgWait}m</span>
                        <span class="summary-lab">Promedio</span>
                    </div>
                </div>
            `;
        }

        waitlistContainer.innerHTML = summaryHtml + filteredGuests.map(guest => createGuestCard(guest)).join('');
        waitingCountEl.textContent = guests.filter(g => g.status === 'WAITING').length;
        notifiedCountEl.textContent = guests.filter(g => g.status === 'NOTIFIED').length;
    }

    function createGuestCard(guest) {
        const isHistory = currentView === 'history';
        const timestamp = new Date(guest.timestamp).getTime();
        let displayTime = 0;
        if (isHistory && guest.waitDuration !== undefined && guest.waitDuration !== '') {
            displayTime = parseWaitMinutes(guest);
        } else {
            displayTime = isNaN(timestamp) ? 0 : Math.floor((new Date().getTime() - timestamp) / 60000);
        }
        const isNotified = guest.status === 'NOTIFIED';
        
        return `
            <div class="customer-card ${isNotified ? 'notified' : ''}">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h3 class="guest-name">${guest.name}</h3>
                        <div class="guest-details">
                            <span>👥 ${guest.pax} personas</span>
                            <span>👶 ${guest.car === 'Sí' ? 'Con coche' : 'Sin coche'}</span>
                        </div>
                    </div>
                    <div class="pax-badge">${displayTime}m ${isHistory ? 'total' : 'esp.'}</div>
                </div>
                ${currentView === 'active' ? `
                    <div class="actions">
                        <button class="btn btn-notify" onclick="notifyGuest(${guest.rowId}, event)" ${isNotified ? 'disabled' : ''}>
                            ${isNotified ? '✅ NOTIFICADO' : '🔔 ENVIAR SMS'}
                        </button>
                        <button class="btn btn-seated" onclick="updateGuestStatus(${guest.rowId}, 'SEATED')">
                            SENTADO
                        </button>
                        <button class="btn btn-absent" onclick="updateGuestStatus(${guest.rowId}, 'ABSENT')">
                            NO LLEGÓ
                        </button>
                    </div>
                ` : `
                    <div class="actions">
                        <span class="badge-${guest.status.toLowerCase()}">${guest.status === 'SEATED' ? '👤 LLEGÓ' : '🚫 NO LLEGÓ'}</span>
                    </div>
                `}
            </div>
        `;
    }

    // Modal Logic
    addGuestBtn.addEventListener('click', openAddGuestModal);

    function openAddGuestModal() {
        modalContainer.innerHTML = `
            <div class="modal-content">
                <h2>Nuevo Registro</h2>
                <form id="add-guest-form">
                    <div class="form-group">
                        <label>Nombre del Cliente</label>
                        <input type="text" id="guest-name" required placeholder="Ej. Juan Pérez">
                    </div>
                    <div class="form-group">
                        <label>Número de Teléfono</label>
                        <input type="tel" id="guest-phone" required placeholder="7871234567">
                    </div>
                    <div class="form-group">
                        <label>Cantidad de Personas</label>
                        <input type="number" id="guest-pax" min="1" max="25" value="2" required>
                    </div>
                    <div class="form-group">
                        <label>¿Coche de Bebé?</label>
                        <select id="guest-car">
                            <option value="No">No</option>
                            <option value="Sí">Sí</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Tipo de Cliente</label>
                        <select id="guest-type">
                            <option value="Primera">Primera Vez</option>
                            <option value="Frecuente">Frecuente</option>
                        </select>
                    </div>
                    <div class="form-actions" style="display: flex; gap: 10px; margin-top: 20px;">
                        <button type="button" class="btn btn-absent" onclick="closeModal()" style="flex: 1;">CANCELAR</button>
                        <button type="submit" class="btn btn-seated" style="flex: 1;">GUARDAR</button>
                    </div>
                </form>
            </div>
        `;
        modalContainer.classList.remove('hidden');

        document.getElementById('add-guest-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'GUARDANDO...';

            const newGuest = {
                action: 'addGuest',
                name: document.getElementById('guest-name').value,
                phone: document.getElementById('guest-phone').value,
                pax: document.getElementById('guest-pax').value,
                car: document.getElementById('guest-car').value,
                type: document.getElementById('guest-type').value
            };

            try {
                const response = await fetch(BACKEND_URL, { method: 'POST', body: JSON.stringify(newGuest) });
                const result = await response.json();
                if (result.success) {
                    closeModal();
                    await refreshData();
                }
            } catch (err) { console.error('Error:', err); submitBtn.disabled = false; }
        });
    }

    window.closeModal = () => { modalContainer.classList.add('hidden'); };
    window.updateGuestStatus = async (rowId, status) => {
        try {
            await fetch(BACKEND_URL, { method: 'POST', body: JSON.stringify({ action: 'updateStatus', rowId, status }) });
            await refreshData();
        } catch (err) { console.error('Error:', err); }
    };
    window.notifyGuest = async (rowId, event) => {
        const guest = guests.find(g => g.rowId === rowId);
        if (!guest) return;

        const confirmSend = confirm(`¿Estás seguro de que deseas enviar el SMS a ${guest.name.toUpperCase()}?`);
        if (!confirmSend) return;

        // Desactivar botón inmediatamente
        const btn = event?.target?.closest('.btn-notify');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'ENVIANDO...';
        }

        try {
            const response = await fetch(BACKEND_URL, { 
                method: 'POST', 
                body: JSON.stringify({ 
                    action: 'notify', 
                    rowId, 
                    name: guest.name, 
                    phone: guest.phone, 
                    pax: guest.pax 
                }) 
            });
            const result = await response.json();
            
            if (result.success) {
                await refreshData(); // Renderizará con el botón ya bloqueado permanentemente
            } else {
                alert('Error al enviar: ' + result.error);
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = '🔔 ENVIAR SMS';
                }
            }
        } catch (err) { 
            console.error('Error:', err); 
            if (btn) {
                btn.disabled = false;
                btn.textContent = '🔔 ENVIAR SMS';
            }
        }
    };

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentView = btn.dataset.view;
            render();
        });
    });

    searchInput.addEventListener('input', render);
    await refreshData();
    setInterval(refreshData, 15000);
});
