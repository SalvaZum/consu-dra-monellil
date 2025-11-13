// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAGmFXURLC0zf8epsQXPuidKzQMy4GCQeM",
    authDomain: "consultoriodramonelli.firebaseapp.com",
    projectId: "consultoriodramonelli",
    storageBucket: "consultoriodramonelli.firebasestorage.app",
    messagingSenderId: "891940025413",
    appId: "1:891940025413:web:572cdade02af2f31475f2c",
    measurementId: "G-42N61LN5D3"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Estado de la aplicación
let isLoggedIn = false;
let turns = [];
let turnToDelete = null;
let autoSyncEnabled = false;

// Elementos DOM
const loginSection = document.getElementById('login-section');
const adminSection = document.getElementById('admin-section');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const syncTurnsBtn = document.getElementById('sync-turns-btn');
const googleAuthBtn = document.getElementById('google-auth-btn');
const loginAlert = document.getElementById('login-alert');
const adminAlert = document.getElementById('admin-alert');
const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');

// Credenciales de administrador
const adminCredentials = {
    usuario: "admin",
    password: "admin123"
};

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    checkAuthState();
    setupEventListeners();
    setupTabs();
    setupFilters();
    setupConfirmModal();
});

function setupConfirmModal() {
    confirmDeleteBtn.addEventListener('click', function() {
        if (turnToDelete) {
            deleteTurn(turnToDelete);
        }
        confirmModal.style.display = 'none';
        turnToDelete = null;
    });

    cancelDeleteBtn.addEventListener('click', function() {
        confirmModal.style.display = 'none';
        turnToDelete = null;
    });

    // Cerrar modal al hacer clic fuera
    window.addEventListener('click', function(event) {
        if (event.target === confirmModal) {
            confirmModal.style.display = 'none';
            turnToDelete = null;
        }
    });
}

function checkAuthState() {
    const savedAuth = localStorage.getItem('adminAuth');
    if (savedAuth) {
        const auth = JSON.parse(savedAuth);
        if (auth.loggedIn && auth.timestamp > Date.now() - 24 * 60 * 60 * 1000) {
            // Sesión válida (menos de 24 horas)
            showAdminSection();
            loadTurns();
            // Activar sincronización automática
            enableAutoSync();
        } else {
            // Sesión expirada
            localStorage.removeItem('adminAuth');
            showLoginSection();
        }
    } else {
        showLoginSection();
    }
}

function setupEventListeners() {
    loginBtn.addEventListener('click', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    syncTurnsBtn.addEventListener('click', handleSyncTurns);
    
    // Configurar botón de Google Calendar
    if (googleAuthBtn) {
        googleAuthBtn.addEventListener('click', function() {
            if (typeof handleGoogleAuthRedirect !== 'undefined') {
                handleGoogleAuthRedirect();
            } else {
                showAlert(adminAlert, 'Google Calendar no está disponible', 'error');
            }
        });
    }
    
    // Login con Enter
    document.getElementById('password').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleLogin();
        }
    });
}

function handleSyncTurns() {
    if (typeof syncAllTurnsToCalendar !== 'undefined') {
        syncAllTurnsToCalendar();
    } else {
        showAlert(adminAlert, 'Función de sincronización no disponible', 'error');
    }
}

function enableAutoSync() {
    if (autoSyncEnabled) return;
    
    autoSyncEnabled = true;
    console.log('🔄 Activando sincronización automática...');
    
    // Sincronizar cuando se carga la página
    setTimeout(() => {
        if (typeof syncAllTurnsToCalendar !== 'undefined') {
            syncAllTurnsToCalendar();
        }
    }, 3000);
    
    // Sincronizar cada 5 minutos
    setInterval(() => {
        if (typeof syncAllTurnsToCalendar !== 'undefined') {
            console.log('🔄 Sincronización automática programada');
            syncAllTurnsToCalendar();
        }
    }, 5 * 60 * 1000); // 5 minutos
    
    // Activar limpieza automática
    setupAutoCleanup();
    
    // Escuchar nuevos turnos en tiempo real
    setupFirebaseListener();
}

function setupFirebaseListener() {
    try {
        db.collection('turnos')
            .where('estado', '==', 'confirmado')
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        console.log('🆕 Nuevo turno detectado:', change.doc.id);
                        // Sincronizar nuevo turno automáticamente
                        if (typeof syncSingleTurnToCalendar !== 'undefined') {
                            setTimeout(() => {
                                syncSingleTurnToCalendar(change.doc.id);
                            }, 2000);
                        }
                    }
                });
            });
            
        console.log('✅ Listener de Firebase activado para sincronización automática');
    } catch (error) {
        console.error('Error configurando listener de Firebase:', error);
    }
}

