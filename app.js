// Configuration
const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbz69qrduoQZXFYTk1cC0lRHpOMM2pfWw-HH02hXqPoNUiEEELbdmLL8riOll2FaQmJH/exec'; 

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

    // Theme Logic (Manual + System Sync)
    const savedTheme = localStorage.getItem('theme');
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const activeTheme = savedTheme || systemTheme;

    rootElement.setAttribute('data-theme', activeTheme);
    updateThemeIcon(activeTheme);

    // Listener para cambios en el sistema (iPhone settings)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            const newSystemTheme = e.matches ? 'dark' : 'light';
            rootElement.setAttribute('data-theme', newSystemTheme);
            updateThemeIcon(newSystemTheme);
        }
    });

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

    // Refresh Data Function
    async function refreshData() {
        if (!BACKEND_URL) return;
        try {
            const response = await fetch(BACKEND_URL);
            guests = await response.json();
            render();
        } catch (err) {
            console.error('Error al cargar datos:', err);
        }
    }

    // Help Functions
    function isSameDate(dateStr, targetDateStr) {
        if (!dateStr || !targetDateStr) return false;
        const date = new Date(dateStr);
        const target = new Date(targetDateStr + 'T00:00:00'); 
        return date.getDate() === target.getDate() &&
               date.getMonth() === target.getMonth() &&
               date.getFullYear() === target.getFullYear();
    }

    function parseWaitMinutes(guest) {
        const raw = Number(guest.waitDuration);
        if (!isNaN(raw) && guest.waitDuration !== '' && guest.waitDuration !== null) return raw;
        const endTime = guest.resultAt || guest.waitDuration;
        if (endTime && guest.timestamp) {
            const end = new Date(endTime).getTime();
            const start = new Date(guest.timestamp).getTime();
            if (!isNaN(end) && !isNaN(start)) return Math.max(0, Math.floor((end - start) / 60000));
        }
        return 0;
    }

    function formatTime(dateStr) {
        if (!dateStr) return '--:--';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '--:--';
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    function formatPhone(phone) {
        if (!phone) return '---';
        const cleaned = ('' + phone).replace(/\D/g, '');
        const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
        if (match) {
            return `(${match[1]}) ${match[2]}-${match[3]}`;
        }
        return phone;
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
        
        // Update Stats
        waitingCountEl.textContent = guests.filter(g => g.status === 'WAITING').length;
        notifiedCountEl.textContent = guests.filter(g => g.status === 'NOTIFIED').length;
    }

    function createGuestCard(guest) {
        const isHistory = currentView === 'history';
        const timestamp = new Date(guest.timestamp).getTime();
        let displayTime = 0;

        if (isHistory) {
            displayTime = parseWaitMinutes(guest);
        } else {
            displayTime = isNaN(timestamp) ? 0 : Math.floor((new Date().getTime() - timestamp) / 60000);
        }

        const isNotified = guest.status === 'NOTIFIED';
        const registrationTime = formatTime(guest.timestamp);
        const formattedPhone = formatPhone(guest.phone);

        // Unpack special requirements (Workaround for backend limitations)
        const typeData = guest.type || '';
        const packedReqs = typeData.includes('|') ? typeData.split('|')[1] : '';
        const hasCar = guest.car === 'Sí' || packedReqs.includes('C');
        const hasWheelchair = packedReqs.includes('S');
        const hasPet = packedReqs.includes('M');
        
        // Clean type for internal use if needed (not strictly necessary here as we don't display it in the card)
        
        return `
            <div class="customer-card ${isNotified ? 'notified' : ''}">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h3 class="guest-name">${guest.name} <small style="font-weight: normal; color: var(--text-secondary); opacity: 0.8;">${formattedPhone}</small></h3>
                        <div class="guest-details">
                            <span>🕒 Registro: ${registrationTime}</span>
                            <span>👥 ${guest.pax} pax</span>
                            ${hasCar ? '<span>👶 Coche</span>' : ''}
                            ${hasWheelchair ? '<span>♿ Silla</span>' : ''}
                            ${hasPet ? '<span>🐕 Mascota</span>' : ''}
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
                        <input type="tel" id="guest-phone" required placeholder="Ej. 7871234567">
                    </div>
                    <div class="form-group">
                        <label>Cantidad de Personas</label>
                        <input type="number" id="guest-pax" min="1" max="25" value="2" required>
                    </div>
                    <div class="form-group">
                        <label>Tipo de Cliente</label>
                        <select id="guest-type">
                            <option value="Primera">Primera Vez</option>
                            <option value="Frecuente">Frecuente</option>
                        </select>
                    </div>
                    <div class="form-group-checkboxes">
                        <label class="checkbox-container">
                            <input type="checkbox" id="guest-car">
                            <span>👶 Coche de Bebé</span>
                        </label>
                        <label class="checkbox-container">
                            <input type="checkbox" id="guest-wheelchair">
                            <span>♿ Silla de Ruedas</span>
                        </label>
                        <label class="checkbox-container">
                            <input type="checkbox" id="guest-pet">
                            <span>🐕 Mascota de Servicio</span>
                        </label>
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

            const isCar = document.getElementById('guest-car').checked;
            const isWheelchair = document.getElementById('guest-wheelchair').checked;
            const isPet = document.getElementById('guest-pet').checked;
            const baseType = document.getElementById('guest-type').value;

            // Pack requirements into the 'type' field (e.g. "Primera|CSM")
            let packedType = baseType;
            let suffix = '';
            if (isCar) suffix += 'C';
            if (isWheelchair) suffix += 'S';
            if (isPet) suffix += 'M';
            if (suffix) packedType += '|' + suffix;

            const newGuest = {
                action: 'addGuest',
                name: document.getElementById('guest-name').value,
                phone: document.getElementById('guest-phone').value,
                pax: document.getElementById('guest-pax').value,
                car: isCar ? 'Sí' : 'No', // Keep standard for car column
                type: packedType
            };

            try {
                const response = await fetch(BACKEND_URL, {
                    method: 'POST',
                    body: JSON.stringify(newGuest)
                });
                const result = await response.json();
                if (result.success) {
                    closeModal();
                    await refreshData();
                } else {
                    alert('Error al guardar: ' + result.error);
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'GUARDAR';
                }
            } catch (err) {
                console.error('Error al guardar:', err);
                submitBtn.disabled = false;
                submitBtn.textContent = 'GUARDAR';
            }
        });
    }

    window.closeModal = () => {
        modalContainer.classList.add('hidden');
    };

    window.updateGuestStatus = async (rowId, status) => {
        // Encontrar al cliente localmente para el mensaje
        const guest = guests.find(g => g.rowId === rowId);
        const nameDisplay = guest ? guest.name.toUpperCase() : "CLIENTE";

        // 1. Confirmar ANTES que cualquier otra cosa
        const actionText = status === 'SEATED' ? 'SENTADO' : 'NO LLEGÓ';
        const ok = confirm(`¿Estás seguro de marcar como ${actionText} a: ${nameDisplay}?`);
        if (!ok) return;

        try {
            // 2. Ejecutar si todo está OK
            await fetch(BACKEND_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'updateStatus', rowId, status })
            });
            await refreshData();
        } catch (err) {
            console.error('Error al actualizar:', err);
        }
    };

    window.notifyGuest = async (rowId, event) => {
        const guest = guests.find(g => g.rowId === rowId);
        if (!guest) return;

        const confirmSend = confirm(`¿Estás seguro de que deseas enviar el SMS a ${guest.name.toUpperCase()}?`);
        if (!confirmSend) return;

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
                await refreshData();
            } else {
                alert('Error al enviar: ' + result.error);
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = '🔔 ENVIAR SMS';
                }
            }
        } catch (err) { 
            console.error('Error al notificar:', err); 
            if (btn) {
                btn.disabled = false;
                btn.textContent = '🔔 ENVIAR SMS';
            }
        }
    };

    // Tab Listeners
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentView = btn.dataset.view;
            render();
        });
    });

    // Search Listener
    searchInput.addEventListener('input', render);

    // Initial Load
    await refreshData();
    setInterval(refreshData, 15000); // Auto-refresh cada 15 seg
});
