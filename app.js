// Configuration
const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbz69qrduoQZXFYTk1cC0lRHpOMM2pfWw-HH02hXqPoNUiEEELbdmLL8riOll2FaQmJH/exec'; 

// State Management
let guests = [];
let currentView = 'active';
let selectedHistoryDate = new Date().toISOString().split('T')[0];
let tableStatuses = {};
const LOCAL_TABLES_KEY = 'waitlist_table_statuses';

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
    const tablesContainer = document.getElementById('tables-container');
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

    // Tables Cloud Sync via Backend
    function syncTablesFromBackend() {
        const tableDataRow = guests.find(g => g.name === '__TABLE_STATUSES__');
        if (tableDataRow && tableDataRow.type) {
            try {
                const remoteTables = JSON.parse(tableDataRow.type);
                tableStatuses = { ...tableStatuses, ...remoteTables };
                saveTables();
            } catch (e) {
                console.error('Error parseando estado de mesas:', e);
            }
        }
    }

    async function syncTablesToBackend() {
        const tableDataRow = guests.find(g => g.name === '__TABLE_STATUSES__');
        const jsonStr = JSON.stringify(tableStatuses);
        try {
            if (tableDataRow) {
                await fetch(BACKEND_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'editGuest',
                        rowId: tableDataRow.rowId,
                        name: '__TABLE_STATUSES__',
                        phone: '0000000000',
                        pax: 0,
                        car: 'No',
                        type: jsonStr
                    })
                });
            } else {
                const resp = await fetch(BACKEND_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'addGuest',
                        name: '__TABLE_STATUSES__',
                        phone: '0000000000',
                        pax: 0,
                        car: 'No',
                        type: jsonStr
                    })
                });
                const result = await resp.json();
                if (result && result.success) {
                    await refreshData();
                }
            }
        } catch (err) {
            console.error('Error al guardar mesas en backend:', err);
        }
    }

    // Tables Logic
    function initTables() {
        const saved = localStorage.getItem(LOCAL_TABLES_KEY);
        if (saved) {
            try {
                tableStatuses = JSON.parse(saved);
            } catch (e) {
                tableStatuses = {};
            }
        }
        // Ensure even tables 2 to 42 are initialized
        for (let i = 2; i <= 42; i += 2) {
            if (!tableStatuses[i]) {
                tableStatuses[i] = 'green';
            }
        }
        saveTables();
        syncTablesFromBackend();
    }

    function saveTables() {
        localStorage.setItem(LOCAL_TABLES_KEY, JSON.stringify(tableStatuses));
    }

    function renderTablesGrid() {
        if (!tablesContainer) return;
        let html = `
            <div class="tables-title-container">
                <span class="tables-title">Estado de Mesas</span>
                <div class="tables-legend">
                    <div class="legend-item"><span class="legend-dot green"></span>Disp.</div>
                    <div class="legend-item"><span class="legend-dot yellow"></span>Por liberar</div>
                    <div class="legend-item"><span class="legend-dot red"></span>Ocupada</div>
                </div>
            </div>
            <div class="tables-grid">
        `;
        for (let i = 2; i <= 42; i += 2) {
            const status = tableStatuses[i] || 'green';
            html += `
                <button class="table-btn ${status}" onclick="cycleTableStatus(${i})">${i}</button>
            `;
        }
        html += `</div>`;
        tablesContainer.innerHTML = html;
    }

    window.cycleTableStatus = async (tableNum) => {
        const current = tableStatuses[tableNum] || 'green';
        let next = 'green';
        if (current === 'green') next = 'red';
        else if (current === 'red') next = 'yellow';
        else next = 'green';
        
        tableStatuses[tableNum] = next;
        saveTables();
        renderTablesGrid();
        await syncTablesToBackend();
    };

    // Refresh Data Function
    async function refreshData() {
        if (!BACKEND_URL) return;
        try {
            const response = await fetch(BACKEND_URL);
            guests = await response.json();
            syncTablesFromBackend();
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
            if (tablesContainer) tablesContainer.classList.add('hidden');
        } else {
            historyFilterContainer.classList.add('hidden');
            if (tablesContainer) {
                tablesContainer.classList.remove('hidden');
                renderTablesGrid();
            }
        }

        const filteredGuests = guests.filter(g => {
            if (g.name === '__TABLE_STATUSES__') return false;
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
            const history = guests.filter(g => g.name !== '__TABLE_STATUSES__' && (g.status === 'SEATED' || g.status === 'ABSENT') && isSameDate(g.timestamp, selectedHistoryDate));
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
        waitingCountEl.textContent = guests.filter(g => g.name !== '__TABLE_STATUSES__' && g.status === 'WAITING').length;
        notifiedCountEl.textContent = guests.filter(g => g.name !== '__TABLE_STATUSES__' && g.status === 'NOTIFIED').length;
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

        // Unpack special requirements
        const typeData = guest.type || '';
        const packedReqs = typeData.includes('|') ? typeData.split('|')[1] : '';
        const hasCar = guest.car === 'Sí' || packedReqs.includes('C');
        const hasWheelchair = packedReqs.includes('S');
        const hasPet = packedReqs.includes('M');
        const noWhatsApp = packedReqs.includes('W');
        
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
                            ${noWhatsApp ? '<span class="tag-nowa-red">📞 Llamar (Sin WA)</span>' : ''}
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                        <div class="pax-badge">${displayTime}m ${isHistory ? 'total' : 'esp.'}</div>
                        ${currentView === 'active' ? `<button onclick="openEditGuestModal(${guest.rowId})" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7" title="Editar">✏️</button>` : ''}
                    </div>
                </div>
                
                ${currentView === 'active' ? `
                    <div class="actions">
                        <div class="notify-row">
                            <button class="btn btn-notify ${noWhatsApp ? 'btn-red' : ''}" onclick="handleNotifyGuest(${guest.rowId}, event)" ${isNotified ? 'disabled' : ''} title="${noWhatsApp ? 'Notificar por llamada (No tiene WhatsApp)' : 'Enviar mensaje por WhatsApp'}">
                                ${isNotified ? '✅ NOTIFICADO' : (noWhatsApp ? '📞 LLAMAR' : '💬 WHATSAPP')}
                            </button>
                            <label class="checkbox-nowa ${noWhatsApp ? 'checked' : ''}" title="Marcar si el cliente no tiene WhatsApp (el botón se tornará rojo para llamarlo)">
                                <input type="checkbox" ${noWhatsApp ? 'checked' : ''} onchange="toggleNoWhatsApp(${guest.rowId}, this.checked)" ${isNotified ? 'disabled' : ''}>
                                <span>Sin WA</span>
                            </label>
                        </div>
                        <div class="status-row">
                            <button class="btn btn-seated" onclick="updateGuestStatus(${guest.rowId}, 'SEATED')">
                                SENTADO
                            </button>
                            <button class="btn btn-absent" onclick="updateGuestStatus(${guest.rowId}, 'ABSENT')">
                                NO LLEGÓ
                            </button>
                        </div>
                    </div>
                ` : `
                    <div class="actions actions-history">
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
                        <label class="checkbox-container checkbox-nowa-modal">
                            <input type="checkbox" id="guest-nowa">
                            <span>📞 Sin WhatsApp (Llamar al cliente)</span>
                        </label>
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
            const isNoWa = document.getElementById('guest-nowa').checked;
            const baseType = document.getElementById('guest-type').value;

            let packedType = baseType;
            let suffix = '';
            if (isCar) suffix += 'C';
            if (isWheelchair) suffix += 'S';
            if (isPet) suffix += 'M';
            if (isNoWa) suffix += 'W';
            if (suffix) packedType += '|' + suffix;

            const newGuest = {
                action: 'addGuest',
                name: document.getElementById('guest-name').value,
                phone: document.getElementById('guest-phone').value,
                pax: document.getElementById('guest-pax').value,
                car: isCar ? 'Sí' : 'No',
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

    window.openEditGuestModal = (rowId) => {
        const guest = guests.find(g => g.rowId === rowId);
        if (!guest) return;

        const typeData = guest.type || '';
        const baseType = typeData.includes('|') ? typeData.split('|')[0] : typeData;
        const packedReqs = typeData.includes('|') ? typeData.split('|')[1] : '';
        const hasCar = guest.car === 'Sí' || packedReqs.includes('C');
        const hasWheelchair = packedReqs.includes('S');
        const hasPet = packedReqs.includes('M');
        const noWhatsApp = packedReqs.includes('W');

        modalContainer.innerHTML = `
            <div class="modal-content">
                <h2>Editar Registro</h2>
                <form id="edit-guest-form">
                    <div class="form-group">
                        <label>Nombre del Cliente</label>
                        <input type="text" id="edit-guest-name" required value="${guest.name}">
                    </div>
                    <div class="form-group">
                        <label>Número de Teléfono</label>
                        <input type="tel" id="edit-guest-phone" required value="${guest.phone}">
                    </div>
                    <div class="form-group">
                        <label>Cantidad de Personas</label>
                        <input type="number" id="edit-guest-pax" min="1" max="25" required value="${guest.pax}">
                    </div>
                    <div class="form-group">
                        <label>Tipo de Cliente</label>
                        <select id="edit-guest-type">
                            <option value="Primera" ${baseType === 'Primera' ? 'selected' : ''}>Primera Vez</option>
                            <option value="Frecuente" ${baseType === 'Frecuente' ? 'selected' : ''}>Frecuente</option>
                        </select>
                    </div>
                    <div class="form-group-checkboxes">
                        <label class="checkbox-container checkbox-nowa-modal">
                            <input type="checkbox" id="edit-guest-nowa" ${noWhatsApp ? 'checked' : ''}>
                            <span>📞 Sin WhatsApp (Llamar al cliente)</span>
                        </label>
                        <label class="checkbox-container">
                            <input type="checkbox" id="edit-guest-car" ${hasCar ? 'checked' : ''}>
                            <span>👶 Coche de Bebé</span>
                        </label>
                        <label class="checkbox-container">
                            <input type="checkbox" id="edit-guest-wheelchair" ${hasWheelchair ? 'checked' : ''}>
                            <span>♿ Silla de Ruedas</span>
                        </label>
                        <label class="checkbox-container">
                            <input type="checkbox" id="edit-guest-pet" ${hasPet ? 'checked' : ''}>
                            <span>🐕 Mascota de Servicio</span>
                        </label>
                    </div>
                    <div class="form-actions" style="display: flex; gap: 10px; margin-top: 20px;">
                        <button type="button" class="btn btn-absent" onclick="closeModal()" style="flex: 1;">CANCELAR</button>
                        <button type="submit" class="btn btn-seated" style="flex: 1;">ACTUALIZAR</button>
                    </div>
                </form>
            </div>
        `;
        modalContainer.classList.remove('hidden');

        document.getElementById('edit-guest-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'ACTUALIZANDO...';

            const isCar = document.getElementById('edit-guest-car').checked;
            const isWheelchair = document.getElementById('edit-guest-wheelchair').checked;
            const isPet = document.getElementById('edit-guest-pet').checked;
            const isNoWa = document.getElementById('edit-guest-nowa').checked;
            const newBaseType = document.getElementById('edit-guest-type').value;

            let packedType = newBaseType;
            let suffix = '';
            if (isCar) suffix += 'C';
            if (isWheelchair) suffix += 'S';
            if (isPet) suffix += 'M';
            if (isNoWa) suffix += 'W';
            if (suffix) packedType += '|' + suffix;

            const updatedGuest = {
                action: 'editGuest',
                rowId: guest.rowId,
                name: document.getElementById('edit-guest-name').value,
                phone: document.getElementById('edit-guest-phone').value,
                pax: document.getElementById('edit-guest-pax').value,
                car: isCar ? 'Sí' : 'No',
                type: packedType
            };

            try {
                const response = await fetch(BACKEND_URL, {
                    method: 'POST',
                    body: JSON.stringify(updatedGuest)
                });
                const result = await response.json();
                if (result.success) {
                    closeModal();
                    await refreshData();
                } else {
                    alert('Error al actualizar: ' + result.error);
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'ACTUALIZAR';
                }
            } catch (err) {
                console.error('Error al actualizar:', err);
                submitBtn.disabled = false;
                submitBtn.textContent = 'ACTUALIZAR';
            }
        });
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

    window.toggleNoWhatsApp = async (rowId, isChecked) => {
        const guest = guests.find(g => g.rowId === rowId);
        if (!guest) return;

        const typeData = guest.type || '';
        const baseType = typeData.includes('|') ? typeData.split('|')[0] : typeData;
        let packedReqs = typeData.includes('|') ? typeData.split('|')[1] : '';

        if (isChecked) {
            if (!packedReqs.includes('W')) packedReqs += 'W';
        } else {
            packedReqs = packedReqs.replace('W', '');
        }

        const newType = packedReqs ? `${baseType}|${packedReqs}` : baseType;
        guest.type = newType;
        render();

        try {
            await fetch(BACKEND_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'editGuest',
                    rowId: guest.rowId,
                    name: guest.name,
                    phone: guest.phone,
                    pax: guest.pax,
                    car: guest.car || 'No',
                    type: newType
                })
            });
        } catch (err) {
            console.error('Error sincronizando Sin WA con backend:', err);
        }
    };

    window.handleNotifyGuest = async (rowId, event) => {
        const guest = guests.find(g => g.rowId === rowId);
        if (!guest) return;

        const typeData = guest.type || '';
        const packedReqs = typeData.includes('|') ? typeData.split('|')[1] : '';
        const noWhatsApp = packedReqs.includes('W');
        const formattedPhone = formatPhone(guest.phone);

        if (noWhatsApp) {
            // Cliente sin WhatsApp: la host lo llama externamente y solo confirma la notificación
            const confirmCall = confirm(`¿Confirmas que llamaste a ${guest.name.toUpperCase()} (${formattedPhone}) para notificarle que su mesa está lista?`);
            if (!confirmCall) return;

            const btn = event?.target?.closest('.btn-notify');
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'NOTIFICANDO...';
            }

            try {
                await fetch(BACKEND_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'updateStatus',
                        rowId,
                        status: 'NOTIFIED'
                    })
                });
                await refreshData();
            } catch (err) {
                console.error('Error al actualizar estado tras llamada:', err);
                await refreshData();
            }
        } else {
            // Cliente con WhatsApp: abre WhatsApp y actualiza estado
            const confirmSend = confirm(`¿Deseas notificar por WhatsApp a ${guest.name.toUpperCase()}?`);
            if (!confirmSend) return;

            let cleanPhone = ('' + guest.phone).replace(/\D/g, '');
            if (cleanPhone.length === 10) {
                cleanPhone = '1' + cleanPhone;
            }

            const msgText = `¡Hola, ${guest.name}! ¡Estamos encantados de informarle que su mesa para ${guest.pax} persona(s) en 'HISTORIAS Y UN CAFE' está lista! Le invitamos a unirse a nosotros en la recepción dentro de los próximos 5 minutos para asegurar su espacio. ¡Esperamos su llegada con gusto!`;
            const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msgText)}`;

            window.open(waUrl, '_blank');

            const btn = event?.target?.closest('.btn-notify');
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'ABRIENDO WA...';
            }

            try {
                let response = await fetch(BACKEND_URL, { 
                    method: 'POST', 
                    body: JSON.stringify({ 
                        action: 'notify', 
                        rowId, 
                        name: guest.name, 
                        phone: guest.phone, 
                        pax: guest.pax 
                    }) 
                });
                let result = await response.json();
                
                if (!result || !result.success) {
                    await fetch(BACKEND_URL, { 
                        method: 'POST', 
                        body: JSON.stringify({ 
                            action: 'updateStatus', 
                            rowId, 
                            status: 'NOTIFIED' 
                        }) 
                    });
                }
                await refreshData();
            } catch (err) { 
                console.error('Error al notificar en el backend:', err);
                try {
                    await fetch(BACKEND_URL, { 
                        method: 'POST', 
                        body: JSON.stringify({ 
                            action: 'updateStatus', 
                            rowId, 
                            status: 'NOTIFIED' 
                        }) 
                    });
                    await refreshData();
                } catch (e) {
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = '💬 WHATSAPP';
                    }
                }
            }
        }
    };

    window.notifyGuest = window.handleNotifyGuest;

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
    initTables();
    await refreshData();
    setInterval(refreshData, 15000); // Auto-refresh cada 15 seg
});