function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remover clase active de todas las tabs
            tabs.forEach(t => t.classList.remove('active'));
            // Agregar clase active a la tab clickeada
            this.classList.add('active');
            
            // Mostrar contenido correspondiente
            const tabId = this.getAttribute('data-tab');
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`${tabId}-tab`).classList.add('active');
            
            // Cargar datos específicos si es necesario
            if (tabId === 'today') {
                loadTodayTurns();
            } else if (tabId === 'all') {
                loadAllTurns();
            } else if (tabId === 'upcoming') {
                loadUpcomingTurns();
            }
        });
    });
}

function setupFilters() {
    // Filtros para la pestaña de hoy
    document.getElementById('today-search').addEventListener('input', loadTodayTurns);
    document.getElementById('today-filter').addEventListener('change', loadTodayTurns);
    
    // Filtros para la pestaña de todos los turnos
    document.getElementById('all-search').addEventListener('input', loadAllTurns);
    document.getElementById('date-filter').addEventListener('change', loadAllTurns);
    document.getElementById('service-filter').addEventListener('change', loadAllTurns);
    document.getElementById('status-filter').addEventListener('change', loadAllTurns);
    
    // Filtros para la pestaña de próximos turnos
    document.getElementById('upcoming-search').addEventListener('input', loadUpcomingTurns);
    document.getElementById('upcoming-days').addEventListener('change', loadUpcomingTurns);
}

function handleLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (username === adminCredentials.usuario && password === adminCredentials.password) {
        // Login exitoso
        const authData = {
            loggedIn: true,
            timestamp: Date.now()
        };
        localStorage.setItem('adminAuth', JSON.stringify(authData));
        showAdminSection();
        loadTurns();
        enableAutoSync(); // Activar sincronización automática
        showAlert(loginAlert, 'Login exitoso!', 'success');
    } else {
        showAlert(loginAlert, 'Usuario o contraseña incorrectos', 'error');
    }
}

function handleLogout() {
    localStorage.removeItem('adminAuth');
    autoSyncEnabled = false;
    showLoginSection();
    showAlert(loginAlert, 'Sesión cerrada correctamente', 'success');
}

function showLoginSection() {
    loginSection.style.display = 'flex';
    adminSection.style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

function showAdminSection() {
    loginSection.style.display = 'none';
    adminSection.style.display = 'block';
}

function showAlert(alertElement, message, type) {
    alertElement.textContent = message;
    alertElement.className = `alert alert-${type}`;
    alertElement.style.display = 'block';
    
    setTimeout(() => {
        alertElement.style.display = 'none';
    }, 5000);
}

// Funciones para manejar turnos
async function loadTurns() {
    try {
        const snapshot = await db.collection('turnos')
            .orderBy('timestamp', 'desc')
            .get();
        
        turns = [];
        snapshot.forEach(doc => {
            turns.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        updateStats();
        loadTodayTurns();
        loadAllTurns();
        loadUpcomingTurns();
    } catch (error) {
        console.error('Error cargando turnos:', error);
        showAlert(adminAlert, 'Error al cargar los turnos', 'error');
    }
}

function updateStats() {
    const today = new Date().toISOString().split('T')[0];
    
    const total = turns.length;
    const confirmed = turns.filter(t => t.estado === 'confirmado').length;
    const todayTurns = turns.filter(t => t.fecha === today).length;
    const canceled = turns.filter(t => t.estado === 'cancelado').length;
    
    document.getElementById('total-turns').textContent = total;
    document.getElementById('confirmed-turns').textContent = confirmed;
    document.getElementById('today-turns').textContent = todayTurns;
    document.getElementById('canceled-turns').textContent = canceled;
}

function loadTodayTurns() {
    const today = new Date();
    const todayStr = formatDateForFilter(today);
    
    console.log('📅 Filtrando turnos para hoy:', todayStr);
    
    const serviceFilter = document.getElementById('today-filter').value;
    const searchTerm = document.getElementById('today-search').value.toLowerCase();
    
    let todayTurns = turns.filter(t => {
        const turnDate = new Date(t.fecha + 'T00:00:00');
        const turnDateStr = formatDateForFilter(turnDate);
        return turnDateStr === todayStr;
    });
    
    console.log('📊 Turnos encontrados para hoy:', todayTurns.length);
    
    // Aplicar filtro de servicio
    if (serviceFilter !== 'all') {
        todayTurns = todayTurns.filter(t => t.servicio === serviceFilter);
    }
    
    // Aplicar filtro de búsqueda
    if (searchTerm) {
        todayTurns = todayTurns.filter(t => 
            t.pacienteNombre.toLowerCase().includes(searchTerm) ||
            t.pacienteApellido.toLowerCase().includes(searchTerm)
        );
    }
    
    todayTurns.sort((a, b) => a.hora.localeCompare(b.hora));
    
    const tbody = document.getElementById('today-tbody');
    tbody.innerHTML = '';
    
    if (todayTurns.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">No hay turnos para hoy</td></tr>';
        return;
    }
    
    todayTurns.forEach(turn => {
        const row = createTurnRow(turn, 'today');
        tbody.appendChild(row);
    });
}

function formatDateForFilter(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function loadAllTurns() {
    const dateFilter = document.getElementById('date-filter').value;
    const serviceFilter = document.getElementById('service-filter').value;
    const statusFilter = document.getElementById('status-filter').value;
    const searchTerm = document.getElementById('all-search').value.toLowerCase();
    
    let filteredTurns = [...turns];
    
    // Aplicar filtros
    if (dateFilter) {
        filteredTurns = filteredTurns.filter(t => t.fecha === dateFilter);
    }
    
    if (serviceFilter !== 'all') {
        filteredTurns = filteredTurns.filter(t => t.servicio === serviceFilter);
    }
    
    if (statusFilter !== 'all') {
        filteredTurns = filteredTurns.filter(t => t.estado === statusFilter);
    }
    
    // Aplicar filtro de búsqueda
    if (searchTerm) {
        filteredTurns = filteredTurns.filter(t => 
            t.pacienteNombre.toLowerCase().includes(searchTerm) ||
            t.pacienteApellido.toLowerCase().includes(searchTerm)
        );
    }
    
    const tbody = document.getElementById('all-tbody');
    tbody.innerHTML = '';
    
    if (filteredTurns.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">No hay turnos que coincidan con los filtros</td></tr>';
        return;
    }
    
    filteredTurns.forEach(turn => {
        const row = createTurnRow(turn, 'all');
        tbody.appendChild(row);
    });
}

function loadUpcomingTurns() {
    const days = parseInt(document.getElementById('upcoming-days').value);
    const searchTerm = document.getElementById('upcoming-search').value.toLowerCase();
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);
    
    const todayStr = today.toISOString().split('T')[0];
    const futureStr = futureDate.toISOString().split('T')[0];
    
    let upcomingTurns = turns.filter(t => {
        return t.fecha >= todayStr && 
               t.fecha <= futureStr && 
               t.estado === 'confirmado';
    });
    
    // Aplicar filtro de búsqueda
    if (searchTerm) {
        upcomingTurns = upcomingTurns.filter(t => 
            t.pacienteNombre.toLowerCase().includes(searchTerm) ||
            t.pacienteApellido.toLowerCase().includes(searchTerm)
        );
    }
    
    upcomingTurns.sort((a, b) => {
        if (a.fecha === b.fecha) {
            return a.hora.localeCompare(b.hora);
        }
        return a.fecha.localeCompare(b.fecha);
    });
    
    const tbody = document.getElementById('upcoming-tbody');
    tbody.innerHTML = '';
    
    if (upcomingTurns.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">No hay turnos próximos</td></tr>';
        return;
    }
    
    upcomingTurns.forEach(turn => {
        const row = createTurnRow(turn, 'upcoming');
        tbody.appendChild(row);
    });
}

function createTurnRow(turn, viewType) {
    const row = document.createElement('tr');
    
    if (viewType !== 'today') {
        const fechaCell = document.createElement('td');
        fechaCell.textContent = formatDate(turn.fecha);
        row.appendChild(fechaCell);
    }
    
    const horaCell = document.createElement('td');
    horaCell.textContent = turn.hora;
    row.appendChild(horaCell);
    
    const pacienteCell = document.createElement('td');
    pacienteCell.innerHTML = `
        <div><strong>${turn.pacienteNombre} ${turn.pacienteApellido}</strong></div>
        <div class="patient-info">DNI: ${turn.pacienteDNI}</div>
    `;
    row.appendChild(pacienteCell);
    
    const dniCell = document.createElement('td');
    dniCell.textContent = turn.pacienteDNI;
    row.appendChild(dniCell);
    
    const servicioCell = document.createElement('td');
    servicioCell.textContent = turn.servicio;
    row.appendChild(servicioCell);
    
    const estadoCell = document.createElement('td');
    const statusBadge = document.createElement('span');
    statusBadge.className = `status-badge status-${turn.estado}`;
    statusBadge.textContent = turn.estado.charAt(0).toUpperCase() + turn.estado.slice(1);
    estadoCell.appendChild(statusBadge);
    row.appendChild(estadoCell);
    
    const accionesCell = document.createElement('td');
    accionesCell.className = 'action-buttons';
    
    if (turn.estado === 'confirmado') {
        const completarBtn = document.createElement('button');
        completarBtn.className = 'action-btn btn-success btn-small';
        completarBtn.innerHTML = '<i class="fas fa-check"></i> Completado';
        completarBtn.title = 'Marcar como completado';
        completarBtn.onclick = () => updateTurnStatus(turn.id, 'completado');
        accionesCell.appendChild(completarBtn);
        
        const cancelarBtn = document.createElement('button');
        cancelarBtn.className = 'action-btn btn-danger btn-small';
        cancelarBtn.innerHTML = '<i class="fas fa-times"></i> Cancelar';
        cancelarBtn.title = 'Cancelar turno';
        cancelarBtn.onclick = () => updateTurnStatus(turn.id, 'cancelado');
        accionesCell.appendChild(cancelarBtn);
    } else if (turn.estado === 'completado') {
        // Para turnos completados, solo permitir eliminar
        const eliminarBtn = document.createElement('button');
        eliminarBtn.className = 'action-btn btn-danger btn-small';
        eliminarBtn.innerHTML = '<i class="fas fa-trash"></i> Eliminar';
        eliminarBtn.title = 'Eliminar turno permanentemente';
        eliminarBtn.onclick = () => showDeleteConfirmation(turn);
        accionesCell.appendChild(eliminarBtn);
    } else if (turn.estado === 'cancelado') {
        // Para turnos cancelados, solo permitir eliminar (NO reafirmar)
        const eliminarBtn = document.createElement('button');
        eliminarBtn.className = 'action-btn btn-danger btn-small';
        eliminarBtn.innerHTML = '<i class="fas fa-trash"></i> Eliminar';
        eliminarBtn.title = 'Eliminar turno permanentemente';
        eliminarBtn.onclick = () => showDeleteConfirmation(turn);
        accionesCell.appendChild(eliminarBtn);
    }
    
    row.appendChild(accionesCell);
    
    return row;
}

function showDeleteConfirmation(turn) {
    turnToDelete = turn.id;
    confirmMessage.textContent = `¿Estás seguro de que deseas eliminar permanentemente el turno de ${turn.pacienteNombre} ${turn.pacienteApellido} para el ${formatDate(turn.fecha)} a las ${turn.hora}? Esta acción no se puede deshacer.`;
    confirmModal.style.display = 'flex';
}

async function deleteTurn(turnId) {
    try {
        await db.collection('turnos').doc(turnId).delete();
        
        showAlert(adminAlert, 'Turno eliminado permanentemente', 'success');
        loadTurns(); // Recargar los datos
    } catch (error) {
        console.error('Error eliminando turno:', error);
        showAlert(adminAlert, 'Error al eliminar el turno', 'error');
    }
}

async function updateTurnStatus(turnId, newStatus) {
    try {
        await db.collection('turnos').doc(turnId).update({
            estado: newStatus
        });
        
        // Manejar sincronización con Google Calendar
        if (typeof updateCalendarEvent !== 'undefined') {
            if (newStatus === 'cancelado') {
                // Si se cancela el turno, eliminar del Google Calendar
                setTimeout(() => {
                    if (typeof deleteCalendarEvent !== 'undefined') {
                        deleteCalendarEvent(turnId);
                    }
                }, 1000);
            } else {
                // Para otros estados, actualizar el evento
                updateCalendarEvent(turnId, newStatus);
            }
        }
        
        showAlert(adminAlert, `Turno ${newStatus} correctamente`, 'success');
        loadTurns(); // Recargar los datos
    } catch (error) {
        console.error('Error actualizando turno:', error);
        showAlert(adminAlert, 'Error al actualizar el turno', 'error');
    }
}

function formatDate(dateString) {
    const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    return new Date(dateString + 'T00:00:00').toLocaleDateString('es-ES', options);
}

// Agregar esta función en admin.js
function setupAutoCleanup() {
    // Ejecutar limpieza al cargar la página
    setTimeout(() => {
        if (typeof cleanupCanceledTurns !== 'undefined') {
            cleanupCanceledTurns();
        }
    }, 5000);
    
    // Ejecutar limpieza cada hora
    setInterval(() => {
        if (typeof cleanupCanceledTurns !== 'undefined') {
            cleanupCanceledTurns();
        }
    }, 60 * 60 * 1000); // 1 hora
}
